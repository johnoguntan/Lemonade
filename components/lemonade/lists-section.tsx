"use client"

import { useRef, useState, type DragEvent } from "react"
import { todoMatchesSearchFilters, useLemonadeStore, type List, type TaskSearchFilters } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, ChevronUp, ChevronRight, MoreVertical, Trash2, Equal, PenLine, ArrowRight, CornerUpLeft, CornerUpRight, Link2, Check, ListTodo, AlertTriangle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getPlannerTaskDragData, setPlannerTaskDragData } from "@/lib/task-dnd"
import { TodoItem } from "./todo-item"

export function ListsSection() {
  const { 
    listTabs,
    lists, 
    addListTab,
    renameListTab,
    deleteListsInTab,
    addList, 
    deleteList, 
    renameList, 
    reorderList,
    addListAdjacent,
    moveListToTab,
    addListTodo, 
    updateListTodo,
    toggleListTodo, 
    deleteListTodo,
    preferences,
    searchQuery,
    searchModeActive,
    taskSearchFilters,
    labelFilterIds,
    activeFilterColor,
  } = useLemonadeStore()
  const [activeTabId, setActiveTabId] = useState("planning-tab")
  const [newTabName, setNewTabName] = useState("")
  const [tabDialogOpen, setTabDialogOpen] = useState(false)
  const [manageTabMenuOpen, setManageTabMenuOpen] = useState(false)
  const [renameTabDialogOpen, setRenameTabDialogOpen] = useState(false)
  const [renameTabName, setRenameTabName] = useState("")
  const [newTodoTexts, setNewTodoTexts] = useState<Record<string, string>>({})
  const [newReturnItemName, setNewReturnItemName] = useState("")
  const [newReturnStoreName, setNewReturnStoreName] = useState("")
  const [newReturnDeadline, setNewReturnDeadline] = useState("")
  const [newReturnNotes, setNewReturnNotes] = useState("")
  const [draggedListId, setDraggedListId] = useState<string | null>(null)
  const [isListsCollapsed, setIsListsCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const getListTabId = (list: List) =>
    list.tabId ?? (list.type === "planning" ? "planning-tab" : list.type === "shopping-returns" ? "shopping-returns-tab" : "my-lists-tab")

  const filteredLists = lists.filter((list) => getListTabId(list) === activeTabId)
  const shoppingReturnsList = lists.find((list) => list.id === "shopping-returns") ?? null
  const isShoppingReturnsTab = activeTabId === "shopping-returns-tab"
  const visibleShoppingReturns = (shoppingReturnsList?.todos ?? []).filter(
    (todo) =>
      todoMatchesSearchFilters(todo, {
        searchQuery,
        searchModeActive,
        taskSearchFilters,
        labelFilterIds,
        activeFilterColor,
        showCompleted: preferences.showCompleted,
      })
  )
  const getTabCount = (tabId: string) => lists.filter((list) => getListTabId(list) === tabId).length
  const activeTab = listTabs.find((tab) => tab.id === activeTabId) ?? null
  const handleCreateTab = () => {
    const normalizedName = newTabName.trim().toUpperCase()

    if (!normalizedName) {
      return
    }

    addListTab(normalizedName)
    setNewTabName("")
    setTabDialogOpen(false)
  }

  const handleRenameTab = () => {
    const normalizedName = renameTabName.trim().toUpperCase()

    if (!activeTab || !normalizedName) {
      return
    }

    renameListTab(activeTab.id, normalizedName)
    setRenameTabDialogOpen(false)
    setManageTabMenuOpen(false)
  }

  const handleCreateList = () => {
    if (isShoppingReturnsTab) {
      return
    }

    const existingAutoNamedLists = filteredLists.filter(
      (list) => /^LIST \d+$/.test(list.name)
    )

    addList(
      `LIST ${existingAutoNamedLists.length + 1}`,
      activeTabId === "planning-tab" ? "planning" : "list",
      activeTabId
    )
  }

  const handleAddTodo = (listId: string) => {
    const text = newTodoTexts[listId]
    if (text?.trim()) {
      addListTodo(listId, text.trim())
      setNewTodoTexts((prev) => ({ ...prev, [listId]: "" }))
    }
  }

  const handleManageListsInTab = () => {
    if (isListsCollapsed) {
      setIsListsCollapsed(false)
    }
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    setManageTabMenuOpen(false)
  }

  const handleAddShoppingReturn = () => {
    if (!shoppingReturnsList || !newReturnItemName.trim()) {
      return
    }

    addListTodo(shoppingReturnsList.id, newReturnItemName.trim())
    const createdTodo = useLemonadeStore
      .getState()
      .lists.find((list) => list.id === shoppingReturnsList.id)
      ?.todos.at(-1)

    if (createdTodo) {
      updateListTodo(shoppingReturnsList.id, createdTodo.id, {
        storeName: newReturnStoreName.trim() || undefined,
        returnDeadline: newReturnDeadline || undefined,
        notes: newReturnNotes.trim() || undefined,
      })
    }

    setNewReturnItemName("")
    setNewReturnStoreName("")
    setNewReturnDeadline("")
    setNewReturnNotes("")
  }

  return (
    <div
      className="relative z-20 mt-2 h-auto border-t-0 bg-transparent transition-all duration-300"
    >
      {/* Tabs */}
      <div className={cn(
        "flex min-h-10 items-center gap-2 overflow-hidden rounded-xl border border-border/35 bg-background/45 px-3 py-1 backdrop-blur-[12px] dark:bg-[rgba(19,19,19,0.34)]",
        !isListsCollapsed && "border-b border-border/45"
      )}
      >
        <DropdownMenu open={manageTabMenuOpen} onOpenChange={setManageTabMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="z-[90] w-[220px] rounded-2xl border border-border/70 border-b-[4px] border-b-[var(--accent-color)] px-2 py-2 shadow-xl"
          >
            <DropdownMenuLabel className="px-2 pb-3 pt-1 font-meta text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Manage Tab
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleManageListsInTab} className="px-2 py-3 text-[15px]">
              <ListTodo className="size-4" />
              Manage lists in tab
            </DropdownMenuItem>
            {!isShoppingReturnsTab ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    if (activeTab) {
                      setRenameTabName(activeTab.name)
                      setRenameTabDialogOpen(true)
                    }
                  }}
                  className="px-2 py-3 text-[15px]"
                >
                  <PenLine className="size-4" />
                  Rename tab
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    deleteListsInTab(activeTabId)
                    setManageTabMenuOpen(false)
                  }}
                  className="px-2 py-3 text-[15px]"
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete all {getTabCount(activeTabId)} lists
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={renameTabDialogOpen} onOpenChange={setRenameTabDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Tab</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Tab name"
              value={renameTabName}
              onChange={(event) => setRenameTabName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleRenameTab()}
            />
            <DialogFooter>
              <Button onClick={handleRenameTab}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-stretch">
            {listTabs.map((tab, index) => (
              <div
                key={tab.id}
                className={cn(
                  "flex items-stretch border-r border-[#edf0f4]",
                  index === 0 && "border-l border-[#edf0f4]"
                )}
              >
                <button
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    "lemonade-tab-label relative mx-1 my-0.5 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-0 font-meta text-[10px] leading-none uppercase tracking-[0.08em] transition-colors",
                    activeTabId === tab.id
                      ? "text-foreground dark:bg-[#131313] dark:text-foreground"
                      : "text-[#a7a9ac] hover:rounded-2xl hover:bg-[#F2F3F5] hover:text-[#a7a9ac] dark:hover:bg-[#131315] dark:hover:text-foreground"
                  )}
                >
                  <span>{tab.name}</span>
                  <span className="inline-flex min-w-4 items-center justify-center text-inherit/90">{getTabCount(tab.id)}</span>
                  {activeTabId === tab.id ? (
                    <span
                      className="absolute inset-x-1 bottom-[1px] h-[2px] rounded-full bg-[var(--accent-color)]"
                      style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent-color) 22%, transparent)" }}
                    />
                  ) : null}
                </button>
              </div>
            ))}
          </div>
        </div>

        <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1 size-6 shrink-0" disabled={isShoppingReturnsTab}>
              <Plus className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tab Name</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Tab name"
              value={newTabName}
              onChange={(event) => setNewTabName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleCreateTab()}
            />
            <DialogFooter>
              <Button onClick={handleCreateTab}>Add Tab</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsListsCollapsed((current) => !current)}
          className="size-6 shrink-0"
        >
          {isListsCollapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {/* Lists Grid */}
      {!isListsCollapsed ? (
        <div className="lemonade-list-stack relative h-auto bg-transparent">
          {isShoppingReturnsTab ? (
            <ShoppingReturnsSection
              list={shoppingReturnsList}
              items={visibleShoppingReturns}
              showCompleted={preferences.showCompleted}
              newItemName={newReturnItemName}
              newStoreName={newReturnStoreName}
              newDeadline={newReturnDeadline}
              newNotes={newReturnNotes}
              onNewItemNameChange={setNewReturnItemName}
              onNewStoreNameChange={setNewReturnStoreName}
              onNewDeadlineChange={setNewReturnDeadline}
              onNewNotesChange={setNewReturnNotes}
              onAddItem={handleAddShoppingReturn}
              onToggleReturned={(todoId) => shoppingReturnsList && toggleListTodo(shoppingReturnsList.id, todoId)}
              onDeleteItem={(todoId) => shoppingReturnsList && deleteListTodo(shoppingReturnsList.id, todoId)}
              onUpdateItem={(todoId, updates) => shoppingReturnsList && updateListTodo(shoppingReturnsList.id, todoId, updates)}
            />
          ) : (
          <>
          <div
            ref={scrollRef}
            className="lemonade-list-card-stack flex h-auto flex-col gap-7 bg-transparent px-0 py-2"
          >
            {filteredLists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                isDragging={draggedListId === list.id}
                onDelete={() => deleteList(list.id)}
                onRename={(name) => renameList(list.id, name)}
                onMoveToTab={(tabId) => moveListToTab(list.id, tabId)}
                onAddListLeft={() => addListAdjacent(list.id, "left")}
                onAddListRight={() => addListAdjacent(list.id, "right")}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", list.id)
                  setDraggedListId(list.id)
                }}
                onDragEnd={() => setDraggedListId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedListId) {
                    reorderList(activeTabId, draggedListId, list.id)
                  }
                  setDraggedListId(null)
                }}
                newTodoText={newTodoTexts[list.id] || ""}
                onNewTodoTextChange={(text) => setNewTodoTexts((prev) => ({ ...prev, [list.id]: text }))}
                onAddTodo={() => handleAddTodo(list.id)}
                searchQuery={searchQuery}
                searchModeActive={searchModeActive}
                taskSearchFilters={taskSearchFilters}
                labelFilterIds={labelFilterIds}
                activeFilterColor={activeFilterColor}
                showCompleted={preferences.showCompleted}
                listTabs={listTabs}
              />
            ))}

            <button
              onClick={handleCreateList}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-transparent px-4 text-muted-foreground transition-colors hover:border-[var(--accent-color)] hover:text-foreground"
            >
              <Plus className="size-4" />
              <span className="text-sm font-medium">NEW LIST</span>
            </button>
          </div>
          </>
          )}
        </div>
      ) : (
        <div className="h-0 overflow-hidden bg-background/90 dark:bg-transparent" />
      )}
    </div>
  )
}

interface ListCardProps {
  list: List
  isDragging: boolean
  onDelete: () => void
  onRename: (name: string) => void
  onMoveToTab: (tabId: string) => void
  onAddListLeft: () => void
  onAddListRight: () => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: () => void
  newTodoText: string
  onNewTodoTextChange: (text: string) => void
  onAddTodo: () => void
  searchQuery: string
  searchModeActive: boolean
  taskSearchFilters: TaskSearchFilters
  labelFilterIds: string[]
  activeFilterColor: string | null
  showCompleted: boolean
  listTabs: Array<{ id: string; name: string }>
}

interface ShoppingReturnsSectionProps {
  list: List | null
  items: List["todos"]
  showCompleted: boolean
  newItemName: string
  newStoreName: string
  newDeadline: string
  newNotes: string
  onNewItemNameChange: (value: string) => void
  onNewStoreNameChange: (value: string) => void
  onNewDeadlineChange: (value: string) => void
  onNewNotesChange: (value: string) => void
  onAddItem: () => void
  onToggleReturned: (todoId: string) => void
  onDeleteItem: (todoId: string) => void
  onUpdateItem: (todoId: string, updates: Partial<List["todos"][number]>) => void
}

function ShoppingReturnsSection({
  list,
  items,
  showCompleted,
  newItemName,
  newStoreName,
  newDeadline,
  newNotes,
  onNewItemNameChange,
  onNewStoreNameChange,
  onNewDeadlineChange,
  onNewNotesChange,
  onAddItem,
  onToggleReturned,
  onDeleteItem,
  onUpdateItem,
}: ShoppingReturnsSectionProps) {
  const todayKey = new Date().toISOString().split("T")[0]

  return (
    <div className="h-auto bg-transparent px-0 py-2">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex-1 text-right">
              <h3 className="lemonade-right-panel-heading font-heading text-[20px] leading-[20px] uppercase">Shopping Returns</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Track what needs to go back, where, and by when.
              </p>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {showCompleted ? "Returned items visible" : "Returned items hidden"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={newItemName}
              onChange={(event) => onNewItemNameChange(event.target.value)}
              placeholder="Item name"
              onKeyDown={(event) => event.key === "Enter" && onAddItem()}
            />
            <Input
              value={newStoreName}
              onChange={(event) => onNewStoreNameChange(event.target.value)}
              placeholder="Store name (optional)"
              onKeyDown={(event) => event.key === "Enter" && onAddItem()}
            />
            <Input
              type="date"
              value={newDeadline}
              onChange={(event) => onNewDeadlineChange(event.target.value)}
            />
            <Button onClick={onAddItem} className="md:justify-self-start">
              Add return
            </Button>
          </div>

          <textarea
            value={newNotes}
            onChange={(event) => onNewNotesChange(event.target.value)}
            placeholder="Notes (optional)"
            className="mt-3 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div>
          <div className="grid grid-cols-[minmax(82px,1.2fr)_minmax(78px,0.85fr)_minmax(96px,112px)_minmax(82px,1fr)_72px] gap-2 border-b border-border/70 px-4 py-3 text-[8.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <span className="min-w-0 truncate">Item</span>
            <span className="min-w-0 truncate">Store</span>
            <span className="min-w-0 truncate">Deadline</span>
            <span className="min-w-0 truncate">Notes</span>
            <span className="min-w-0 truncate text-right">Returned</span>
          </div>

          <div className="divide-y divide-border/60">
            {items.length > 0 || !list ? (
              <div className="flex flex-col">
                {Array.from({ length: Math.max(items.length, 9) }).map((_, index) => {
                  const todo = items[index]
                  if (!todo) {
                    return (
                      <div
                        key={`filler-returns-${index}`}
                        className="h-16 border-b border-[#e8e8ec] last:border-b-0 dark:border-white/15"
                      />
                    )
                  }
                  const isOverdue = !!todo.returnDeadline && !todo.completed && todo.returnDeadline < todayKey
                  return (
                    <div
                      key={todo.id}
                      className="grid grid-cols-[minmax(82px,1.2fr)_minmax(78px,0.85fr)_minmax(96px,112px)_minmax(82px,1fr)_72px] gap-2 border-b border-[#e8e8ec] px-4 py-4 last:border-b-0 dark:border-white/15"
                    >
                      <Input
                        value={todo.text}
                        onChange={(event) => onUpdateItem(todo.id, { text: event.target.value })}
                        placeholder="Item name"
                      />
                      <Input
                        value={todo.storeName ?? ""}
                        onChange={(event) =>
                          onUpdateItem(todo.id, { storeName: event.target.value || undefined })
                        }
                        placeholder="Store"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={todo.returnDeadline ?? ""}
                          onChange={(event) =>
                            onUpdateItem(todo.id, { returnDeadline: event.target.value || undefined })
                          }
                          className={cn(isOverdue && "border-destructive text-destructive")}
                        />
                        {isOverdue ? <AlertTriangle className="size-4 text-destructive" /> : null}
                      </div>
                      <Input
                        value={todo.notes ?? ""}
                        onChange={(event) => onUpdateItem(todo.id, { notes: event.target.value || undefined })}
                        placeholder="Notes"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleReturned(todo.id)}
                          className={cn(
                            "flex size-4 items-center justify-center rounded-full border border-border",
                            todo.completed && "border-foreground bg-foreground"
                          )}
                          aria-label={todo.completed ? "Mark as not returned" : "Mark as returned"}
                        >
                          {todo.completed ? (
                            <svg
                              className="size-2.5 text-background"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(todo.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete return"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No return items yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ListCard({ 
  list, 
  isDragging,
  onDelete, 
  onRename, 
  onMoveToTab,
  onAddListLeft,
  onAddListRight,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  newTodoText, 
  onNewTodoTextChange, 
  onAddTodo,
  searchQuery,
  searchModeActive,
  taskSearchFilters,
  labelFilterIds,
  activeFilterColor,
  showCompleted,
  listTabs,
}: ListCardProps) {
  const { moveCalendarTodoToList, moveListTodoToList } = useLemonadeStore()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(list.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [isTaskDropOver, setIsTaskDropOver] = useState(false)

  const handleSaveName = () => {
    if (editName.trim()) {
      onRename(editName.trim().toUpperCase())
    }
    setIsEditingName(false)
  }

  const handleShare = async () => {
    const shareText = [list.name, ...list.todos.map((todo) => `- ${todo.text}`)].join("\n")
    await navigator.clipboard.writeText(shareText)
  }

  const currentTabId = list.tabId ?? (list.type === "planning" ? "planning-tab" : "my-lists-tab")
  const visibleTodos = list.todos.filter((todo) =>
    todoMatchesSearchFilters(todo, {
      searchQuery,
      searchModeActive,
      taskSearchFilters,
      labelFilterIds,
      activeFilterColor,
      showCompleted,
    })
  )

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "lemonade-list-card group relative flex h-auto w-full min-w-0 flex-col self-stretch rounded-none bg-transparent px-0 py-1 transition-all",
        isDragging && "opacity-45",
        "hover:bg-transparent"
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/[0.015] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="relative z-20 mb-4 flex flex-col gap-2">
        <div className="flex justify-start">
          <button
            type="button"
            aria-label={`Drag ${list.name}`}
            className="cursor-grab text-muted-foreground/70 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
          >
            <Equal className="size-4" />
          </button>
        </div>

        <div className="flex items-start gap-2 min-w-0">
          <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open)
            if (!open) {
              setShowMoveMenu(false)
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              draggable={false}
              onDragStart={(event) => {
                // This button should never initiate list-card drag.
                event.preventDefault()
              }}
              className="mt-0.5 size-7 shrink-0 rounded-md opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="z-[90] w-[216px] overflow-visible rounded-2xl border border-border/70 border-b-[4px] border-b-[var(--accent-color)] px-2 py-2 shadow-xl"
          >
            <DropdownMenuLabel className="px-2 pb-3 pt-1 font-meta text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Manage List
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setIsEditingName(true)} className="px-2 py-3 text-[15px]">
              <PenLine className="size-4" />
              Rename
            </DropdownMenuItem>
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setShowMoveMenu((current) => !current)
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-3 text-left text-[15px] outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <span>Move to</span>
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
              </button>

              {showMoveMenu ? (
                <div className="absolute left-[calc(100%+10px)] top-0 z-[120] w-[200px] rounded-2xl border border-border/70 border-b-[4px] border-b-[var(--accent-color)] bg-popover px-2 py-2 shadow-xl">
                  <div className="px-2 pb-3 pt-1 font-meta text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Tabs
                  </div>
                  <div className="space-y-1">
                    {listTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          onMoveToTab(tab.id)
                          setShowMoveMenu(false)
                          setMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-3 rounded-sm px-2 py-3 text-left text-[15px] transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <span className="flex-1">{tab.name}</span>
                        {currentTabId === tab.id ? <Check className="size-4" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <DropdownMenuItem onClick={onAddListLeft} className="px-2 py-3 text-[15px]">
              <CornerUpLeft className="size-4" />
              Add list left
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddListRight} className="px-2 py-3 text-[15px]">
              <CornerUpRight className="size-4" />
              Add list right
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare} className="px-2 py-3 text-[15px]">
              <Link2 className="size-4" />
              Share
              <span className="ml-auto rounded-md bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">
                New
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="px-2 py-3 text-[15px]" variant="destructive">
              Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>

          <div className="min-w-0 flex-1 text-right">
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="lemonade-list-title w-full font-heading text-[20px] leading-[20px] bg-transparent outline-none border-b border-foreground uppercase"
                autoFocus
              />
            ) : (
              <h3 
                onClick={() => setIsEditingName(true)}
                className="lemonade-list-title font-heading text-[20px] leading-[20px] uppercase cursor-text hover:opacity-70"
              >
                {list.name}
              </h3>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "relative z-20 flex h-auto flex-col rounded-2xl border border-border/50 bg-transparent px-0 py-0",
          isTaskDropOver && "border-dashed border-[var(--accent-color)] bg-[color-mix(in_srgb,var(--accent-color)_8%,transparent)]"
        )}
        onDragOver={(event) => {
          const dragData = getPlannerTaskDragData(event as unknown as DragEvent<HTMLDivElement>)
          if (!dragData?.todoId) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = "move"
          setIsTaskDropOver(true)
        }}
        onDragLeave={() => setIsTaskDropOver(false)}
        onDrop={(event) => {
          const dragData = getPlannerTaskDragData(event as unknown as DragEvent<HTMLDivElement>)
          if (!dragData?.todoId) return
          event.preventDefault()
          event.stopPropagation()

          if (dragData.source === "calendar" || dragData.source === "timeline-timed" || dragData.source === "timeline-unscheduled") {
            moveCalendarTodoToList(dragData.todoId, list.id)
          } else if (dragData.source === "list" && dragData.listId) {
            if (dragData.listId !== list.id) {
              moveListTodoToList(dragData.listId, dragData.todoId, list.id)
            }
          }
          setIsTaskDropOver(false)
        }}
      >
        {Array.from({ length: Math.max(visibleTodos.length + 1, 9) }).map((_, index) => {
          const todo = visibleTodos[index]

          if (todo) {
            return (
              <div
                key={todo.id}
                className="border-b border-[#e8e8ec] px-2 last:border-b-0 dark:border-white/15"
              >
                <TodoItem
                  todo={todo}
                  listId={list.id}
                  textSizeClass="lemonade-task-text"
                  draggable
                  showInlineTaskActions
                  onDragStart={(event) => {
                    event.stopPropagation()
                    setPlannerTaskDragData(event, { todoId: todo.id, source: "list", listId: list.id })
                  }}
                  onDragEnd={(event) => {
                    event.stopPropagation()
                    setIsTaskDropOver(false)
                  }}
                />
              </div>
            )
          }

          const isInputRow = index === Math.min(visibleTodos.length, 8)

          return (
            <div key={`${list.id}-line-${index}`} className="group/add flex h-10 items-center gap-2 border-b border-[#e8e8ec] px-2 last:border-b-0 dark:border-white/15">
              <span className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover/add:opacity-100">
                <Plus className="size-3" />
              </span>
              {isInputRow ? (
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => onNewTodoTextChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddTodo()}
                  placeholder={list.todos.length === 0 && index === 0 ? "Add item..." : ""}
                  className="lemonade-list-item-text w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              ) : <div className="flex-1" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

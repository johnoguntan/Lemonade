"use client"

import { useRef, useState, type DragEvent } from "react"
import { useLemonadeStore, type List } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, MoreVertical, Trash2, Equal, PenLine, ArrowRight, CornerUpLeft, CornerUpRight, Link2, Check, ListTodo, AlertTriangle } from "lucide-react"
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
    labels,
    labelFilterIds,
    isCalendarExpanded,
    toggleCalendar
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const getListTabId = (list: List) =>
    list.tabId ?? (list.type === "planning" ? "planning-tab" : list.type === "shopping-returns" ? "shopping-returns-tab" : "my-lists-tab")

  const filteredLists = lists.filter((list) => getListTabId(list) === activeTabId)
  const shoppingReturnsList = lists.find((list) => list.id === "shopping-returns") ?? null
  const isShoppingReturnsTab = activeTabId === "shopping-returns-tab"
  const visibleShoppingReturns = (shoppingReturnsList?.todos ?? []).filter(
    (todo) => preferences.showCompleted || !todo.completed
  )
  const getTabCount = (tabId: string) => lists.filter((list) => getListTabId(list) === tabId).length
  const activeTab = listTabs.find((tab) => tab.id === activeTabId) ?? null
  const bottomDotGridStyle = preferences.showDotGridBackground
    ? {
        backgroundImage: "var(--dot-grid)",
        backgroundSize: "24px 24px",
        backgroundRepeat: "repeat",
      }
    : undefined

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

  const handleScroll = (direction: 'prev' | 'next' | 'prev-page' | 'next-page') => {
    const container = scrollRef.current
    if (!container) return

    const cardStep = 292
    const pageStep = Math.max(container.clientWidth - 120, cardStep)

    const left =
      direction === 'prev'
        ? container.scrollLeft - cardStep
        : direction === 'next'
          ? container.scrollLeft + cardStep
          : direction === 'prev-page'
            ? container.scrollLeft - pageStep
            : container.scrollLeft + pageStep

    container.scrollTo({ left, behavior: 'smooth' })
  }

  const handleManageListsInTab = () => {
    if (isCalendarExpanded) {
      toggleCalendar()
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
      className="relative z-20 mt-2 shrink-0 border-t border-border bg-background/90 transition-all duration-300 dark:bg-[rgba(13,13,13,0.9)]"
      style={bottomDotGridStyle}
    >
      {/* Tabs */}
      <div className={cn(
        "flex min-h-10 items-center px-2 py-1 gap-2 bg-background/90 dark:bg-[rgba(19,19,19,0.9)]",
        !isCalendarExpanded && "border-b border-border"
      )}
      style={bottomDotGridStyle}>
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

        {listTabs.map((tab, index) => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center border-r border-[#edf0f4]",
              index === 0 && "border-l border-[#edf0f4]"
            )}
          >
            <button
              onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "lemonade-tab-label relative mx-1 my-0.5 flex items-center gap-2 px-3 py-1.5 font-meta text-[10px] leading-[10px] uppercase tracking-[0.08em] transition-colors",
                activeTabId === tab.id
                  ? "text-foreground dark:bg-[#131313] dark:text-foreground"
                  : "text-[#a7a9ac] hover:rounded-2xl hover:bg-[#F2F3F5] hover:text-[#a7a9ac] dark:hover:bg-[#131315] dark:hover:text-foreground"
              )}
            >
              <span>{tab.name}</span>
              <span className="text-inherit/90">{getTabCount(tab.id)}</span>
              {activeTabId === tab.id ? (
                <span className="absolute inset-x-1 -bottom-[5px] h-[2px] bg-[var(--accent-color)]" />
              ) : null}
            </button>
          </div>
        ))}

        <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 ml-1" disabled={isShoppingReturnsTab}>
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

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCalendar}
          className="size-6"
        >
          {isCalendarExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {/* Lists Grid */}
      {!isCalendarExpanded ? (
        <div className="group/lists-nav relative border-b border-border bg-[rgba(247,248,250,0.9)] dark:bg-transparent">
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
          <div className="pointer-events-none absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-md border border-border bg-[rgba(247,248,250,0.9)] opacity-0 transition-opacity duration-200 group-hover/lists-nav:opacity-100 dark:bg-[rgba(13,13,13,0.9)]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScroll('prev')}
              className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-[15px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScroll('prev-page')}
              className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
            >
              <ChevronsLeft className="size-[15px]" />
            </Button>
          </div>

          <div
            ref={scrollRef}
            className="flex min-h-[500px] items-stretch gap-0 overflow-x-auto overflow-y-visible bg-[rgba(247,248,250,0.9)] px-0 py-0 scroll-smooth dark:bg-transparent"
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
                onDragStart={() => setDraggedListId(list.id)}
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
                onToggleTodo={(todoId) => toggleListTodo(list.id, todoId)}
                onDeleteTodo={(todoId) => deleteListTodo(list.id, todoId)}
                labels={labels}
                labelFilterIds={labelFilterIds}
                listTabs={listTabs}
              />
            ))}

            <button
              onClick={handleCreateList}
              className="flex min-h-[500px] w-[33.333%] min-w-[320px] shrink-0 items-center justify-center gap-2 self-stretch bg-[rgba(247,248,250,0.9)] p-6 text-muted-foreground transition-colors hover:text-foreground dark:bg-transparent"
            >
              <Plus className="size-4" />
              <span className="text-sm font-medium">NEW LIST</span>
            </button>
          </div>

          <div className="pointer-events-none absolute right-0 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-l-md border border-border bg-[rgba(247,248,250,0.9)] opacity-0 transition-opacity duration-200 group-hover/lists-nav:opacity-100 dark:bg-[rgba(13,13,13,0.9)]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScroll('next')}
              className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="size-[15px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScroll('next-page')}
              className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
            >
              <ChevronsRight className="size-[15px]" />
            </Button>
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
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: () => void
  newTodoText: string
  onNewTodoTextChange: (text: string) => void
  onAddTodo: () => void
  onToggleTodo: (todoId: string) => void
  onDeleteTodo: (todoId: string) => void
  labels: Array<{ id: string; name: string; color: string }>
  labelFilterIds: string[]
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
    <div className="min-h-[500px] bg-[rgba(247,248,250,0.9)] px-6 py-6 dark:bg-transparent">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm dark:bg-[rgba(19,19,19,0.9)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-heading text-[20px] leading-[20px] uppercase">Shopping Returns</h3>
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

        <div className="rounded-2xl border border-border/70 bg-background/90 shadow-sm dark:bg-[rgba(19,19,19,0.9)]">
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_150px_minmax(0,1.4fr)_70px] gap-3 border-b border-border/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Item</span>
            <span>Store</span>
            <span>Deadline</span>
            <span>Notes</span>
            <span className="text-right">Returned</span>
          </div>

          <div className="divide-y divide-border/60">
            {items.length > 0 ? (
              items.map((todo) => {
                const isOverdue = !!todo.returnDeadline && !todo.completed && todo.returnDeadline < todayKey

                return (
                  <div key={todo.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_150px_minmax(0,1.4fr)_70px] gap-3 px-5 py-4">
                    <Input
                      value={todo.text}
                      onChange={(event) => onUpdateItem(todo.id, { text: event.target.value })}
                      placeholder="Item name"
                    />
                    <Input
                      value={todo.storeName ?? ""}
                      onChange={(event) => onUpdateItem(todo.id, { storeName: event.target.value || undefined })}
                      placeholder="Store"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={todo.returnDeadline ?? ""}
                        onChange={(event) => onUpdateItem(todo.id, { returnDeadline: event.target.value || undefined })}
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
                          "size-4 rounded-full border border-border flex items-center justify-center",
                          todo.completed && "bg-foreground border-foreground"
                        )}
                      >
                        {todo.completed ? (
                          <svg className="size-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(todo.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                {list ? "No return items yet." : "Shopping returns list unavailable."}
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
  onToggleTodo,
  onDeleteTodo,
  labels,
  labelFilterIds,
  listTabs,
}: ListCardProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(list.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

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
    labelFilterIds.length === 0 || todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))
  )

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "lemonade-list-card group relative flex min-h-[500px] w-[33.333%] min-w-[320px] shrink-0 flex-col self-stretch bg-[rgba(247,248,250,0.95)] px-10 py-5 transition-all dark:bg-transparent",
        isDragging && "opacity-45",
        "hover:bg-[rgba(247,248,250,0.95)] dark:hover:bg-transparent"
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[#F2F3F5] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-[#131315]" />

      <div className="relative z-20 mb-4 flex flex-col gap-2">
        <div className="flex justify-center">
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

          <div className="min-w-0">
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="lemonade-list-title font-heading text-[20px] leading-[20px] bg-transparent outline-none border-b border-foreground uppercase"
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

      <div className="relative z-20 flex min-h-[360px] flex-1 flex-col">
        {Array.from({ length: 9 }).map((_, index) => {
          const todo = visibleTodos[index]

          if (todo) {
            return (
              <div key={todo.id} className="group/todo flex h-10 items-center gap-2 border-b border-[#e8e8ec] dark:border-[#2a2d34]">
                <button
                  onClick={() => onToggleTodo(todo.id)}
                  className={cn(
                    "size-4 rounded-full border border-border flex-shrink-0 flex items-center justify-center",
                    todo.completed && "bg-foreground border-foreground"
                  )}
                >
                  {todo.completed && (
                    <svg className="size-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "truncate text-sm text-foreground",
                    todo.completed && "line-through opacity-50"
                  )}>
                    {todo.text}
                  </div>
                  {todo.labelIds.length > 0 ? (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {todo.labelIds.slice(0, 2).map((labelId) => {
                        const label = labels.find((item) => item.id === labelId)
                        if (!label) return null

                        return (
                          <span
                            key={label.id}
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                            style={{ backgroundColor: label.color }}
                          >
                            {label.name}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={() => onDeleteTodo(todo.id)}
                  className="opacity-0 text-muted-foreground transition-opacity hover:text-destructive group-hover/todo:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )
          }

          const isInputRow = index === Math.min(visibleTodos.length, 8)

          return (
            <div key={`${list.id}-line-${index}`} className="flex h-10 items-center border-b border-[#e8e8ec] dark:border-[#2a2d34]">
              {isInputRow ? (
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => onNewTodoTextChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddTodo()}
                  placeholder={list.todos.length === 0 && index === 0 ? "Add item..." : ""}
                  className="lemonade-list-item-text w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useRef, useState, type DragEvent } from "react"
import { useLemonadeStore, type List } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, MoreVertical, Trash2, Equal, PenLine, ArrowRight, CornerUpLeft, CornerUpRight, Link2, Check, ListTodo } from "lucide-react"
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
    toggleListTodo, 
    deleteListTodo,
    preferences,
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
  const [draggedListId, setDraggedListId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const getListTabId = (list: List) =>
    list.tabId ?? (list.type === "planning" ? "planning-tab" : "my-lists-tab")

  const filteredLists = lists.filter((list) => getListTabId(list) === activeTabId)
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

  return (
    <div className={cn(
      "relative z-20 shrink-0 border-t border-border bg-background transition-all duration-300",
      preferences.showDotGridBackground && "journal-dot-grid"
    )}>
      {/* Tabs */}
      <div className={cn(
        "flex min-h-10 items-center px-2 py-1 gap-2 bg-background dark:bg-[#131313]",
        preferences.showDotGridBackground && "journal-dot-grid",
        !isCalendarExpanded && "border-b border-border"
      )}>
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
                "relative mx-1 my-0.5 flex items-center gap-2 px-3 py-1.5 font-meta text-[10px] leading-[10px] uppercase tracking-[0.08em] transition-colors",
                preferences.showDotGridBackground && "journal-dot-grid",
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
            <Button variant="ghost" size="icon" className="size-6 ml-1">
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
        <div className={cn(
          "group/lists-nav relative border-b border-border bg-[#f7f8fa] dark:bg-[#0d0d0d]",
          preferences.showDotGridBackground && "journal-dot-grid"
        )}>
          <div className={cn(
            "pointer-events-none absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-md border border-border bg-[#f7f8fa] opacity-0 transition-opacity duration-200 group-hover/lists-nav:opacity-100 dark:bg-[#0d0d0d]",
            preferences.showDotGridBackground && "journal-dot-grid"
          )}>
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
            className={cn(
              "flex min-h-[500px] items-stretch gap-0 overflow-x-auto overflow-y-visible bg-[#f7f8fa] px-0 py-0 scroll-smooth dark:bg-[#0d0d0d]",
              preferences.showDotGridBackground && "journal-dot-grid"
            )}
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
                listTabs={listTabs}
                showDotGridBackground={preferences.showDotGridBackground}
              />
            ))}

            <button
              onClick={handleCreateList}
              className={cn(
                "flex min-h-[500px] w-[33.333%] min-w-[320px] shrink-0 items-center justify-center gap-2 self-stretch bg-[#f7f8fa] p-6 text-muted-foreground transition-colors hover:text-foreground dark:bg-[#0d0d0d]",
                preferences.showDotGridBackground && "journal-dot-grid"
              )}
            >
              <Plus className="size-4" />
              <span className="text-sm font-medium">NEW LIST</span>
            </button>
          </div>

          <div className={cn(
            "pointer-events-none absolute right-0 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-l-md border border-border bg-[#f7f8fa] opacity-0 transition-opacity duration-200 group-hover/lists-nav:opacity-100 dark:bg-[#0d0d0d]",
            preferences.showDotGridBackground && "journal-dot-grid"
          )}>
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
        </div>
      ) : (
        <div className={cn(
          "h-0 overflow-hidden bg-background",
          preferences.showDotGridBackground && "journal-dot-grid"
        )} />
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
  listTabs: Array<{ id: string; name: string }>
  showDotGridBackground: boolean
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
  listTabs,
  showDotGridBackground,
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

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative flex min-h-[500px] w-[33.333%] min-w-[320px] shrink-0 flex-col self-stretch bg-[#f7f8fa] px-10 py-5 transition-all dark:bg-[#0d0d0d]",
        showDotGridBackground && "journal-dot-grid",
        isDragging && "opacity-45",
        "hover:bg-[#f7f8fa] dark:hover:bg-[#0d0d0d]"
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
                className="font-heading text-[20px] leading-[20px] bg-transparent outline-none border-b border-foreground uppercase"
                autoFocus
              />
            ) : (
              <h3 
                onClick={() => setIsEditingName(true)}
                className="font-heading text-[20px] leading-[20px] uppercase cursor-text hover:opacity-70"
              >
                {list.name}
              </h3>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-20 flex min-h-[360px] flex-1 flex-col">
        {Array.from({ length: 9 }).map((_, index) => {
          const todo = list.todos[index]

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
                <span className={cn(
                  "flex-1 truncate text-sm text-foreground",
                  todo.completed && "line-through opacity-50"
                )}>
                  {todo.text}
                </span>
                <button
                  onClick={() => onDeleteTodo(todo.id)}
                  className="opacity-0 text-muted-foreground transition-opacity hover:text-destructive group-hover/todo:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )
          }

          const isInputRow = index === Math.min(list.todos.length, 8)

          return (
            <div key={`${list.id}-line-${index}`} className="flex h-10 items-center border-b border-[#e8e8ec] dark:border-[#2a2d34]">
              {isInputRow ? (
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => onNewTodoTextChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddTodo()}
                  placeholder={list.todos.length === 0 && index === 0 ? "Add item..." : ""}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

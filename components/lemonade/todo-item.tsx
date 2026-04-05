"use client"

import { useEffect, useRef, useState } from "react"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RotateCcw, Plus, Minus, X, Moon, Sparkles, PencilLine, ArrowUp, Trash2, ChevronRight, ChevronDown, NotebookPen } from "lucide-react"
import { toast } from "sonner"
import { TASK_ICON_LIBRARY, TaskIcon } from "@/lib/task-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface TodoItemProps {
  todo: Todo
  autoFocus?: boolean
  textSizeClass: string
  isDragging?: boolean
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
}

export function TodoItem({
  todo,
  autoFocus = false,
  textSizeClass,
  isDragging = false,
  draggable = false,
  onDragStart,
  onDragEnd,
}: TodoItemProps) {
  const { 
    preferences, 
    clearLastCreatedTodoId,
    clearLastDeleted,
    toggleCalendarTodo, 
    toggleEndOfDay,
    updateCalendarTodo, 
    updateCalendarTodoInstance,
    deleteCalendarTodo,
    restoreLastDeletedTodo,
    addCalendarTodo,
    addSubtask,
    editSubtask,
    toggleSubtask,
    deleteSubtask,
    collapsedSubtasks,
    setSubtasksCollapsed,
    toggleSubtasksCollapsed,
    labels,
    addLabelToTask,
    removeLabelFromTask,
  } = useLemonadeStore()
  const colorPalette = preferences.colorPalette ?? []
  
  const [isEditing, setIsEditing] = useState(autoFocus)
  const [editText, setEditText] = useState(todo.text)
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [newSubtaskText, setNewSubtaskText] = useState("")
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [editingSubtaskText, setEditingSubtaskText] = useState("")
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [noteText, setNoteText] = useState(todo.notes ?? "")
  const [pendingRecurringUpdate, setPendingRecurringUpdate] = useState<Partial<Todo> | null>(null)
  const [customRecurrenceText, setCustomRecurrenceText] = useState(todo.recurringCustomText ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  const recurringValue = todo.isRecurring
    ? todo.recurringCustomText
      ? "custom"
      : (todo.recurringFrequency || "daily")
    : "off"

  const priorityIndicator = {
    high: <span className="size-2 rounded-full bg-red-500 mr-2 flex-shrink-0" />,
    medium: <span className="size-2 rounded-full bg-orange-500 mr-2 flex-shrink-0" />,
    low: <span className="size-2 rounded-full bg-blue-500 mr-2 flex-shrink-0" />,
    none: null,
  }[todo.priority || 'none']
  const isLocalOnly = todo.syncStatus === "local"

  const handleSave = () => {
    const trimmedText = editText.trim()

    if (trimmedText) {
      const isHeading = trimmedText === trimmedText.toUpperCase() && trimmedText.length > 2

      updateCalendarTodo(todo.id, { text: trimmedText, isHeading })
    }
    setIsEditing(false)
  }

  const openSubtaskComposer = () => {
    setIsAddingSubtask(true)
    setSubtasksCollapsed(todo.id, false)
  }

  const handleAddSubtask = () => {
    const trimmed = newSubtaskText.trim()

    if (!trimmed) {
      setNewSubtaskText("")
      setIsAddingSubtask(false)
      return
    }

    addSubtask(todo.id, trimmed)
    setNewSubtaskText("")
    setIsAddingSubtask(false)
    setSubtasksCollapsed(todo.id, false)
  }

  const closeSubtaskComposer = () => {
    setNewSubtaskText("")
    setIsAddingSubtask(false)
  }

  const handleStartEditingSubtask = (subtaskId: string, title: string) => {
    setEditingSubtaskId(subtaskId)
    setEditingSubtaskText(title)
  }

  const handleSaveSubtask = () => {
    if (!editingSubtaskId) {
      return
    }

    const trimmedTitle = editingSubtaskText.trim()
    const shouldHideComposer = todo.subtasks.length <= 1 && !trimmedTitle

    if (!trimmedTitle) {
      deleteSubtask(todo.id, editingSubtaskId)
    } else {
      editSubtask(todo.id, editingSubtaskId, trimmedTitle)
    }

    setEditingSubtaskId(null)
    setEditingSubtaskText("")

    if (shouldHideComposer) {
      setSubtasksCollapsed(todo.id, true)
    }
  }

  const toggleLabel = (labelId: string) => {
    if (todo.labelIds.includes(labelId)) {
      removeLabelFromTask(todo.id, labelId)
      return
    }

    addLabelToTask(todo.id, labelId)
  }

  const handleRecurringChange = (updates: Partial<Todo>) => {
    if (!todo.parentId) {
      updateCalendarTodo(todo.id, updates)
      toast("Series updated", { duration: 2000 })
      return
    }

    setPendingRecurringUpdate(updates)
  }

  const handleApplyCustomRecurrence = () => {
    const trimmed = customRecurrenceText.trim()

    if (!trimmed) {
      handleRecurringChange({
        isRecurring: false,
        recurringFrequency: undefined,
        recurringDays: undefined,
        recurringInterval: undefined,
        recurringCustomText: undefined,
      })
      return
    }

    const normalized = trimmed.toLowerCase()
    const dayMatches = [...normalized.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)]
    const recurringDays = dayMatches
      .map((match) => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(match[1]))
      .filter((day) => day >= 0)
    const intervalMatch = normalized.match(/\bevery\s+(\d+)\s+(day|days|week|weeks|month|months)\b/)
    const recurringInterval = intervalMatch ? Math.max(1, Number.parseInt(intervalMatch[1], 10) || 1) : 1

    let recurringFrequency: Todo["recurringFrequency"] | undefined = "weekly"
    if (/\bweekday\b/.test(normalized)) {
      recurringFrequency = "weekday"
    } else if (/\bmonth|months|monthly\b/.test(normalized)) {
      recurringFrequency = "monthly"
    } else if (/\bday|days|daily\b/.test(normalized) && recurringDays.length === 0) {
      recurringFrequency = "daily"
    }

    handleRecurringChange({
      isRecurring: true,
      recurringFrequency,
      recurringDays: recurringDays.length > 0 ? recurringDays : undefined,
      recurringInterval: recurringInterval > 1 ? recurringInterval : undefined,
      recurringCustomText: trimmed,
    })
  }

  const handlePromoteSubtask = (subtaskId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) {
      return
    }

    addCalendarTodo({
      text: trimmed,
      completed: false,
      date: todo.date,
      priority: todo.priority,
      labelIds: todo.labelIds,
    })
    const shouldHideComposer = todo.subtasks.length <= 1 && newSubtaskText.trim().length === 0
    deleteSubtask(todo.id, subtaskId)
    if (shouldHideComposer) {
      setSubtasksCollapsed(todo.id, true)
    }
    toast("Subtask promoted", { duration: 2000 })
  }

  const handleDelete = () => {
    deleteCalendarTodo(todo.id)
    const deleteToken = useLemonadeStore.getState().lastDeleted?.token

    toast("Task deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => restoreLastDeletedTodo(),
      },
    })

    if (deleteToken) {
      window.setTimeout(() => {
        clearLastDeleted(deleteToken)
      }, 5000)
    }
  }

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus()
      clearLastCreatedTodoId()
    })
  }, [autoFocus, clearLastCreatedTodoId])

  const openNotes = () => {
    setNoteText(todo.notes ?? "")
    setIsNotesOpen(true)
  }

  const handleSaveNotes = () => {
    const trimmed = noteText.trim()
    updateCalendarTodo(todo.id, { notes: trimmed.length > 0 ? trimmed : undefined })
    setIsNotesOpen(false)
  }

  const completedSubtaskCount = todo.subtasks.filter((subtask) => subtask.completed).length
  const hasCustomColor = Boolean(todo.color)
  const hasSubtasks = todo.subtasks.length > 0
  const areSubtasksCollapsed = collapsedSubtasks[todo.id] ?? true
  const showSubtasks = !areSubtasksCollapsed || isAddingSubtask || editingSubtaskId !== null
  const hasNote = (todo.notes ?? "").trim().length > 0

  if (todo.isHeading) {
    return (
        <div 
          className={cn(
          "lemonade-heading-row font-bold uppercase tracking-wide h-[40px] flex items-center px-2",
          textSizeClass
        )}
        style={{ backgroundColor: todo.color }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            spellCheck
            autoCorrect="on"
            autoCapitalize="sentences"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => handleSave()}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full bg-transparent outline-none"
            autoFocus
          />
        ) : (
          <span onClick={() => setIsEditing(true)} className="cursor-text">
            {todo.text}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn("group relative transition-opacity", isDragging && "opacity-40")}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
        <div 
        className={cn(
          "lemonade-task-row flex items-start px-0 py-2 transition-colors",
          todo.completed && "bg-transparent",
          todo.isSyncing && "animate-pulse"
        )}
        style={{ backgroundColor: todo.color }}
      >
        <div className="flex min-h-[52px] items-center justify-center w-5 mr-2">
          <button
            onClick={() => toggleCalendarTodo(todo.id)}
            className={cn(
              "size-4 rounded-full border transition-all flex items-center justify-center shrink-0",
              todo.completed 
                ? "bg-[var(--accent-color)] border-[var(--accent-color)] opacity-100" 
                : "border-[var(--accent-color)] opacity-0 group-hover:opacity-100"
            )}
            style={{ borderColor: todo.completed ? 'var(--accent-color)' : 'rgba(var(--accent-color-rgb), 0.3)' }}
          >
            {todo.completed && (
              <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex min-w-0 items-center">
            {priorityIndicator}
            {todo.icon ? <TaskIcon icon={todo.icon} className="mr-2 size-4 text-muted-foreground" /> : null}
            {todo.isSyncing ? (
              <Sparkles className="mr-2 size-3.5 text-[var(--accent-color)]" />
            ) : isLocalOnly ? (
              <PencilLine className="mr-2 size-3.5 text-muted-foreground" />
            ) : null}
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => handleSave()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSave()
                  }
                }}
                className={cn(
                  "lemonade-task-text w-full bg-transparent outline-none font-task font-normal text-[14px] leading-[1.15] text-[#000000]",
                  !hasCustomColor && "dark:text-foreground",
                  todo.completed && "line-through opacity-40"
                )}
                autoFocus
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className={cn(
                  "lemonade-task-text cursor-text block font-task font-normal text-[14px] leading-[1.15] text-[#000000]",
                  !hasCustomColor && "dark:text-foreground",
                  todo.completed && "line-through opacity-40"
                )}
              >
                {todo.text}
              </span>
            )}
            {hasSubtasks && (
              <button
                type="button"
                onClick={() => toggleSubtasksCollapsed(todo.id)}
                className="ml-2 inline-flex items-center gap-1 rounded-full text-[10px] font-medium text-muted-foreground hover:text-foreground"
                aria-label={areSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"}
              >
                {areSubtasksCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                <span>{areSubtasksCollapsed ? `${todo.subtasks.length} subtasks` : `${completedSubtaskCount}/${todo.subtasks.length}`}</span>
              </button>
            )}
            {hasNote && (
              <button
                type="button"
                onClick={() => (isNotesOpen ? setIsNotesOpen(false) : openNotes())}
                className="ml-2 inline-flex items-center gap-1 rounded-full text-[10px] font-medium text-muted-foreground hover:text-foreground"
                aria-label={isNotesOpen ? "Hide note" : "Show note"}
              >
                <NotebookPen className="size-3" />
                <span>Note</span>
              </button>
            )}
          </div>
          {/* Tag Pills */}
          {todo.labelIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {todo.labelIds.map((labelId) => {
                const label = labels.find((item) => item.id === labelId)
                if (!label) return null
                return (
                  <span 
                    key={labelId} 
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white shadow-sm"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                )
              })}
            </div>
          )}
          {todo.isSyncing ? (
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Syncing...
            </div>
          ) : isLocalOnly ? (
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Local
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[52px] items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (isNotesOpen ? setIsNotesOpen(false) : openNotes())}
            className={cn(
              "size-7 hover:bg-transparent",
              hasNote ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={isNotesOpen ? "Hide notes" : hasNote ? "Show notes" : "Add note"}
          >
            <NotebookPen className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleEndOfDay(todo.id)}
            className={cn(
              "size-7 hover:bg-transparent",
              todo.endOfDay
                ? "text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={todo.endOfDay ? { backgroundColor: "var(--accent-color)" } : undefined}
            aria-label={todo.endOfDay ? "Unset end of day" : "Set end of day"}
          >
            <Moon className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-transparent"
              >
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openSubtaskComposer}>
                <Plus className="size-4 mr-2" />
                Add subtask
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RotateCcw className="size-4 mr-2" />
                  Recurring
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Repeat</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={recurringValue}>
                    <DropdownMenuRadioItem
                      value="off"
                      onSelect={() => handleRecurringChange({
                        isRecurring: false,
                        recurringFrequency: undefined,
                        recurringDays: undefined,
                        recurringInterval: undefined,
                        recurringCustomText: undefined,
                      })}
                    >
                      Off
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="daily"
                      onSelect={() => handleRecurringChange({
                        isRecurring: true,
                        recurringFrequency: "daily",
                        recurringDays: undefined,
                        recurringInterval: undefined,
                        recurringCustomText: undefined,
                      })}
                    >
                      Daily
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="weekday"
                      onSelect={() => handleRecurringChange({
                        isRecurring: true,
                        recurringFrequency: "weekday",
                        recurringDays: undefined,
                        recurringInterval: undefined,
                        recurringCustomText: undefined,
                      })}
                    >
                      Weekdays
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="weekly"
                      onSelect={() => handleRecurringChange({
                        isRecurring: true,
                        recurringFrequency: "weekly",
                        recurringDays: undefined,
                        recurringInterval: undefined,
                        recurringCustomText: undefined,
                      })}
                    >
                      Weekly
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="monthly"
                      onSelect={() => handleRecurringChange({
                        isRecurring: true,
                        recurringFrequency: "monthly",
                        recurringDays: undefined,
                        recurringInterval: undefined,
                        recurringCustomText: undefined,
                      })}
                    >
                      Monthly
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <div className="space-y-2 px-2 pb-2 pt-1">
                    <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Custom
                    </div>
                    <input
                      type="text"
                      spellCheck
                      autoCorrect="on"
                      autoCapitalize="sentences"
                      value={customRecurrenceText}
                      onChange={(event) => setCustomRecurrenceText(event.target.value)}
                      placeholder="Every Tuesday and Thursday"
                      className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[11px] outline-none"
                    />
                    <Button type="button" size="sm" className="h-7 w-full text-[11px]" onClick={handleApplyCustomRecurrence}>
                      Apply custom repeat
                    </Button>
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Priority</div>
              <div className="flex gap-1 px-2 pb-2">
                {(['none', 'low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateCalendarTodo(todo.id, { priority: p })}
                    className={cn(
                      "px-2 py-1 text-[10px] rounded border border-border capitalize transition-colors",
                      todo.priority === p || (!todo.priority && p === 'none')
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Icon</div>
              <div className="px-2 pb-2">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => updateCalendarTodo(todo.id, { icon: undefined })}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      !todo.icon && "bg-muted text-foreground"
                    )}
                  >
                    Clear
                  </button>
                  {todo.icon ? <TaskIcon icon={todo.icon} className="size-4 text-muted-foreground" /> : null}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {TASK_ICON_LIBRARY.map(({ key, label, Icon }) => {
                    const selected = todo.icon === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateCalendarTodo(todo.id, { icon: key })}
                        className={cn(
                          "flex items-center justify-center rounded-lg border border-border/70 p-2 transition-colors hover:bg-muted",
                          selected && "border-transparent bg-foreground text-background hover:bg-foreground"
                        )}
                        title={label}
                        aria-label={label}
                      >
                        <Icon className="size-4" />
                      </button>
                    )
                  })}
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Labels</div>
              <div className="px-2 pb-2">
                <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                  {labels.length > 0 ? (
                    labels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => toggleLabel(label.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                          todo.labelIds.includes(label.id)
                            ? "text-white"
                            : "bg-transparent text-muted-foreground hover:text-foreground border-border"
                        )}
                        style={{ 
                          backgroundColor: todo.labelIds.includes(label.id) ? label.color : 'transparent',
                          borderColor: todo.labelIds.includes(label.id) ? label.color : undefined
                        }}
                      >
                        {label.name}
                      </button>
                    ))
                  ) : (
                    <div className="text-[10px] text-muted-foreground italic">No labels created yet</div>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Color</div>
              <div className="flex gap-1 px-2 pb-2">
                <button
                  onClick={() => updateCalendarTodo(todo.id, { color: undefined })}
                  className={cn(
                    "size-5 rounded border border-border bg-transparent",
                    !todo.color && "ring-2 ring-foreground"
                  )}
                  title="None"
                />
                {colorPalette.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateCalendarTodo(todo.id, { color: hex })}
                    className={cn(
                      "size-5 rounded border border-border",
                      todo.color === hex && "ring-2 ring-foreground"
                    )}
                    style={{ backgroundColor: hex }}
                    title={hex.toUpperCase()}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="size-7 text-muted-foreground hover:text-destructive hover:bg-transparent group/delete"
          >
            <Minus className="size-4 group-hover/delete:hidden" />
            <X className="size-4 hidden group-hover/delete:block" />
          </Button>
        </div>
      </div>

      {isNotesOpen ? (
        <div className="ml-7 mt-1">
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Write a note..."
            className="w-full resize-none rounded-md border border-border/60 bg-transparent px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            rows={3}
            spellCheck
            autoCorrect="on"
            autoCapitalize="sentences"
            autoFocus={!hasNote}
          />
        </div>
      ) : !hasNote ? (
        <div className="ml-7 mt-0.5">
          <button
            type="button"
            onClick={openNotes}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            <NotebookPen className="size-3" />
            <span>Add note</span>
          </button>
        </div>
      ) : null}

      {/* Subtasks */}
      {showSubtasks && (
        <div className="ml-0">
          {todo.subtasks.map((subtask) => (
            <div key={subtask.id} className="lemonade-subtask-row h-[48px] flex items-center gap-2 px-0 pl-7 group/subtask transition-colors">
              <button
                onClick={() => toggleSubtask(todo.id, subtask.id)}
                className={cn(
                  "size-4 rounded-full border border-border flex-shrink-0 flex items-center justify-center",
                  subtask.completed && "bg-foreground border-foreground"
                )}
              >
                {subtask.completed && (
                  <svg className="size-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              {editingSubtaskId === subtask.id ? (
                <input
                  type="text"
                  spellCheck
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  value={editingSubtaskText}
                  onChange={(event) => setEditingSubtaskText(event.target.value)}
                  onBlur={handleSaveSubtask}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSaveSubtask()
                    } else if (event.key === "Escape") {
                      setEditingSubtaskId(null)
                      setEditingSubtaskText("")
                    }
                  }}
                  className="lemonade-task-text bg-transparent outline-none flex-1 font-task font-normal text-[14px] leading-[16.3338px] text-[#000000] dark:text-foreground"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartEditingSubtask(subtask.id, subtask.title)}
                  className={cn(
                    "lemonade-task-text flex-1 text-left font-task font-normal text-[14px] leading-[16.3338px] text-[#000000] dark:text-foreground",
                    subtask.completed && "line-through opacity-50"
                  )}
                >
                  {subtask.title}
                </button>
              )}
              <button
                type="button"
                onClick={() => handlePromoteSubtask(subtask.id, subtask.title)}
                className="opacity-0 group-hover/subtask:opacity-100 text-muted-foreground hover:text-foreground"
                title="Promote to task"
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const shouldHideComposer = todo.subtasks.length <= 1 && newSubtaskText.trim().length === 0
                  deleteSubtask(todo.id, subtask.id)
                  if (shouldHideComposer) {
                    setSubtasksCollapsed(todo.id, true)
                  }
                }}
                className="opacity-0 group-hover/subtask:opacity-100 text-muted-foreground hover:text-destructive"
                title="Delete subtask"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {isAddingSubtask && (
            <div className="lemonade-subtask-row h-[48px] flex items-center gap-2 px-0 pl-7">
              <Plus className="size-3 text-muted-foreground" />
              <input
                type="text"
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onBlur={closeSubtaskComposer}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddSubtask()
                  } else if (e.key === "Escape") {
                    closeSubtaskComposer()
                  }
                }}
                placeholder="Add subtask..."
                className="lemonade-task-text bg-transparent outline-none flex-1 font-task font-normal text-[14px] leading-[1.15] text-[#000000] dark:text-foreground"
                autoFocus
              />
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={pendingRecurringUpdate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRecurringUpdate(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit recurring task</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to change this task only, or this and all future tasks?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRecurringUpdate(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingRecurringUpdate) return
                updateCalendarTodoInstance(todo.id, pendingRecurringUpdate)
                setPendingRecurringUpdate(null)
              }}
            >
              This task only
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (!pendingRecurringUpdate) return
                updateCalendarTodo(todo.id, pendingRecurringUpdate)
                toast("Series updated", { duration: 2000 })
                setPendingRecurringUpdate(null)
              }}
            >
              All future tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

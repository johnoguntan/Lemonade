"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { normalizeTodoPriority, useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RotateCcw, Plus, Minus, X, Moon, Sparkles, ArrowUp, Trash2, ChevronRight, ChevronDown, NotebookPen, Link2, Paperclip, Bell, ListChecks, AlertTriangle, Tag, Palette, Shapes } from "lucide-react"
import { toast } from "sonner"
import { TASK_ICON_LIBRARY, TaskIcon } from "@/lib/task-icons"
import { ColorPickerPanel } from "@/components/lemonade/color-picker-panel"
import {
  DropdownMenu,
  DropdownMenuContent,
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

const ATTACHMENT_PREFIX = "Attachment: "

const isStructuredLinkValue = (value: string) => {
  const normalized = value.trim()

  return (
    /^https?:\/\//i.test(normalized) ||
    /^www\./i.test(normalized) ||
    /^tel:/i.test(normalized) ||
    /^\+?[\d()\-\s]{6,}$/.test(normalized)
  )
}

const parseStructuredTaskNotes = (notes?: string) => {
  const lines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const attachments: string[] = []
  const remainder: string[] = []
  let link = ""

  for (const line of lines) {
    if (line.startsWith(ATTACHMENT_PREFIX)) {
      const attachmentName = line.slice(ATTACHMENT_PREFIX.length).trim()
      if (attachmentName) {
        attachments.push(attachmentName)
      }
      continue
    }

    if (!link && isStructuredLinkValue(line)) {
      link = line
      continue
    }

    remainder.push(line)
  }

  return { link, attachments, remainder }
}

const composeStructuredTaskNotes = ({
  sourceNotes,
  link,
  attachments,
}: {
  sourceNotes?: string
  link: string
  attachments: string[]
}) => {
  const parsed = parseStructuredTaskNotes(sourceNotes)
  const lines: string[] = []
  const trimmedLink = link.trim()

  if (trimmedLink) {
    lines.push(trimmedLink)
  }

  lines.push(...parsed.remainder)

  attachments.forEach((attachment) => {
    const trimmedAttachment = attachment.trim()
    if (trimmedAttachment) {
      lines.push(`${ATTACHMENT_PREFIX}${trimmedAttachment}`)
    }
  })

  const joined = lines.join("\n").trim()
  return joined.length > 0 ? joined : undefined
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
    setPreferences,
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
  const [showReminderEditor, setShowReminderEditor] = useState(false)
  const [reminderCustomMinutes, setReminderCustomMinutes] = useState("")
  const [linkDraft, setLinkDraft] = useState("")
  const [attachmentDrafts, setAttachmentDrafts] = useState<string[]>([])
  const [taskMenuOpen, setTaskMenuOpen] = useState(false)
  const [activeToolPanel, setActiveToolPanel] = useState<
    "reminder" | "subtasks" | "link" | "priority" | "icon" | "labels" | "color" | "attachment" | null
  >(null)
  const [pendingRecurringUpdate, setPendingRecurringUpdate] = useState<Partial<Todo> | null>(null)
  const [customRecurrenceText, setCustomRecurrenceText] = useState(todo.recurringCustomText ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const recurringValue = todo.isRecurring
    ? todo.recurringCustomText
      ? "custom"
      : (todo.recurringFrequency || "daily")
    : "off"

  const resolvedPriority = normalizeTodoPriority(todo.priority)
  const priorityIndicator = {
    urgent: <span className="mr-2 size-2 rounded-full bg-red-500 shrink-0" />,
    important: <span className="mr-2 size-2 rounded-full bg-amber-500 shrink-0" />,
    normal: <span className="mr-2 size-2 rounded-full bg-border shrink-0" />,
  }[resolvedPriority]
  const priorityPillClasses = {
    urgent: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    important: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    normal: "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground",
  } as const
  const nextPriority = {
    normal: "important",
    important: "urgent",
    urgent: "normal",
  } as const
  const priorityLabels = {
    urgent: "Urgent",
    important: "Important",
    normal: "Normal",
  } as const
  const structuredNotes = useMemo(() => parseStructuredTaskNotes(todo.notes), [todo.notes])
  const reminderLabel = typeof todo.reminderOffsetMinutes === "number"
    ? todo.reminderOffsetMinutes === 0
      ? "At time"
      : `${todo.reminderOffsetMinutes}m`
    : "Alert"
  const reminderPresetOptions = [
    { label: "None", value: null },
    { label: "At time of event", value: 0 },
    { label: "5 minutes before", value: 5 },
    { label: "10 minutes before", value: 10 },
    { label: "15 minutes before", value: 15 },
    { label: "30 minutes before", value: 30 },
    { label: "1 hour before", value: 60 },
    { label: "2 hours before", value: 120 },
    { label: "1 day before", value: 1440 },
  ] as const

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

  const persistStructuredNotes = (nextLink: string, nextAttachments: string[]) => {
    const sourceNotes = isNotesOpen ? noteText : todo.notes
    const nextNotes = composeStructuredTaskNotes({
      sourceNotes,
      link: nextLink,
      attachments: nextAttachments,
    })

    updateCalendarTodo(todo.id, { notes: nextNotes })

    if (isNotesOpen) {
      setNoteText(nextNotes ?? "")
    }
  }

  const openLinkEditor = () => {
    setLinkDraft(structuredNotes.link)
    setAttachmentDrafts(structuredNotes.attachments)
  }

  const handleSaveLink = () => {
    persistStructuredNotes(linkDraft, attachmentDrafts.length > 0 ? attachmentDrafts : structuredNotes.attachments)
  }

  const handleAttachmentPick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const nextAttachments = [...structuredNotes.attachments, ...files.map((file) => file.name)]
    setAttachmentDrafts(nextAttachments)
    persistStructuredNotes(structuredNotes.link, nextAttachments)
    event.target.value = ""
  }

  const handleClearStructuredLink = () => {
    setLinkDraft("")
    persistStructuredNotes("", structuredNotes.attachments)
  }

  const handleRemoveAttachment = (attachmentName: string) => {
    const nextAttachments = structuredNotes.attachments.filter((attachment) => attachment !== attachmentName)
    setAttachmentDrafts(nextAttachments)
    persistStructuredNotes(structuredNotes.link, nextAttachments)
  }

  const applyReminderOffset = (minutes: number | null) => {
    updateCalendarTodo(todo.id, { reminderOffsetMinutes: minutes })
    setShowReminderEditor(false)
    setReminderCustomMinutes("")
  }

  const handleOpenToolPanel = (
    panel: "reminder" | "subtasks" | "link" | "priority" | "icon" | "labels" | "color" | "attachment"
  ) => {
    setTaskMenuOpen(true)
    setActiveToolPanel(panel)

    if (panel === "link") {
      openLinkEditor()
    }

    if (panel === "attachment") {
      setAttachmentDrafts(structuredNotes.attachments)
    }
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
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex min-w-0 items-center">
            <button
              onClick={() => toggleCalendarTodo(todo.id)}
              className={cn(
                "mr-2 size-4 rounded-full border transition-all flex items-center justify-center shrink-0",
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
            {priorityIndicator}
            {todo.icon ? <TaskIcon icon={todo.icon} className="mr-2 size-4 text-muted-foreground" /> : null}
            {todo.isSyncing ? <Sparkles className="mr-2 size-3.5 text-[var(--accent-color)]" /> : null}
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
          ) : null}
        </div>

        <div className="flex min-h-[52px] items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateCalendarTodo(todo.id, { priority: nextPriority[resolvedPriority] })}
            className={cn(
              "h-7 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
              priorityPillClasses[resolvedPriority]
            )}
            aria-label={`Priority ${priorityLabels[resolvedPriority]}. Click to cycle priority.`}
          >
            {priorityLabels[resolvedPriority]}
          </Button>

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

          <DropdownMenu
            open={taskMenuOpen}
            onOpenChange={(open) => {
              setTaskMenuOpen(open)
              if (!open) {
                setActiveToolPanel(null)
                setShowReminderEditor(false)
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-transparent"
              >
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px] max-w-[calc(100vw-24px)] p-0">
              <div className="grid grid-cols-8 gap-1 border-b border-border/60 px-2 py-2">
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("reminder")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "reminder" && "bg-muted text-foreground",
                    typeof todo.reminderOffsetMinutes === "number" && activeToolPanel !== "reminder" && "text-foreground"
                  )}
                  title="Reminder"
                >
                  <Bell className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("subtasks")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "subtasks" && "bg-muted text-foreground"
                  )}
                  title="Add subtask"
                >
                  <ListChecks className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("link")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "link" && "bg-muted text-foreground",
                    structuredNotes.link && activeToolPanel !== "link" && "text-foreground"
                  )}
                  title="URL or phone"
                >
                  <Link2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("priority")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted",
                    activeToolPanel === "priority" && "bg-muted",
                    resolvedPriority === "urgent"
                      ? "text-red-500"
                      : resolvedPriority === "important"
                        ? "text-amber-500"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Priority"
                >
                  <AlertTriangle className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("icon")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "icon" && "bg-muted text-foreground",
                    todo.icon && activeToolPanel !== "icon" && "text-foreground"
                  )}
                  title="Icon"
                >
                  <Shapes className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("labels")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "labels" && "bg-muted text-foreground",
                    todo.labelIds.length > 0 && activeToolPanel !== "labels" && "text-foreground"
                  )}
                  title="Labels"
                >
                  <Tag className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("color")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "color" && "bg-muted text-foreground",
                    todo.color && activeToolPanel !== "color" && "text-foreground"
                  )}
                  title="Color"
                >
                  <Palette className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("attachment")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeToolPanel === "attachment" && "bg-muted text-foreground",
                    structuredNotes.attachments.length > 0 && activeToolPanel !== "attachment" && "text-foreground"
                  )}
                  title="Attachment"
                >
                  <Paperclip className="size-4" />
                </button>
              </div>

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
              {activeToolPanel ? <DropdownMenuSeparator /> : null}
              {activeToolPanel === "reminder" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Reminder</div>
                    <button
                      type="button"
                      onClick={() => setShowReminderEditor((current) => !current)}
                      className="inline-flex rounded-full border border-border/70 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {showReminderEditor ? "Hide custom" : reminderLabel}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {reminderPresetOptions.map((option) => {
                      const active = todo.reminderOffsetMinutes === option.value
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => applyReminderOffset(option.value)}
                          className={cn(
                            "rounded-lg border border-border/70 px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted",
                            active && "border-transparent bg-foreground text-background hover:bg-foreground"
                          )}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  {showReminderEditor ? (
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="numeric"
                        value={reminderCustomMinutes}
                        onChange={(event) => setReminderCustomMinutes(event.target.value.replace(/[^\d]/g, ""))}
                        placeholder="Minutes before"
                        className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[11px] outline-none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-[11px]"
                        onClick={() => {
                          const minutes = Number(reminderCustomMinutes)
                          if (!Number.isFinite(minutes) || minutes < 0) return
                          applyReminderOffset(minutes)
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeToolPanel === "subtasks" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="text-sm font-medium">Subtasks</div>
                  <Button type="button" size="sm" className="h-8 w-full text-[11px]" onClick={openSubtaskComposer}>
                    <Plus className="mr-2 size-3.5" />
                    Add subtask
                  </Button>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    Add a checklist item and it will appear right under this task.
                  </p>
                </div>
              ) : null}

              {activeToolPanel === "link" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">URL / Phone</div>
                    {structuredNotes.link ? (
                      <button
                        type="button"
                        onClick={handleClearStructuredLink}
                        className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    spellCheck={false}
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                    placeholder="Paste a URL or phone number"
                    className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[11px] outline-none"
                  />
                  <Button type="button" size="sm" className="h-8 w-full text-[11px]" onClick={handleSaveLink}>
                    Save link
                  </Button>
                </div>
              ) : null}

              {activeToolPanel === "priority" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="text-sm font-medium">Priority</div>
                  <div className="flex flex-wrap gap-2">
                    {(["urgent", "important", "normal"] as const).map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => updateCalendarTodo(todo.id, { priority })}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                          priority === "urgent"
                            ? todo.priority === "urgent"
                              ? "border-red-500 bg-red-500 text-white"
                              : "border-red-200 text-red-700 hover:bg-red-50"
                            : priority === "important"
                              ? todo.priority === "important"
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-amber-200 text-amber-700 hover:bg-amber-50"
                              : resolvedPriority === "normal"
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeToolPanel === "icon" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Icon</div>
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
                  </div>
                  <div className="grid grid-cols-5 gap-2">
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
              ) : null}

              {activeToolPanel === "labels" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="text-sm font-medium">Labels</div>
                  <div className="flex max-h-[160px] flex-wrap gap-1 overflow-y-auto">
                    {labels.length > 0 ? (
                      labels.map((label) => (
                        <button
                          key={label.id}
                          onClick={() => toggleLabel(label.id)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                            todo.labelIds.includes(label.id)
                              ? "text-white"
                              : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                          )}
                          style={{
                            backgroundColor: todo.labelIds.includes(label.id) ? label.color : "transparent",
                            borderColor: todo.labelIds.includes(label.id) ? label.color : undefined,
                          }}
                        >
                          {label.name}
                        </button>
                      ))
                    ) : (
                      <div className="text-[10px] italic text-muted-foreground">No labels created yet</div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeToolPanel === "color" ? (
                <div className="space-y-3 px-2 py-2">
                  <ColorPickerPanel
                    value={todo.color}
                    palette={colorPalette}
                    onChange={(color) => updateCalendarTodo(todo.id, { color })}
                    onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                    onClear={() => updateCalendarTodo(todo.id, { color: undefined })}
                    description="Pick a saved swatch or open the system color wheel for a custom task color."
                  />
                </div>
              ) : null}

              {activeToolPanel === "attachment" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Attachments</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => attachmentInputRef.current?.click()}
                    >
                      <Paperclip className="mr-1.5 size-3.5" />
                      Add
                    </Button>
                  </div>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttachmentPick}
                  />
                  {structuredNotes.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {structuredNotes.attachments.map((attachmentName) => (
                        <button
                          key={attachmentName}
                          type="button"
                          onClick={() => handleRemoveAttachment(attachmentName)}
                          className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Remove attachment"
                        >
                          <Paperclip className="size-3" />
                          <span>{attachmentName}</span>
                          <X className="size-3" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      No attachments added yet.
                    </p>
                  )}
                </div>
              ) : null}
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

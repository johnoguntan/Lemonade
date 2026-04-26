"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { normalizeTodoPriority, useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RotateCcw, Plus, Minus, X, Moon, ArrowUp, Trash2, ChevronRight, ChevronDown, NotebookPen, Link2, Paperclip, Bell, ListChecks, AlertTriangle, Tag, Palette, Shapes, Clock3, Image as ImageIcon, MapPin, AlarmClock } from "lucide-react"
import { toast } from "sonner"
import { TASK_ICON_LIBRARY, TaskIcon } from "@/lib/task-icons"
import { ColorPickerPanel } from "@/components/lemonade/color-picker-panel"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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

const formatDurationEstimate = (minutes?: number) => {
  if (!minutes || minutes <= 0) {
    return ""
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours}hr`
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return remainder === 0 ? `${hours}hr` : `${hours}hr ${remainder}min`
  }

  return `${minutes}min`
}

const parseDurationEstimate = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  // 1:30 => 90 minutes
  const clockMatch = normalized.match(/^(\d{1,2})\s*:\s*(\d{2})$/)
  if (clockMatch) {
    const hours = Number.parseInt(clockMatch[1], 10)
    const minutes = Number.parseInt(clockMatch[2], 10)
    const total = hours * 60 + minutes
    return Number.isFinite(total) && total > 0 ? total : null
  }

  // 1h 30m, 1hr30min, 2 hours, 45 minutes
  const mixedMatch = normalized.match(
    /^(?:(\d+(?:\.\d+)?)\s*h(?:r|rs|ours)?\s*)?(?:(\d+)\s*m(?:in|ins|inutes)?\s*)?$/
  )
  if (mixedMatch && (mixedMatch[1] || mixedMatch[2])) {
    const hoursPart = mixedMatch[1] ? Number.parseFloat(mixedMatch[1]) : 0
    const minutesPart = mixedMatch[2] ? Number.parseInt(mixedMatch[2], 10) : 0
    const total = Math.round(hoursPart * 60) + minutesPart
    return Number.isFinite(total) && total > 0 ? total : null
  }

  const hoursMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs)?$/)
  if (hoursMatch) {
    return Math.max(1, Math.round(Number.parseFloat(hoursMatch[1]) * 60))
  }

  const minutesMatch = normalized.match(/^(\d+)\s*m(?:in|ins)?$/)
  if (minutesMatch) {
    return Math.max(1, Number.parseInt(minutesMatch[1], 10))
  }

  const plainNumber = Number.parseInt(normalized, 10)
  return Number.isFinite(plainNumber) && plainNumber > 0 ? plainNumber : null
}

const formatTimeLabel = (value?: string) => {
  if (!value) return ""
  const normalized = value.trim().toLowerCase()
  if (!normalized) return ""

  if (normalized === "morning") return "Morning"
  if (normalized === "noon") return "Noon"
  if (normalized === "evening") return "Evening"
  if (normalized === "tonight") return "Tonight"

  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value.trim()

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return value.trim()
  }

  const ampm = hours >= 12 ? "PM" : "AM"
  const hours12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hours12}:${`${minutes}`.padStart(2, "0")} ${ampm}`
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
    calendarTodos,
    addLabelToTask,
    removeLabelFromTask,
    setPreferences,
    snoozeCalendarTodo,
    duplicateCalendarTodo,
    skipRecurringOccurrence,
    splitCalendarTodo,
    convertTodoToSubtask,
    selectedTaskIds,
    toggleTaskSelection,
    clearTaskSelection,
    mergeSelectedTasks,
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
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false)
  const [showReminderEditor, setShowReminderEditor] = useState(false)
  const [reminderCustomMinutes, setReminderCustomMinutes] = useState("")
  const [linkDraft, setLinkDraft] = useState("")
  const [locationDraft, setLocationDraft] = useState(todo.location ?? "")
  const [durationDraft, setDurationDraft] = useState(formatDurationEstimate(todo.durationMinutes))
  const [attachmentDrafts, setAttachmentDrafts] = useState<string[]>([])
  const [taskMenuOpen, setTaskMenuOpen] = useState(false)
  const [activeToolPanel, setActiveToolPanel] = useState<
    "reminder" | "subtasks" | "link" | "priority" | "icon" | "labels" | "color" | "attachment" | "snooze" | "photo" | "location" | "duration" | "split" | "merge" | "convert" | null
  >(null)
  const [pendingRecurringUpdate, setPendingRecurringUpdate] = useState<Partial<Todo> | null>(null)
  const [pendingParentComplete, setPendingParentComplete] = useState(false)
  const [customRecurrenceText, setCustomRecurrenceText] = useState(todo.recurringCustomText ?? "")
  const [splitDraft, setSplitDraft] = useState(todo.text)
  const [mergeTitleDraft, setMergeTitleDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const focusSubtaskComposerAfterMenuCloseRef = useRef(false)
  const subtaskComposerOpeningRef = useRef(false)

  const recurringValue = todo.isRecurring
    ? todo.recurringCustomText
      ? "custom"
      : (todo.recurringFrequency || "daily")
    : "off"

  const resolvedPriority = normalizeTodoPriority(todo.priority)
  const priorityIndicator = {
    urgent: <span className="mr-2 mt-[1px] size-2 shrink-0 rounded-full bg-red-500" />,
    important: <span className="mr-2 mt-[1px] size-2 shrink-0 rounded-full bg-amber-500" />,
    normal: <span className="mr-2 mt-[1px] size-2 shrink-0 rounded-full bg-border" />,
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
  const effectiveUrl = todo.url ?? structuredNotes.link
  const isSelectedForMerge = selectedTaskIds.includes(todo.id)
  const selectedTodos = useMemo(
    () => calendarTodos.filter((item) => selectedTaskIds.includes(item.id)),
    [calendarTodos, selectedTaskIds]
  )
  const mergeableParentCandidates = useMemo(
    () => calendarTodos.filter((item) => item.id !== todo.id && !item.isHeading),
    [calendarTodos, todo.id]
  )
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
  const durationLabel = formatDurationEstimate(todo.durationMinutes)
  const timeLabel = formatTimeLabel(todo.time)

  const handleSave = () => {
    const trimmedText = editText.trim()

    if (trimmedText) {
      const isHeading = trimmedText === trimmedText.toUpperCase() && trimmedText.length > 2

      updateCalendarTodo(todo.id, { text: trimmedText, isHeading })
    }
    setIsEditing(false)
  }

  const openSubtaskComposer = () => {
    subtaskComposerOpeningRef.current = true
    setIsAddingSubtask(true)
    setSubtasksCollapsed(todo.id, false)
    window.setTimeout(() => {
      subtaskInputRef.current?.focus()
      window.setTimeout(() => {
        subtaskComposerOpeningRef.current = false
      }, 150)
    }, 0)
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
    subtaskComposerOpeningRef.current = false
  }

  const handleSubtaskComposerBlur = () => {
    if (subtaskComposerOpeningRef.current) {
      window.setTimeout(() => {
        subtaskInputRef.current?.focus()
      }, 0)
      return
    }

    closeSubtaskComposer()
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

  const handleToggleSubtaskChecked = (subtaskId: string) => {
    const total = todo.subtasks.length
    const current = todo.subtasks.find((subtask) => subtask.id === subtaskId)
    if (!current) return

    const nextCompletedCount =
      completedSubtaskCount + (current.completed ? -1 : 1)

    toggleSubtask(todo.id, subtaskId)

    // Never auto-complete parent without confirmation.
    if (!todo.completed && total > 0 && nextCompletedCount === total) {
      setPendingParentComplete(true)
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
    setLinkDraft(effectiveUrl ?? "")
    setAttachmentDrafts(structuredNotes.attachments)
  }

  const handleSaveLink = () => {
    updateCalendarTodo(todo.id, { url: linkDraft.trim() || undefined })
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
    updateCalendarTodo(todo.id, { url: undefined })
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
    panel: "reminder" | "subtasks" | "link" | "priority" | "icon" | "labels" | "color" | "attachment" | "snooze" | "photo" | "location" | "duration" | "split" | "merge" | "convert"
  ) => {
    setTaskMenuOpen(true)
    setActiveToolPanel(panel)

    if (panel === "link") {
      openLinkEditor()
    }

    if (panel === "attachment") {
      setAttachmentDrafts(structuredNotes.attachments)
    }

    if (panel === "location") {
      setLocationDraft(todo.location ?? "")
    }

    if (panel === "duration") {
      setDurationDraft(formatDurationEstimate(todo.durationMinutes))
    }

    if (panel === "split") {
      setSplitDraft(todo.text)
    }

    if (panel === "merge") {
      const combinedTitle = selectedTodos.map((item) => item.text.trim()).filter(Boolean).join(" / ")
      setMergeTitleDraft(combinedTitle)
    }
  }

  const handleSplitTask = () => {
    const titles = splitDraft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    if (titles.length === 0) {
      return
    }

    splitCalendarTodo(todo.id, titles)
    setTaskMenuOpen(false)
    setActiveToolPanel(null)
    toast(titles.length === 1 ? "Task updated" : `${titles.length} tasks created`, { duration: 2000 })
  }

  const handleMergeTasks = () => {
    const title = mergeTitleDraft.trim()
    if (selectedTodos.length < 2 || !title) {
      return
    }

    mergeSelectedTasks(title)
    setTaskMenuOpen(false)
    setActiveToolPanel(null)
    toast("Tasks merged", { duration: 2000 })
  }

  const handlePhotoPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateCalendarTodo(todo.id, { photoDataUrl: reader.result })
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const completedSubtaskCount = todo.subtasks.filter((subtask) => subtask.completed).length
  const hasCustomColor = Boolean(todo.color)
  const hasSubtasks = todo.subtasks.length > 0
  const areSubtasksCollapsed = collapsedSubtasks[todo.id] ?? true
  const showSubtasks = !areSubtasksCollapsed || isAddingSubtask || editingSubtaskId !== null
  const hasNote = (todo.notes ?? "").trim().length > 0
  const subtaskProgressLabel =
    todo.subtasks.length === 0
      ? ""
      : completedSubtaskCount > 0
        ? `${completedSubtaskCount}/${todo.subtasks.length} done`
        : `${todo.subtasks.length} subtasks`

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
      id={`task-${todo.id}`}
      data-task-id={todo.id}
      className={cn("group relative transition-opacity", isDragging && "opacity-40")}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
        <div 
        className={cn(
          "lemonade-task-row flex items-start px-0 py-2 transition-colors",
          todo.completed && "bg-transparent"
        )}
        style={{ backgroundColor: todo.color }}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex min-w-0 items-start">
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
            <div className="mt-[2px] flex shrink-0 items-center">
              {priorityIndicator}
              {todo.icon ? <TaskIcon icon={todo.icon} className="mr-2 size-4 text-muted-foreground" /> : null}
            </div>
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
                  // Avoid letter-by-letter wrapping in narrow layouts.
                  "lemonade-task-text min-w-0 flex-1 cursor-text whitespace-normal break-normal font-task font-normal text-[14px] leading-[1.15] text-[#000000]",
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
                <span>{subtaskProgressLabel}</span>
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
          {(effectiveUrl || todo.location || durationLabel || timeLabel || todo.photoDataUrl || isSelectedForMerge) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {timeLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <AlarmClock className="size-3" />
                  <span>{timeLabel}</span>
                </span>
              ) : null}
              {effectiveUrl ? (
                <a
                  href={effectiveUrl.startsWith("http") || effectiveUrl.startsWith("tel:") ? effectiveUrl : `https://${effectiveUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Link2 className="size-3" />
                  <span className="max-w-[140px] truncate">{effectiveUrl}</span>
                </a>
              ) : null}
              {todo.location ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span>Location:</span>
                  <span className="max-w-[120px] truncate">{todo.location}</span>
                </span>
              ) : null}
              {durationLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Clock3 className="size-3" />
                  <span>{durationLabel}</span>
                </span>
              ) : null}
              {isSelectedForMerge ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-color)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-color)]">
                  Selected for merge
                </span>
              ) : null}
              {todo.photoDataUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoPreviewOpen(true)}
                    className="h-10 w-10 overflow-hidden rounded-md border border-border/60"
                    aria-label="Open photo"
                    title="Open photo"
                  >
                    <img src={todo.photoDataUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                  <Dialog open={photoPreviewOpen} onOpenChange={setPhotoPreviewOpen}>
                    <DialogContent className="max-w-[min(92vw,720px)] p-2">
                      <DialogTitle className="sr-only">Task photo</DialogTitle>
                      <img src={todo.photoDataUrl} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />
                    </DialogContent>
                  </Dialog>
                </>
              ) : null}
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
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                if (focusSubtaskComposerAfterMenuCloseRef.current) {
                  event.preventDefault()
                }
              }}
              className="w-[320px] max-w-[calc(100vw-24px)] overflow-x-hidden overflow-y-auto rounded-[26px] border border-border/60 bg-background/95 p-0 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur max-h-[var(--radix-dropdown-menu-content-available-height)]"
            >
              <div className="grid grid-cols-6 gap-2 border-b border-border/50 px-3 py-3">
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("reminder")}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
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
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
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
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    activeToolPanel === "link" && "bg-muted text-foreground",
                    effectiveUrl && activeToolPanel !== "link" && "text-foreground"
                  )}
                  title="URL or phone"
                >
                  <Link2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("priority")}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-muted/70",
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
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
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
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
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
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
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
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    activeToolPanel === "attachment" && "bg-muted text-foreground",
                    structuredNotes.attachments.length > 0 && activeToolPanel !== "attachment" && "text-foreground"
                  )}
                  title="Attachment"
                >
                  <Paperclip className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("snooze")}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    activeToolPanel === "snooze" && "bg-muted text-foreground"
                  )}
                  title="Snooze"
                >
                  <AlarmClock className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("photo")}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    activeToolPanel === "photo" && "bg-muted text-foreground",
                    todo.photoDataUrl && activeToolPanel !== "photo" && "text-foreground"
                  )}
                  title="Photo"
                >
                  <ImageIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("location")}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    activeToolPanel === "location" && "bg-muted text-foreground",
                    todo.location && activeToolPanel !== "location" && "text-foreground"
                  )}
                  title="Location"
                >
                  <MapPin className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("duration")}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    activeToolPanel === "duration" && "bg-muted text-foreground",
                    durationLabel && activeToolPanel !== "duration" && "text-foreground"
                  )}
                  title="Duration"
                >
                  <Clock3 className="size-4" />
                </button>
              </div>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="mx-2 mt-2 cursor-pointer rounded-xl border border-border/60 bg-background px-3 py-2 text-[13px] hover:bg-muted/40"
                  onPointerDown={(event) => {
                    // Prevent the first tap from being "focus-only" on touch devices.
                    event.preventDefault()
                  }}
                >
                  <RotateCcw className="size-4 mr-2" />
                  Recurring
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[260px] rounded-2xl border border-border/60 bg-background/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur">
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
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full text-[11px]"
                    onClick={() => {
                      focusSubtaskComposerAfterMenuCloseRef.current = true
                      setTaskMenuOpen(false)
                      setActiveToolPanel(null)
                      window.setTimeout(() => {
                        focusSubtaskComposerAfterMenuCloseRef.current = false
                        openSubtaskComposer()
                      }, 0)
                    }}
                  >
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
                    {effectiveUrl ? (
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
                <div className="max-h-[70vh] overflow-y-auto space-y-3 px-3 py-3">
                  <ColorPickerPanel
                    value={todo.color}
                    palette={colorPalette}
                    onChange={(color) => updateCalendarTodo(todo.id, { color })}
                    onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                    onClear={() => updateCalendarTodo(todo.id, { color: undefined })}
                    description="Pick a color from the wheel or choose a saved swatch."
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

              {activeToolPanel === "snooze" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="text-sm font-medium">Snooze</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Later Today", value: "later-today" as const },
                      { label: "Tomorrow", value: "tomorrow" as const },
                      { label: "This Weekend", value: "this-weekend" as const },
                      { label: "Next Week", value: "next-week" as const },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          snoozeCalendarTodo(todo.id, option.value)
                          setTaskMenuOpen(false)
                          toast(`Task snoozed to ${option.label.toLowerCase()}`, { duration: 2000 })
                        }}
                        className="rounded-lg border border-border/70 px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeToolPanel === "photo" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Photo</div>
                    {todo.photoDataUrl ? (
                      <button
                        type="button"
                        onClick={() => updateCalendarTodo(todo.id, { photoDataUrl: undefined })}
                        className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoPick}
                  />
                  <Button type="button" size="sm" className="h-8 w-full text-[11px]" onClick={() => photoInputRef.current?.click()}>
                    Upload photo
                  </Button>
                  {todo.photoDataUrl ? (
                    <img src={todo.photoDataUrl} alt="" className="max-h-40 w-full rounded-lg object-cover" />
                  ) : (
                    <p className="text-[11px] leading-5 text-muted-foreground">Upload an image and it will appear on the task as a thumbnail.</p>
                  )}
                </div>
              ) : null}

              {activeToolPanel === "location" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Location</div>
                    {todo.location ? (
                      <button
                        type="button"
                        onClick={() => updateCalendarTodo(todo.id, { location: undefined })}
                        className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    spellCheck
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    value={locationDraft}
                    onChange={(event) => setLocationDraft(event.target.value)}
                    placeholder="Type a place or address"
                    className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[11px] outline-none"
                  />
                  <Button type="button" size="sm" className="h-8 w-full text-[11px]" onClick={() => updateCalendarTodo(todo.id, { location: locationDraft || undefined })}>
                    Save location
                  </Button>
                </div>
              ) : null}

              {activeToolPanel === "duration" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Duration</div>
                    {durationLabel ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDurationDraft("")
                          updateCalendarTodo(todo.id, { durationMinutes: undefined })
                        }}
                        className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={durationDraft}
                    onChange={(event) => setDurationDraft(event.target.value)}
                    placeholder="15min, 30min, 1hr"
                    className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[11px] outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full text-[11px]"
                    onClick={() => {
                      const minutes = parseDurationEstimate(durationDraft)
                      if (minutes === null) {
                        toast("Invalid duration", { duration: 2000 })
                        return
                      }
                      updateCalendarTodo(todo.id, { durationMinutes: minutes })
                      setDurationDraft(formatDurationEstimate(minutes))
                      setTaskMenuOpen(false)
                      setActiveToolPanel(null)
                      toast("Duration saved", { duration: 2000 })
                    }}
                  >
                    Save duration
                  </Button>
                </div>
              ) : null}

              {(activeToolPanel === "split" || activeToolPanel === "merge" || activeToolPanel === "convert") ? <DropdownMenuSeparator /> : null}

              {activeToolPanel === "split" ? (
                <div className="space-y-3 px-3 py-3">
                  <div>
                    <div className="text-[14px] font-semibold">Split task</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      Put one task per line. We’ll replace this task with the list below.
                    </div>
                  </div>
                  <textarea
                    value={splitDraft}
                    onChange={(event) => setSplitDraft(event.target.value)}
                    rows={6}
                    className="w-full resize-none rounded-2xl border border-border/70 bg-background/60 px-3 py-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder={"Task 1\nTask 2\nTask 3"}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 flex-1"
                      onClick={() => {
                        setActiveToolPanel(null)
                        setSplitDraft(todo.text)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" className="h-9 flex-1" onClick={handleSplitTask}>
                      Split
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeToolPanel === "merge" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="text-sm font-medium">Merge selected tasks</div>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedTodos.length < 2 ? "Select at least two tasks to merge." : `${selectedTodos.length} tasks selected.`}
                  </p>
                  <textarea
                    value={mergeTitleDraft}
                    onChange={(event) => setMergeTitleDraft(event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md border border-border bg-transparent px-2 py-2 text-[11px] outline-none"
                    placeholder="Merged task title"
                    disabled={selectedTodos.length < 2}
                  />
                  <Button type="button" size="sm" className="h-8 w-full text-[11px]" onClick={handleMergeTasks} disabled={selectedTodos.length < 2}>
                    Merge tasks
                  </Button>
                </div>
              ) : null}

              {activeToolPanel === "convert" ? (
                <div className="space-y-3 px-2 py-2">
                  <div className="text-sm font-medium">Convert to subtask</div>
                  <div className="max-h-[180px] space-y-1 overflow-y-auto">
                    {mergeableParentCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          convertTodoToSubtask(todo.id, candidate.id)
                          setTaskMenuOpen(false)
                          toast("Converted to subtask", { duration: 2000 })
                        }}
                        className="w-full rounded-lg border border-border/70 px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted"
                      >
                        {candidate.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <DropdownMenuSeparator />
              <div className="space-y-2 px-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    duplicateCalendarTodo(todo.id)
                    setTaskMenuOpen(false)
                    toast("Task duplicated", { duration: 2000 })
                  }}
                  className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                >
                  Duplicate task
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("split")}
                  className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                >
                  Split task into many
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleTaskSelection(todo.id)
                    setTaskMenuOpen(false)
                  }}
                  className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                >
                  {isSelectedForMerge ? "Remove from merge selection" : "Select for merge"}
                </button>
                {selectedTodos.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleOpenToolPanel("merge")}
                    className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                  >
                    Merge selected tasks
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleOpenToolPanel("convert")}
                  className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                >
                  Convert to subtask
                </button>
                {todo.isRecurring ? (
                  <button
                    type="button"
                    onClick={() => {
                      skipRecurringOccurrence(todo.id)
                      setTaskMenuOpen(false)
                      toast("Recurring task skipped", { duration: 2000 })
                    }}
                    className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                  >
                    Skip this recurrence
                  </button>
                ) : null}
                {selectedTodos.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearTaskSelection()
                      setTaskMenuOpen(false)
                    }}
                    className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted/40"
                  >
                    Clear merge selection
                  </button>
                ) : null}
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
        <div className="ml-9 mt-0.5">
          <button
            type="button"
            onClick={openNotes}
            className="inline-flex items-center text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
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
                onClick={() => handleToggleSubtaskChecked(subtask.id)}
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
                ref={subtaskInputRef}
                type="text"
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onBlur={handleSubtaskComposerBlur}
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

      <AlertDialog open={pendingParentComplete} onOpenChange={setPendingParentComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark parent task complete?</AlertDialogTitle>
            <AlertDialogDescription>
              All subtasks are done. Do you want to mark this task as complete too?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Only complete the parent if the user confirms.
                if (!todo.completed) {
                  toggleCalendarTodo(todo.id)
                }
              }}
            >
              Mark complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

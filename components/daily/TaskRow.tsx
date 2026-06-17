"use client"

import { memo, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"

// ─── Saw-toothed circle checkbox ─────────────────────────────────────────────
// Paths are pre-computed polygons: 18 teeth (full size) and 12 teeth (small).
// Each tooth alternates between outer and inner radius with slight jitter so
// no two teeth are identical — giving an organic, hand-cut feel.

const SAW_PATH_18 =
  "M 10.00 1.50 L 11.26 3.62 L 12.80 2.29 L 13.22 4.01 L 15.53 3.41 L 14.98 5.99 L 17.01 5.95 L 16.25 7.58 L 18.27 8.54 L 16.80 10.20 L 18.47 11.49 L 16.15 12.10 L 17.10 14.10 L 15.17 14.42 L 15.46 16.51 L 13.42 15.53 L 12.77 17.61 L 11.05 16.72 L 10.00 18.60 L 8.95 16.31 L 7.13 17.89 L 6.48 15.70 L 4.73 16.28 L 4.88 14.47 L 2.64 14.25 L 3.85 12.10 L 2.12 11.39 L 3.20 10.20 L 1.73 8.54 L 3.91 7.72 L 2.55 5.70 L 5.22 5.74 L 4.79 3.80 L 6.48 4.18 L 7.13 2.11 L 8.94 3.59 Z"

const SAW_PATH_12 =
  "M 10.00 1.30 L 11.93 3.58 L 14.20 2.73 L 14.80 4.90 L 17.53 5.65 L 16.51 8.40 L 18.30 10.00 L 16.81 11.61 L 17.45 14.30 L 14.52 14.80 L 14.35 17.53 L 11.92 16.63 L 10.00 18.40 L 7.99 16.70 L 5.60 17.62 L 5.41 14.88 L 2.81 14.15 L 3.20 11.68 L 1.30 10.00 L 3.49 8.40 L 2.73 5.80 L 5.20 4.90 L 5.65 2.47 L 8.07 3.58 Z"

function RoughCircle({ completed, size = 22, color }: { completed: boolean; size?: number; color?: string | null }) {
  const isSmall = size <= 16
  const d = isSmall ? SAW_PATH_12 : SAW_PATH_18
  const fillColor = completed ? (color ?? "rgba(0,0,0,0.68)") : "none"
  const strokeColor = completed ? "none" : "rgba(0,0,0,0.30)"
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d={d}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSmall ? 0.3 : 0.4}
        strokeLinejoin="miter"
        style={{ transition: "fill 0.12s ease, stroke 0.12s ease" }}
      />
    </svg>
  )
}
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  CornerDownRight,
  CornerLeftUp,
  Download,
  Eye,
  GitMerge,
  GripHorizontal,
  Link2,
  MapPin,
  Palette,
  Paperclip,
  Pencil,
  Phone,
  Scissors,
  Share2,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { formatLocalDateKey, normalizeTodoPriority, useLemonadeStore, type Todo } from "@/lib/store"
import { downloadTaskIcs } from "@/lib/ics"
import { parseFlexibleDate } from "@/lib/date-parse"
import { MiniCalendar } from "@/components/task-creation/CalendarDropdown"
import { useQuickAddGlobalKeys } from "@/components/task-creation/QuickInputBar"
import { TimeWheelPicker } from "@/components/task-creation/TimeWheelPicker"
import { ColorPicker } from "@/components/task-creation/ColorPicker"
import { TaskIcon } from "@/lib/task-icons"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type DailySectionKey = "urgent" | "schedule" | "allday"

type DailyTodo = Todo & {
  section?: DailySectionKey
  rollover?: boolean
  dismissed?: boolean
}

type TaskRowProps = {
  todo: Todo
  sectionTitle?: string
  showOverdueActions?: boolean
  appearance?: "daily" | "collection"
  draggable?: boolean
  isDragging?: boolean
  onDragStart?: (event: DragEvent<HTMLDivElement>, todoId: string) => void
  onDropOnTask?: (targetTodoId: string, position: "before" | "after", draggedId: string) => void
}

const schedulePalette = ["#2f58d8", "#f04da2", "#74be5c", "#f29f3a", "#8a5cf6", "#14b8a6"]
const priorityMarkerColors = {
  urgent: "#ef4444",
  important: "#8b5cf6",
  normal: "#3f7df6",
} as const

// Make a typed URL openable: bare "example.com" needs an explicit scheme.
const normalizeUrl = (raw: string) => (/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)

// Compact label for a link chip — the hostname, not the whole scrolling URL.
const urlChipLabel = (raw: string) => {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "")
  } catch {
    return raw.length > 28 ? `${raw.slice(0, 28)}…` : raw
  }
}

const formatOverdueLabel = (dateKey?: string | null) => {
  if (!dateKey) return null
  const [year, month, day] = dateKey.split("-").map(Number)
  const due = new Date(year, (month ?? 1) - 1, day ?? 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - due.getTime()) / 86400000)
  if (diffDays <= 0) return null
  if (diffDays < 7) return `${diffDays} DAY${diffDays === 1 ? "" : "S"} OVERDUE`
  const weeks = Math.round(diffDays / 7)
  return `${weeks} WEEK${weeks === 1 ? "" : "S"} OVERDUE`
}

function TaskRowComponent({
  todo,
  sectionTitle,
  showOverdueActions = false,
  appearance = "daily",
  draggable = false,
  isDragging = false,
  onDragStart,
  onDropOnTask,
}: TaskRowProps) {
  const typedTodo = todo as DailyTodo
  const toggleCalendarTodo = useLemonadeStore((state) => state.toggleCalendarTodo)
  const deleteCalendarTodo = useLemonadeStore((state) => state.deleteCalendarTodo)
  const undoTaskAction = useLemonadeStore((state) => state.undoTaskAction)
  const duplicateCalendarTodo = useLemonadeStore((state) => state.duplicateCalendarTodo)
  const snoozeCalendarTodo = useLemonadeStore((state) => state.snoozeCalendarTodo)
  const splitCalendarTodo = useLemonadeStore((state) => state.splitCalendarTodo)
  const convertTodoToSubtask = useLemonadeStore((state) => state.convertTodoToSubtask)
  const mergeSelectedTasks = useLemonadeStore((state) => state.mergeSelectedTasks)
  const toggleTaskSelection = useLemonadeStore((state) => state.toggleTaskSelection)
  const toggleSubtask = useLemonadeStore((state) => state.toggleSubtask)
  const promoteSubtaskToTask = useLemonadeStore((state) => state.promoteSubtaskToTask)
  const deleteSubtask = useLemonadeStore((state) => state.deleteSubtask)
  const editSubtask = useLemonadeStore((state) => state.editSubtask)
  const addSubtask = useLemonadeStore((state) => state.addSubtask)
  const toggleSubtasksCollapsed = useLemonadeStore((state) => state.toggleSubtasksCollapsed)
  // Narrow selectors so a change to one task (or the selection) doesn't re-render
  // every other row — only the rows whose own derived value actually changed.
  const isSelected = useLemonadeStore((state) => state.selectedTaskIds.includes(typedTodo.id))
  const mergeCount = useLemonadeStore((state) => state.selectedTaskIds.length)
  const isSubtasksCollapsed = useLemonadeStore((state) => state.collapsedSubtasks[typedTodo.id] ?? false)
  const updateCalendarTodoBase = useLemonadeStore((state) => state.updateCalendarTodo)
  const updateCalendarTodo = updateCalendarTodoBase as unknown as (
    id: string,
    updates: Partial<Todo> & { rollover?: boolean; dismissed?: boolean; section?: DailySectionKey }
  ) => void

  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(typedTodo.text)
  // Use Date | null so we can pass directly to MiniCalendar
  const [draftDate, setDraftDate] = useState<Date | null>(() => {
    if (!typedTodo.date) return null
    const [y, m, d] = typedTodo.date.split("-").map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  })
  const [draftTime, setDraftTime] = useState<string | null>(typedTodo.time ?? null)
  const [draftLocation, setDraftLocation] = useState(typedTodo.location ?? "")
  const [draftNotes, setDraftNotes] = useState(typedTodo.notes ?? "")
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [draftColor, setDraftColor] = useState<string | null>(typedTodo.color ?? null)
  const colorAnchorRef = useRef<HTMLButtonElement | null>(null)
  // Text shadows for typed entry — kept in sync with picker selections
  const [draftDateText, setDraftDateText] = useState(() => {
    if (!typedTodo.date) return ""
    const [y, m, d] = typedTodo.date.split("-")
    return y && m && d ? `${m}/${d}/${y}` : ""
  })
  const [draftTimeText, setDraftTimeText] = useState(typedTodo.time ?? "")
  const [newSubtaskText, setNewSubtaskText] = useState("")
  // subtask inline editing: subtaskId → draft title
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [editingSubtaskDraft, setEditingSubtaskDraft] = useState("")

  // Time wheel dismissal: clicking ANYWHERE other than the wheel itself or its
  // clock toggle closes it — inside the edit form, elsewhere on the page, anywhere.
  useEffect(() => {
    if (!showTimePicker) return
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('[data-time-picker]') || target?.closest?.('[data-time-picker-toggle]')) return
      setShowTimePicker(false)
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [showTimePicker])

  // Snooze options menu (opened from the hover toolbar's clock icon).
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false)
  const snoozeMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!snoozeMenuOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (!snoozeMenuRef.current?.contains(event.target as Node)) setSnoozeMenuOpen(false)
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [snoozeMenuOpen])

  // Power-action dialog state.
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitText, setSplitText] = useState("")
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTitle, setMergeTitle] = useState("")
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertQuery, setConvertQuery] = useState("")
  const [dropEdge, setDropEdge] = useState<"top" | "bottom" | null>(null)
  const dragGhostRef = useRef<HTMLDivElement | null>(null)

  const todayKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`
  }, [])

  // Location is rendered as a functional chip below — notes only here, so a
  // long address (or a legacy URL stuck in notes) doesn't stretch the row.
  const subtitle = typedTodo.notes ?? ""
  const overdueLabel = showOverdueActions ? formatOverdueLabel(typedTodo.date) : null

  // Attachment preview dialog (view + download).
  const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false)

  const formatDueShort = (key?: string | null) => {
    if (!key) return ""
    const [y, m, d] = key.split("-").map(Number)
    if (!y || !m || !d) return key
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  const attachmentList = typedTodo.attachments ?? []
  const primaryAttachment = attachmentList[0] ?? null
  const attachmentIsImage = Boolean(primaryAttachment?.type.startsWith("image/"))
  const attachmentIsPdf = primaryAttachment?.type === "application/pdf"
  const dueLabel = typedTodo.dueDate ? `Due ${formatDueShort(typedTodo.dueDate)}` : null
  const hasMeta = Boolean(
    typedTodo.photoDataUrl || primaryAttachment || dueLabel || typedTodo.isRecurring ||
    typedTodo.url || typedTodo.phone || typedTodo.location
  )
  const chipClass =
    "inline-flex max-w-[180px] items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/60 transition hover:bg-black/10 hover:text-black"
  const metaRow = hasMeta ? (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {typedTodo.photoDataUrl && !primaryAttachment ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={typedTodo.photoDataUrl} alt="" className="h-8 w-8 rounded-md border border-black/10 object-cover" />
      ) : null}
      {dueLabel ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">{dueLabel}</span>
      ) : null}
      {typedTodo.isRecurring ? (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">Repeats</span>
      ) : null}

      {/* Functional chips: compact, clickable — no raw URLs stretching the row */}
      {typedTodo.url ? (
        <a
          href={normalizeUrl(typedTodo.url)}
          target="_blank"
          rel="noopener noreferrer"
          title={typedTodo.url}
          className={chipClass}
        >
          <Link2 size={10} className="shrink-0" /> <span className="truncate">{urlChipLabel(typedTodo.url)}</span>
        </a>
      ) : null}
      {typedTodo.phone ? (
        <a href={`tel:${typedTodo.phone.replace(/[^\d+]/g, "")}`} title={`Call ${typedTodo.phone}`} className={chipClass}>
          <Phone size={10} className="shrink-0" /> <span className="truncate">{typedTodo.phone}</span>
        </a>
      ) : null}
      {typedTodo.location ? (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(typedTodo.location)}`}
          target="_blank"
          rel="noopener noreferrer"
          title={typedTodo.location}
          className={chipClass}
        >
          <MapPin size={10} className="shrink-0" /> <span className="truncate">{typedTodo.location}</span>
        </a>
      ) : null}

      {/* Attachment: name + a little preview element (view + download) */}
      {primaryAttachment ? (
        <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/60">
          <Paperclip size={10} className="shrink-0" />
          <span className="truncate">{primaryAttachment.name}</span>
          <button
            type="button"
            onClick={() => setAttachmentPreviewOpen(true)}
            className="ml-0.5 shrink-0 rounded-full p-0.5 text-black/45 transition hover:bg-black/10 hover:text-black"
            aria-label="View attachment"
            title="View attachment"
          >
            <Eye size={11} />
          </button>
        </span>
      ) : null}
    </div>
  ) : null
  const scheduleColor = schedulePalette[(typedTodo.createdAt ?? 0) % schedulePalette.length]
  const showScheduleStyle = sectionTitle === "SCHEDULE"
  const priorityMarkerColor = priorityMarkerColors[normalizeTodoPriority(typedTodo.priority)]

  // The color/icon the user picked in the task-add panel. The icon is tinted
  // with the chosen color; a small dot makes the color visible even when there
  // is no icon and the task isn't completed.
  const accentColor = typedTodo.color ?? null
  const leadingAccent =
    accentColor || typedTodo.icon ? (
      <span className="flex shrink-0 translate-y-[1px] items-center gap-1 self-center">
        {accentColor ? (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
        ) : null}
        {typedTodo.icon ? (
          <span style={accentColor ? { color: accentColor } : undefined} className="text-black/70">
            <TaskIcon icon={typedTodo.icon} className="size-3.5" />
          </span>
        ) : null}
      </span>
    ) : null

  const subtasks = typedTodo.subtasks ?? []
  const hasSubtasks = subtasks.length > 0

  // Only needed while the convert dialog is open; read the list lazily via
  // getState() so TaskRow doesn't subscribe to the whole calendarTodos array
  // (which would re-render every row on any task change and defeat memoization).
  const convertCandidates = useMemo(() => {
    if (!convertOpen) return []
    const query = convertQuery.trim().toLowerCase()
    return useLemonadeStore
      .getState()
      .calendarTodos.filter((candidate) => candidate.id !== typedTodo.id && !candidate.isHeading)
      .filter((candidate) => (query ? candidate.text.toLowerCase().includes(query) : true))
      .slice(0, 50)
  }, [convertOpen, convertQuery, typedTodo.id])

  const saveEdit = () => {
    const trimmed = draftText.trim()
    if (!trimmed) return
    updateCalendarTodo(typedTodo.id, {
      text: trimmed,
      time: draftTime ?? undefined,
      location: draftLocation.trim() || undefined,
      notes: draftNotes.trim() || undefined,
      color: draftColor ?? undefined,
      ...(draftDate ? { date: formatLocalDateKey(draftDate) } : {}),
    })
    setShowDatePicker(false)
    setShowTimePicker(false)
    setShowColorPicker(false)
    setIsEditing(false)
  }

  // Latest saveEdit, for deferred calls (after a field's onBlur commits its
  // value the closure from THIS render is stale — the ref isn't).
  const saveEditRef = useRef(saveEdit)
  useEffect(() => {
    saveEditRef.current = saveEdit
  })

  const cancelEdit = () => {
    setDraftText(typedTodo.text)
    setDraftDate(() => {
      if (!typedTodo.date) return null
      const [y, m, d] = typedTodo.date.split("-").map(Number)
      return new Date(y, (m ?? 1) - 1, d ?? 1)
    })
    setDraftTime(typedTodo.time ?? null)
    setDraftDateText(() => {
      if (!typedTodo.date) return ""
      const [y, m, d] = typedTodo.date.split("-")
      return y && m && d ? `${m}/${d}/${y}` : ""
    })
    setDraftTimeText(typedTodo.time ?? "")
    setDraftLocation(typedTodo.location ?? "")
    setDraftNotes(typedTodo.notes ?? "")
    setDraftColor(typedTodo.color ?? null)
    setShowDatePicker(false)
    setShowTimePicker(false)
    setShowColorPicker(false)
    setIsEditing(false)
  }

  // ─── Save-on-Enter for the edit form ───────────────────────────────────────
  // There is no Save button: Enter saves from anywhere in the form, Escape
  // cancels. Shift+Enter still inserts a newline in the notes textarea, and the
  // subtask inputs keep their own Enter behavior (they preventDefault).
  const editFormRef = useRef<HTMLDivElement | null>(null)

  const handleEditKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      cancelEdit()
      return
    }
    if (event.key !== "Enter" || event.shiftKey) return
    // A field already handled this Enter (e.g. the add-subtask input).
    if (event.defaultPrevented) return

    const target = event.target as HTMLElement
    if (target.tagName === "INPUT") {
      // Commit the focused field first (date/time parse in onBlur), then save
      // on the next tick so the committed value is in the draft.
      event.preventDefault()
      ;(target as HTMLInputElement).blur()
      window.setTimeout(() => saveEditRef.current(), 0)
      return
    }
    // Notes textarea (plain Enter) or any other surface → save.
    event.preventDefault()
    saveEdit()
  }

  // Window-level fallback: Enter still saves when focus has escaped the form
  // (clicking inside MiniCalendar/TimeWheelPicker moves focus to <body>, and
  // the ColorPicker is portaled onto <body>).
  useQuickAddGlobalKeys({
    containerRef: editFormRef,
    isActive: () => isEditing,
    onSubmit: () => saveEditRef.current(),
    onEscape: cancelEdit,
  })

  const shareTask = async () => {
    const payload = [typedTodo.text, typedTodo.time, subtitle].filter(Boolean).join("\n")
    if (navigator.share) {
      try {
        await navigator.share({ title: typedTodo.text, text: payload })
        return
      } catch (error) {
        // User dismissed the share sheet — don't fall back to clipboard.
        if ((error as Error)?.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(payload)
      toast.success("Task copied to clipboard")
    } catch {
      toast.error("Couldn't share this task")
    }
  }

  const exportIcs = () => {
    try {
      downloadTaskIcs(typedTodo)
      toast.success("Calendar file downloaded")
    } catch {
      toast.error("Couldn't create the calendar file")
    }
  }

  const handleDelete = () => {
    deleteCalendarTodo(typedTodo.id)
    toast("Task deleted", {
      action: { label: "Undo", onClick: () => undoTaskAction() },
    })
  }

  // Defer opening a dialog so it doesn't race the context menu's focus teardown.
  const openLater = (open: () => void) => window.setTimeout(open, 0)

  const openSplit = () =>
    openLater(() => {
      setSplitText(typedTodo.text)
      setSplitOpen(true)
    })
  const openMerge = () =>
    openLater(() => {
      setMergeTitle(typedTodo.text)
      setMergeOpen(true)
    })
  const openConvert = () =>
    openLater(() => {
      setConvertQuery("")
      setConvertOpen(true)
    })

  const confirmSplit = () => {
    const titles = splitText.split("\n").map((line) => line.trim()).filter(Boolean)
    if (titles.length === 0) return
    splitCalendarTodo(typedTodo.id, titles)
    setSplitOpen(false)
  }

  const confirmMerge = () => {
    if (mergeCount < 2 || !mergeTitle.trim()) return
    mergeSelectedTasks(mergeTitle.trim())
    setMergeOpen(false)
  }

  const subtaskToggle = hasSubtasks ? (
    <button
      type="button"
      onClick={() => toggleSubtasksCollapsed(typedTodo.id)}
      className="inline-flex shrink-0 items-center text-black/30 transition hover:text-black/60"
      aria-label={isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"}
    >
      {isSubtasksCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
    </button>
  ) : null

  const subtaskList =
    hasSubtasks && !isSubtasksCollapsed ? (
      <ul className="mt-1 space-y-0.5">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="group/subtask flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleSubtask(typedTodo.id, subtask.id)}
              className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[4px] border border-black/20 text-black"
              aria-label={subtask.completed ? "Mark subtask incomplete" : "Mark subtask complete"}
            >
              {subtask.completed ? <Check size={9} /> : null}
            </button>

            {editingSubtaskId === subtask.id ? (
              <input
                autoFocus
                value={editingSubtaskDraft}
                onChange={(e) => setEditingSubtaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = editingSubtaskDraft.trim()
                    if (trimmed) editSubtask(typedTodo.id, subtask.id, trimmed)
                    setEditingSubtaskId(null)
                  } else if (e.key === "Escape") {
                    setEditingSubtaskId(null)
                  }
                }}
                onBlur={() => {
                  const trimmed = editingSubtaskDraft.trim()
                  if (trimmed) editSubtask(typedTodo.id, subtask.id, trimmed)
                  setEditingSubtaskId(null)
                }}
                className="min-w-0 flex-1 rounded border border-black/15 bg-white px-1.5 py-0.5 text-[11px] text-black outline-none"
              />
            ) : (
              <span
                className={[
                  "min-w-0 flex-1 text-[11px] leading-4",
                  subtask.completed ? "text-black/35 line-through" : "text-black/70",
                ].join(" ")}
              >
                {subtask.title}
              </span>
            )}

            <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover/subtask:opacity-100 [@media(hover:none)]:opacity-100">
              <button
                type="button"
                onClick={() => { setEditingSubtaskId(subtask.id); setEditingSubtaskDraft(subtask.title) }}
                className="text-black/30 transition hover:text-black/70"
                aria-label="Edit subtask"
                title="Edit"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                onClick={() => promoteSubtaskToTask(typedTodo.id, subtask.id)}
                className="text-black/30 transition hover:text-black/70"
                aria-label="Make this subtask a task"
                title="Make a task"
              >
                <CornerLeftUp size={11} />
              </button>
              <button
                type="button"
                onClick={() => deleteSubtask(typedTodo.id, subtask.id)}
                className="text-black/30 transition hover:text-[#a32020]"
                aria-label="Delete subtask"
                title="Delete subtask"
              >
                <X size={11} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    ) : null

  const collapsedSubtaskCount =
    hasSubtasks && isSubtasksCollapsed ? (
      <span className="ml-1 text-[10px] font-medium text-black/35">{subtasks.length}</span>
    ) : null

  const snoozeChoices = [
    ["Later today", "later-today"],
    ["Tomorrow", "tomorrow"],
    ["This weekend", "this-weekend"],
    ["Next week", "next-week"],
  ] as const

  const utilityActions = (
    <div className={["absolute right-0 top-1 z-20 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-sm transition group-hover:opacity-100 [@media(hover:none)]:opacity-100", snoozeMenuOpen ? "opacity-100" : "opacity-0"].join(" ")}>
      <button type="button" onClick={() => setIsEditing(true)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Edit task">
        <Pencil size={13} />
      </button>
      <button type="button" onClick={() => duplicateCalendarTodo(typedTodo.id)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Duplicate task">
        <Copy size={13} />
      </button>
      {/* Snooze: opens a menu of choices instead of instantly snoozing */}
      <div ref={snoozeMenuRef} className="relative">
        <button type="button" onClick={() => setSnoozeMenuOpen((v) => !v)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Snooze task">
          <Clock3 size={13} />
        </button>
        {snoozeMenuOpen ? (
          <div className="absolute right-0 top-full z-30 mt-1 w-[150px] rounded-xl border border-black/10 bg-white py-1 shadow-xl">
            {snoozeChoices.map(([label, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  snoozeCalendarTodo(typedTodo.id, key)
                  setSnoozeMenuOpen(false)
                }}
                className="block w-full px-3 py-1.5 text-left text-[12px] text-black/75 hover:bg-black/5"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" onClick={() => void shareTask()} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Share task">
        <Share2 size={13} />
      </button>
      <button type="button" onClick={handleDelete} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-[#a32020]" aria-label="Delete task">
        <Trash2 size={13} />
      </button>
    </div>
  )

  if (isEditing) {
    return (
      <div ref={editFormRef} onKeyDown={handleEditKeyDown} className="group rounded-[16px] border border-black/10 bg-white px-3 py-2.5">
        <div className="space-y-2">
          {/* Title — Enter/Escape are handled by the form container */}
          <input
            autoFocus
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none"
          />

          {/* Date + Time pickers — fields wrap instead of squeezing, so the
              full date/time is always visible on desktop, tablet and mobile. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
            {/* Date: type freely; focusing the field opens the calendar */}
            <div className="relative min-w-0">
              <div className="flex items-center rounded-xl border border-black/10 px-3 py-2 focus-within:border-black/25">
                <input
                  value={draftDateText}
                  onChange={(e) => setDraftDateText(e.target.value)}
                  onFocus={() => { setShowDatePicker(true); setShowTimePicker(false) }}
                  onBlur={() => {
                    setShowDatePicker(false)
                    const parsed = parseFlexibleDate(draftDateText)
                    if (parsed) {
                      setDraftDate(parsed)
                      setDraftDateText(parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }))
                    } else if (!draftDateText.trim()) {
                      setDraftDate(null)
                    }
                  }}
                  placeholder="Date"
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-black outline-none placeholder:text-black/30"
                />
              </div>
              {showDatePicker ? (
                // preventDefault on mousedown keeps the input focused while
                // clicking inside the calendar (otherwise blur closes it
                // before the click lands).
                <div className="absolute left-0 top-full z-50 mt-1" onMouseDown={(e) => e.preventDefault()}>
                  <MiniCalendar
                    value={draftDate}
                    onSelect={(d) => {
                      setDraftDate(d)
                      setDraftDateText(d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }))
                      setShowDatePicker(false)
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                </div>
              ) : null}
            </div>

            {/* Time: type freely or click clock icon */}
            <div className="relative min-w-0">
              <div className="flex items-center rounded-xl border border-black/10 px-3 py-2 focus-within:border-black/25">
                <input
                  value={draftTimeText}
                  onChange={(e) => setDraftTimeText(e.target.value)}
                  onBlur={() => {
                    const trimmed = draftTimeText.trim()
                    setDraftTime(trimmed || null)
                  }}
                  placeholder="Time"
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-black outline-none placeholder:text-black/30"
                />
                <button
                  type="button"
                  data-time-picker-toggle="true"
                  onClick={() => { setShowTimePicker((v) => !v); setShowDatePicker(false) }}
                  className="ml-1 shrink-0 text-black/35 transition hover:text-black/70"
                  aria-label="Open time picker"
                >
                  <Clock3 size={13} />
                </button>
              </div>
              {showTimePicker ? (
                <div
                  data-time-picker="true"
                  className="absolute left-0 top-full z-50 mt-1 w-[270px] rounded-2xl border border-black/10 bg-white p-4 shadow-xl"
                >
                  <TimeWheelPicker
                    value={draftTime}
                    onChange={(t) => { setDraftTime(t); setDraftTimeText(t); setShowTimePicker(false) }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <input value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="Location" className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />

          {/* Notes */}
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none"
          />

          {/* Subtask management inside the edit form */}
          <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-black/35">Subtasks</p>
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="group/esub flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSubtask(typedTodo.id, subtask.id)}
                  className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[4px] border border-black/20 text-black"
                >
                  {subtask.completed ? <Check size={9} /> : null}
                </button>
                {editingSubtaskId === subtask.id ? (
                  <input
                    autoFocus
                    value={editingSubtaskDraft}
                    onChange={(e) => setEditingSubtaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // preventDefault so the form container doesn't ALSO
                        // save-and-close the whole edit form.
                        e.preventDefault()
                        const t = editingSubtaskDraft.trim()
                        if (t) editSubtask(typedTodo.id, subtask.id, t)
                        setEditingSubtaskId(null)
                      } else if (e.key === "Escape") {
                        e.stopPropagation()
                        setEditingSubtaskId(null)
                      }
                    }}
                    onBlur={() => {
                      const t = editingSubtaskDraft.trim()
                      if (t) editSubtask(typedTodo.id, subtask.id, t)
                      setEditingSubtaskId(null)
                    }}
                    className="min-w-0 flex-1 rounded border border-black/15 bg-white px-1.5 py-0.5 text-[11px] text-black outline-none"
                  />
                ) : (
                  <span className={["min-w-0 flex-1 text-[11px]", subtask.completed ? "text-black/35 line-through" : "text-black/65"].join(" ")}>
                    {subtask.title}
                  </span>
                )}
                <span className="flex items-center gap-1 opacity-0 transition group-hover/esub:opacity-100">
                  <button type="button" onClick={() => { setEditingSubtaskId(subtask.id); setEditingSubtaskDraft(subtask.title) }} className="text-black/30 hover:text-black/70" title="Edit">
                    <Pencil size={10} />
                  </button>
                  <button type="button" onClick={() => promoteSubtaskToTask(typedTodo.id, subtask.id)} className="text-black/30 hover:text-black/70" title="Make a task">
                    <CornerLeftUp size={10} />
                  </button>
                  <button type="button" onClick={() => deleteSubtask(typedTodo.id, subtask.id)} className="text-black/30 hover:text-[#a32020]" title="Delete">
                    <X size={10} />
                  </button>
                </span>
              </div>
            ))}
            {/* Add new subtask */}
            <input
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = newSubtaskText.trim()
                  if (trimmed) {
                    // Adds the subtask; preventDefault keeps the form container
                    // from also saving-and-closing the edit form.
                    e.preventDefault()
                    addSubtask(typedTodo.id, trimmed)
                    setNewSubtaskText("")
                  }
                  // Empty → fall through to the container, which saves the form.
                }
              }}
              placeholder="+ Add subtask…"
              className="w-full bg-transparent text-[11px] text-black/50 outline-none placeholder:text-black/30"
            />
          </div>

          {/* Completion color picker */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-black/45">Completion color</span>
            <button
              ref={colorAnchorRef}
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/15 transition hover:border-black/30"
              style={{ backgroundColor: draftColor ?? "transparent" }}
              aria-label="Pick completion color"
            >
              {!draftColor ? <Palette size={12} className="text-black/35" /> : null}
            </button>
            {draftColor ? (
              <button
                type="button"
                onClick={() => setDraftColor(null)}
                className="text-[10px] text-black/35 hover:text-black/60"
              >
                Reset
              </button>
            ) : null}
            {showColorPicker ? (
              <ColorPicker
                value={draftColor}
                onChange={setDraftColor}
                onClose={() => setShowColorPicker(false)}
                anchorRef={colorAnchorRef}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium text-black/65">
              <X size={12} />
              Cancel
            </button>
            <span className="text-[10px] text-black/30">Enter to save</span>
          </div>
        </div>
      </div>
    )
  }

  const selectionClass = isSelected ? " ring-2 ring-sky-400/70 ring-offset-1 ring-offset-white rounded-[10px]" : ""

  // A nicer drag preview than the browser's default flat screenshot: a small
  // rounded card with the priority color and the task title.
  const buildDragGhost = () => {
    const ghost = document.createElement("div")
    ghost.style.cssText = [
      "position:fixed", "top:-1000px", "left:-1000px", "z-index:9999",
      "display:flex", "align-items:center", "gap:8px",
      "max-width:280px", "padding:8px 14px 8px 10px",
      "border-radius:12px", "background:#ffffff",
      "border:1px solid rgba(0,0,0,0.08)",
      "box-shadow:0 12px 32px rgba(0,0,0,0.20)",
      "font-size:13px", "font-weight:500", "color:#111",
      "white-space:nowrap", "overflow:hidden",
    ].join(";")
    const bar = document.createElement("span")
    bar.style.cssText = `flex:0 0 auto;width:4px;height:16px;border-radius:9999px;background:${priorityMarkerColor}`
    const label = document.createElement("span")
    label.textContent = typedTodo.text
    label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
    ghost.append(bar, label)
    document.body.appendChild(ghost)
    return ghost
  }

  const clearDragGhost = () => {
    dragGhostRef.current?.remove()
    dragGhostRef.current = null
  }

  const dragHandlers = {
    draggable,
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData("text/plain", typedTodo.id)
      event.dataTransfer.effectAllowed = "move"
      clearDragGhost()
      dragGhostRef.current = buildDragGhost()
      event.dataTransfer.setDragImage(dragGhostRef.current, 12, 18)
      onDragStart?.(event, typedTodo.id)
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!draggable) return
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      const rect = event.currentTarget.getBoundingClientRect()
      setDropEdge(event.clientY < rect.top + rect.height / 2 ? "top" : "bottom")
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node)) return
      setDropEdge(null)
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!draggable) return
      event.preventDefault()
      event.stopPropagation()
      const position = dropEdge === "top" ? "before" : "after"
      const draggedId = event.dataTransfer.getData("text/plain")
      setDropEdge(null)
      if (draggedId) onDropOnTask?.(typedTodo.id, position, draggedId)
    },
    onDragEnd: () => {
      setDropEdge(null)
      clearDragGhost()
    },
  }

  const dropIndicator = dropEdge ? (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-10 h-[2px] rounded-full bg-sky-400"
      style={dropEdge === "top" ? { top: -2 } : { bottom: -2 }}
    />
  ) : null

  let rowNode: ReactNode

  if (showScheduleStyle) {
    rowNode = (
      <div {...dragHandlers} className={["group relative flex items-start gap-2 rounded-[10px] py-0.5", isDragging ? "opacity-45" : "", selectionClass].join(" ")}>
        {dropIndicator}
        <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); toggleCalendarTodo(typedTodo.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }) }} aria-label={typedTodo.completed ? "Mark incomplete" : "Mark complete"} className="mt-[4px] flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-opacity hover:opacity-70">
          <RoughCircle completed={typedTodo.completed} size={14} color={typedTodo.color} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {typedTodo.time ? <span className="text-[13px] font-medium" style={{ color: scheduleColor }}>{typedTodo.time}</span> : null}
            {subtaskToggle}
            {leadingAccent}
            <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[13px] leading-[1.25] text-black">{typedTodo.text}</p>
            {collapsedSubtaskCount}
          </div>
          {subtitle ? <p className="ml-[1px] text-[11px] leading-4 text-black/56">{subtitle}</p> : null}
          {metaRow}
          {subtaskList}
        </div>
        <button type="button" aria-label="Drag to reorder" className={["mt-[2px] shrink-0 text-black/12", draggable ? "cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" : "opacity-0"].join(" ")}>
          <GripHorizontal size={14} />
        </button>
        {utilityActions}
      </div>
    )
  } else if (appearance === "collection") {
    rowNode = (
      <div {...dragHandlers} className={["group relative flex min-h-[44px] items-stretch gap-3 py-1.5", draggable ? "cursor-grab active:cursor-grabbing" : "", isDragging ? "opacity-45" : "", selectionClass].join(" ")}>
        {dropIndicator}
        <span className="w-[5px] shrink-0 self-stretch rounded-full" style={{ backgroundColor: priorityMarkerColor }} aria-hidden="true" />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-baseline gap-1.5">
            {subtaskToggle}
            {leadingAccent}
            <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[15px] font-semibold leading-[1.18] text-black">{typedTodo.text}</p>
            {collapsedSubtaskCount}
          </div>
          {typedTodo.time ? <p className="mt-1 text-[12px] leading-4 text-black/62">{typedTodo.time}</p> : null}
          {subtitle ? <p className="text-[12px] leading-4 text-black/62">{subtitle}</p> : null}
          {metaRow}
          {overdueLabel ? <p className="mt-1 text-[11px] leading-4 text-[#ff4f46]">{overdueLabel}</p> : null}
          {subtaskList}
        </div>
        {utilityActions}
      </div>
    )
  } else {
    rowNode = (
      <div {...dragHandlers} className={["group relative flex items-start gap-3 py-2", isDragging ? "opacity-45" : "", selectionClass].join(" ")}>
        {dropIndicator}
        <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); toggleCalendarTodo(typedTodo.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }) }} aria-label={typedTodo.completed ? "Mark incomplete" : "Mark complete"} className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center transition-opacity hover:opacity-60">
          <RoughCircle completed={typedTodo.completed} size={22} color={typedTodo.color} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {subtaskToggle}
            {leadingAccent}
            <p onDoubleClick={() => setIsEditing(true)} className={`cursor-text text-[13px] leading-[1.32] ${typedTodo.completed ? "text-black/40 line-through" : "text-black"}`}>{typedTodo.text}</p>
            {collapsedSubtaskCount}
          </div>
          {typedTodo.time ? <p className="mt-0.5 text-[11px] leading-4 text-black/75">{typedTodo.time}</p> : null}
          {subtitle ? <p className="text-[11px] leading-4 text-black/75">{subtitle}</p> : null}
          {metaRow}
          {overdueLabel ? <p className="mt-0.5 text-[11px] leading-4 text-[#ff4f46]">{overdueLabel}</p> : null}
          {subtaskList}
        </div>
        <button type="button" aria-label="Drag to reorder" className={["mt-1 shrink-0 text-black/12", draggable ? "cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" : "opacity-0"].join(" ")}>
          <GripHorizontal size={14} />
        </button>
        {utilityActions}

        {showOverdueActions ? (
          <div className="ml-2 flex shrink-0 items-center gap-2 pt-0.5">
            <button type="button" onClick={() => updateCalendarTodo(typedTodo.id, { date: todayKey, rollover: true, dismissed: false, section: "schedule", endOfDay: false })} className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-black/55 transition hover:border-black/20 hover:text-black">
              Rollover
            </button>
            <button type="button" onClick={() => updateCalendarTodo(typedTodo.id, { dismissed: true })} className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-black/55 transition hover:border-black/20 hover:text-black">
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{rowNode}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={() => openLater(() => setIsEditing(true))}>
            <Pencil className="size-4" /> Edit
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => toggleCalendarTodo(typedTodo.id)}>
            <Check className="size-4" /> {typedTodo.completed ? "Mark incomplete" : "Mark complete"}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => duplicateCalendarTodo(typedTodo.id)}>
            <Copy className="size-4" /> Duplicate
          </ContextMenuItem>
          {hasSubtasks ? (
            <ContextMenuItem onSelect={() => toggleSubtasksCollapsed(typedTodo.id)}>
              {isSubtasksCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              {isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"}
            </ContextMenuItem>
          ) : null}

          <ContextMenuSeparator />
          <ContextMenuItem onSelect={openSplit}>
            <Scissors className="size-4" /> Split into tasks…
          </ContextMenuItem>
          <ContextMenuItem onSelect={openConvert}>
            <CornerDownRight className="size-4" /> Convert to subtask…
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked={isSelected} onCheckedChange={() => toggleTaskSelection(typedTodo.id)}>
            Select for merge
          </ContextMenuCheckboxItem>
          <ContextMenuItem disabled={mergeCount < 2} onSelect={openMerge}>
            <GitMerge className="size-4" /> Merge selected ({mergeCount})…
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Clock3 className="size-4" /> Snooze
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onSelect={() => snoozeCalendarTodo(typedTodo.id, "later-today")}>Later today</ContextMenuItem>
              <ContextMenuItem onSelect={() => snoozeCalendarTodo(typedTodo.id, "tomorrow")}>Tomorrow</ContextMenuItem>
              <ContextMenuItem onSelect={() => snoozeCalendarTodo(typedTodo.id, "this-weekend")}>This weekend</ContextMenuItem>
              <ContextMenuItem onSelect={() => snoozeCalendarTodo(typedTodo.id, "next-week")}>Next week</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onSelect={() => void shareTask()}>
            <Share2 className="size-4" /> Share
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => exportIcs()}>
            <CalendarPlus className="size-4" /> Add to calendar (.ics)
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={handleDelete}>
            <Trash2 className="size-4" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Attachment preview + download */}
      <Dialog open={attachmentPreviewOpen} onOpenChange={setAttachmentPreviewOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{primaryAttachment?.name ?? "Attachment"}</DialogTitle>
            <DialogDescription className="sr-only">Attachment preview</DialogDescription>
          </DialogHeader>
          {primaryAttachment?.dataUrl ? (
            attachmentIsImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryAttachment.dataUrl}
                alt={primaryAttachment.name}
                className="max-h-[60vh] w-full rounded-xl border border-black/10 object-contain"
              />
            ) : attachmentIsPdf ? (
              <iframe
                src={primaryAttachment.dataUrl}
                title={primaryAttachment.name}
                className="h-[60vh] w-full rounded-xl border border-black/10"
              />
            ) : (
              <p className="rounded-xl bg-black/[0.03] px-4 py-6 text-center text-[13px] text-black/55">
                No inline preview for this file type — use Download to open it.
              </p>
            )
          ) : (
            <p className="rounded-xl bg-black/[0.03] px-4 py-6 text-center text-[13px] text-black/55">
              This attachment isn&rsquo;t stored on this device.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttachmentPreviewOpen(false)}>Close</Button>
            {primaryAttachment?.dataUrl ? (
              <Button type="button" asChild>
                <a href={primaryAttachment.dataUrl} download={primaryAttachment.name}>
                  <Download className="size-4" /> Download
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Split into tasks</DialogTitle>
            <DialogDescription>One line per new task. This task will be replaced by the lines below.</DialogDescription>
          </DialogHeader>
          <textarea
            value={splitText}
            onChange={(event) => setSplitText(event.target.value)}
            rows={5}
            className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30"
            placeholder={"Buy paint\nTape the trim\nApply first coat"}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
            <Button type="button" onClick={confirmSplit}>Split</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Merge {mergeCount} tasks</DialogTitle>
            <DialogDescription>The selected tasks become one. Notes are combined; the title below is used.</DialogDescription>
          </DialogHeader>
          <input
            value={mergeTitle}
            onChange={(event) => setMergeTitle(event.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30"
            placeholder="Merged task title"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button type="button" onClick={confirmMerge} disabled={mergeCount < 2 || !mergeTitle.trim()}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Convert to subtask</DialogTitle>
            <DialogDescription>Choose the task this should become a subtask of.</DialogDescription>
          </DialogHeader>
          <input
            value={convertQuery}
            onChange={(event) => setConvertQuery(event.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30"
            placeholder="Search tasks…"
          />
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {convertCandidates.length === 0 ? (
              <p className="px-1 py-3 text-[12px] text-black/45">No matching tasks.</p>
            ) : (
              convertCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => {
                    convertTodoToSubtask(typedTodo.id, candidate.id)
                    setConvertOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-black hover:bg-black/5"
                >
                  <CornerDownRight className="size-3.5 shrink-0 text-black/35" />
                  <span className="truncate">{candidate.text}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const TaskRow = memo(TaskRowComponent)

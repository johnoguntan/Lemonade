"use client"

import { memo, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"
import { SunMedium } from "lucide-react"
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  CornerDownRight,
  CornerLeftUp,
  GitMerge,
  GripHorizontal,
  Pencil,
  Scissors,
  Share2,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { formatLocalDateKey, normalizeTodoPriority, useLemonadeStore, type Todo } from "@/lib/store"
import { downloadTaskIcs } from "@/lib/ics"
import { parseFlexibleDate } from "@/lib/date-parse"
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
  onDropOnTask?: (targetTodoId: string, position?: "before" | "after") => void
}

const schedulePalette = ["#2f58d8", "#f04da2", "#74be5c", "#f29f3a", "#8a5cf6", "#14b8a6"]
const priorityMarkerColors = {
  urgent: "#ef4444",
  important: "#8b5cf6",
  normal: "#3f7df6",
} as const

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

  const formatTodoDate = (value?: string | null) => {
    if (!value) return ""
    const [y, m, d] = value.split("-")
    return y && m && d ? `${m}/${d}/${y}` : value
  }

  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(typedTodo.text)
  const [draftDate, setDraftDate] = useState(formatTodoDate(typedTodo.date))
  const [draftTime, setDraftTime] = useState(typedTodo.time ?? "")
  const [draftLocation, setDraftLocation] = useState(typedTodo.location ?? "")
  const [draftNotes, setDraftNotes] = useState(typedTodo.notes ?? "")

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

  const subtitle = [typedTodo.location, typedTodo.notes].filter(Boolean).join(" · ")
  const overdueLabel = showOverdueActions ? formatOverdueLabel(typedTodo.date) : null
  const scheduleColor = schedulePalette[(typedTodo.createdAt ?? 0) % schedulePalette.length]
  const showScheduleStyle = sectionTitle === "SCHEDULE"
  const priorityMarkerColor = priorityMarkerColors[normalizeTodoPriority(typedTodo.priority)]

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
    // Flexible date entry: "4th of July", "2/10/2026", "next friday", etc.
    const parsedDate = draftDate.trim() ? parseFlexibleDate(draftDate) : null
    updateCalendarTodo(typedTodo.id, {
      text: trimmed,
      time: draftTime.trim() || undefined,
      location: draftLocation.trim() || undefined,
      notes: draftNotes.trim() || undefined,
      ...(parsedDate ? { date: formatLocalDateKey(parsedDate) } : {}),
    })
    setIsEditing(false)
  }

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
            <span
              className={[
                "text-[11px] leading-4",
                subtask.completed ? "text-black/35 line-through" : "text-black/70",
              ].join(" ")}
            >
              {subtask.title}
            </span>
            <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover/subtask:opacity-100 [@media(hover:none)]:opacity-100">
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

  const utilityActions = (
    <div className="absolute right-0 top-1 z-20 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-sm transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
      <button type="button" onClick={() => setIsEditing(true)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Edit task">
        <Pencil size={13} />
      </button>
      <button type="button" onClick={() => duplicateCalendarTodo(typedTodo.id)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Duplicate task">
        <Copy size={13} />
      </button>
      <button type="button" onClick={() => snoozeCalendarTodo(typedTodo.id, "tomorrow")} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Snooze task">
        <Clock3 size={13} />
      </button>
      <button type="button" onClick={() => exportIcs()} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Add to calendar">
        <CalendarPlus size={13} />
      </button>
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
      <div className="group rounded-[16px] border border-black/10 bg-white px-3 py-2.5">
        <div className="space-y-2">
          <input value={draftText} onChange={(event) => setDraftText(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={draftDate} onChange={(event) => setDraftDate(event.target.value)} placeholder="Date (e.g. 4th of July)" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
            <input value={draftTime} onChange={(event) => setDraftTime(event.target.value)} placeholder="Time" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
          </div>
          <input value={draftLocation} onChange={(event) => setDraftLocation(event.target.value)} placeholder="Location" className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
          <textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} placeholder="Notes" rows={2} className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={saveEdit} className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-[11px] font-medium text-white">
              <Check size={12} />
              Save
            </button>
            <button type="button" onClick={() => { setDraftText(typedTodo.text); setDraftDate(formatTodoDate(typedTodo.date)); setDraftTime(typedTodo.time ?? ""); setDraftLocation(typedTodo.location ?? ""); setDraftNotes(typedTodo.notes ?? ""); setIsEditing(false) }} className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium text-black/65">
              <X size={12} />
              Cancel
            </button>
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
      setDropEdge(null)
      onDropOnTask?.(typedTodo.id, position)
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
        <button type="button" onClick={() => toggleCalendarTodo(typedTodo.id)} aria-label={typedTodo.completed ? "Mark incomplete" : "Mark complete"} className="mt-[4px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-black/20">
          <span className={`h-1.5 w-1.5 rounded-full ${typedTodo.completed ? "bg-black" : "bg-transparent"}`} />
        </button>
        <button type="button" aria-label="Drag to reorder" className={["mt-[2px] shrink-0 text-black/12", draggable ? "cursor-grab" : "opacity-30"].join(" ")}>
          <GripHorizontal size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {typedTodo.time ? <span className="text-[13px] font-medium" style={{ color: scheduleColor }}>{typedTodo.time}</span> : null}
            {subtaskToggle}
            <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[13px] leading-[1.25] text-black">{typedTodo.text}</p>
            {collapsedSubtaskCount}
          </div>
          {subtitle ? <p className="ml-[1px] text-[11px] leading-4 text-black/56">{subtitle}</p> : null}
          {subtaskList}
        </div>
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
            <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[15px] font-semibold leading-[1.18] text-black">{typedTodo.text}</p>
            {collapsedSubtaskCount}
          </div>
          {typedTodo.time ? <p className="mt-1 text-[12px] leading-4 text-black/62">{typedTodo.time}</p> : null}
          {subtitle ? <p className="text-[12px] leading-4 text-black/62">{subtitle}</p> : null}
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
        <button type="button" onClick={() => toggleCalendarTodo(typedTodo.id)} aria-label={typedTodo.completed ? "Mark incomplete" : "Mark complete"} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#f0b446] transition hover:text-[#de9c2d]">
          <SunMedium size={16} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="Drag to reorder" className={["mt-1 shrink-0 text-black/12", draggable ? "cursor-grab" : "opacity-30"].join(" ")}>
          <GripHorizontal size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {subtaskToggle}
            <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[13px] leading-[1.32] text-black">{typedTodo.text}</p>
            {collapsedSubtaskCount}
          </div>
          {typedTodo.time ? <p className="mt-0.5 text-[11px] leading-4 text-black/75">{typedTodo.time}</p> : null}
          {subtitle ? <p className="text-[11px] leading-4 text-black/75">{subtitle}</p> : null}
          {overdueLabel ? <p className="mt-0.5 text-[11px] leading-4 text-[#ff4f46]">{overdueLabel}</p> : null}
          {subtaskList}
        </div>
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

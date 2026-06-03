"use client"

import { useMemo, useState, type DragEvent } from "react"
import { SunMedium } from "lucide-react"
import { Check, Copy, GripHorizontal, Pencil, Share2, Trash2, X, Clock3 } from "lucide-react"
import { normalizeTodoPriority, useLemonadeStore, type Todo } from "@/lib/store"

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
  onDropOnTask?: (targetTodoId: string) => void
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

export function TaskRow({
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
  const duplicateCalendarTodo = useLemonadeStore((state) => state.duplicateCalendarTodo)
  const snoozeCalendarTodo = useLemonadeStore((state) => state.snoozeCalendarTodo)
  const updateCalendarTodoBase = useLemonadeStore((state) => state.updateCalendarTodo)
  const updateCalendarTodo = updateCalendarTodoBase as unknown as (
    id: string,
    updates: Partial<Todo> & { rollover?: boolean; dismissed?: boolean; section?: DailySectionKey }
  ) => void

  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(typedTodo.text)
  const [draftTime, setDraftTime] = useState(typedTodo.time ?? "")
  const [draftLocation, setDraftLocation] = useState(typedTodo.location ?? "")
  const [draftNotes, setDraftNotes] = useState(typedTodo.notes ?? "")

  const todayKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`
  }, [])

  const subtitle = [typedTodo.location, typedTodo.notes].filter(Boolean).join(" · ")
  const overdueLabel = showOverdueActions ? formatOverdueLabel(typedTodo.date) : null
  const scheduleColor = schedulePalette[(typedTodo.createdAt ?? 0) % schedulePalette.length]
  const showScheduleStyle = sectionTitle === "SCHEDULE"
  const priorityMarkerColor = priorityMarkerColors[normalizeTodoPriority(typedTodo.priority)]

  const saveEdit = () => {
    const trimmed = draftText.trim()
    if (!trimmed) return
    updateCalendarTodo(typedTodo.id, {
      text: trimmed,
      time: draftTime.trim() || undefined,
      location: draftLocation.trim() || undefined,
      notes: draftNotes.trim() || undefined,
    })
    setIsEditing(false)
  }

  const shareTask = async () => {
    const payload = [typedTodo.text, typedTodo.time, subtitle].filter(Boolean).join("\n")
    if (navigator.share) {
      try {
        await navigator.share({ title: typedTodo.text, text: payload })
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(payload)
    } catch {}
  }

  const utilityActions = !isEditing ? (
    <div className="flex shrink-0 items-center gap-1 self-start opacity-0 transition group-hover:opacity-100">
      <button type="button" onClick={() => setIsEditing(true)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Edit task">
        <Pencil size={13} />
      </button>
      <button type="button" onClick={() => duplicateCalendarTodo(typedTodo.id)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Duplicate task">
        <Copy size={13} />
      </button>
      <button type="button" onClick={() => snoozeCalendarTodo(typedTodo.id, "tomorrow")} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Snooze task">
        <Clock3 size={13} />
      </button>
      <button type="button" onClick={() => void shareTask()} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black" aria-label="Share task">
        <Share2 size={13} />
      </button>
      <button type="button" onClick={() => deleteCalendarTodo(typedTodo.id)} className="rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-[#a32020]" aria-label="Delete task">
        <Trash2 size={13} />
      </button>
    </div>
  ) : null

  if (isEditing) {
    return (
      <div className="group rounded-[16px] border border-black/10 bg-white px-3 py-2.5">
        <div className="space-y-2">
          <input value={draftText} onChange={(event) => setDraftText(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={draftTime} onChange={(event) => setDraftTime(event.target.value)} placeholder="Time" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
            <input value={draftLocation} onChange={(event) => setDraftLocation(event.target.value)} placeholder="Location" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
          </div>
          <textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} placeholder="Notes" rows={2} className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={saveEdit} className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-[11px] font-medium text-white">
              <Check size={12} />
              Save
            </button>
            <button type="button" onClick={() => { setDraftText(typedTodo.text); setDraftTime(typedTodo.time ?? ""); setDraftLocation(typedTodo.location ?? ""); setDraftNotes(typedTodo.notes ?? ""); setIsEditing(false) }} className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium text-black/65">
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showScheduleStyle) {
    return (
      <div
        draggable={draggable}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", typedTodo.id)
          onDragStart?.(event, typedTodo.id)
        }}
        onDragOver={(event) => {
          if (!draggable) return
          event.preventDefault()
        }}
        onDrop={(event) => {
          if (!draggable) return
          event.preventDefault()
          onDropOnTask?.(typedTodo.id)
        }}
        className={["group flex items-start gap-2 rounded-[10px] py-0.5", isDragging ? "opacity-45" : ""].join(" ")}
      >
        <button type="button" onClick={() => toggleCalendarTodo(typedTodo.id)} aria-label={typedTodo.completed ? "Mark incomplete" : "Mark complete"} className="mt-[4px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-black/20">
          <span className={`h-1.5 w-1.5 rounded-full ${typedTodo.completed ? "bg-black" : "bg-transparent"}`} />
        </button>
        <button type="button" aria-label="Drag to reorder" className={["mt-[2px] shrink-0 text-black/12", draggable ? "cursor-grab" : "opacity-30"].join(" ")}>
          <GripHorizontal size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {typedTodo.time ? <span className="text-[13px] font-medium" style={{ color: scheduleColor }}>{typedTodo.time}</span> : null}
            <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[13px] leading-[1.25] text-black">{typedTodo.text}</p>
          </div>
          {subtitle ? <p className="ml-[1px] text-[11px] leading-4 text-black/56">{subtitle}</p> : null}
        </div>
        {utilityActions}
      </div>
    )
  }

  if (appearance === "collection") {
    return (
      <div
        draggable={draggable}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", typedTodo.id)
          onDragStart?.(event, typedTodo.id)
        }}
        onDragOver={(event) => {
          if (!draggable) return
          event.preventDefault()
        }}
        onDrop={(event) => {
          if (!draggable) return
          event.preventDefault()
          onDropOnTask?.(typedTodo.id)
        }}
        className={[
          "group flex min-h-[46px] items-start gap-4 py-0.5",
          draggable ? "cursor-grab active:cursor-grabbing" : "",
          isDragging ? "opacity-45" : "",
        ].join(" ")}
      >
        <span
          className="mt-0.5 h-[46px] w-[5px] shrink-0 rounded-full"
          style={{ backgroundColor: priorityMarkerColor }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 pt-2">
          <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[15px] font-semibold leading-[1.18] text-black">
            {typedTodo.text}
          </p>
          {typedTodo.time ? <p className="mt-1 text-[12px] leading-4 text-black/62">{typedTodo.time}</p> : null}
          {subtitle ? <p className="text-[12px] leading-4 text-black/62">{subtitle}</p> : null}
          {overdueLabel ? <p className="mt-1 text-[11px] leading-4 text-[#ff4f46]">{overdueLabel}</p> : null}
        </div>
        {utilityActions}
      </div>
    )
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", typedTodo.id)
        onDragStart?.(event, typedTodo.id)
      }}
      onDragOver={(event) => {
        if (!draggable) return
        event.preventDefault()
      }}
      onDrop={(event) => {
        if (!draggable) return
        event.preventDefault()
        onDropOnTask?.(typedTodo.id)
      }}
      className={["group flex items-start gap-3 py-2", isDragging ? "opacity-45" : ""].join(" ")}
    >
      <button type="button" onClick={() => toggleCalendarTodo(typedTodo.id)} aria-label={typedTodo.completed ? "Mark incomplete" : "Mark complete"} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#f0b446] transition hover:text-[#de9c2d]">
        <SunMedium size={16} strokeWidth={1.5} />
      </button>
      <button type="button" aria-label="Drag to reorder" className={["mt-1 shrink-0 text-black/12", draggable ? "cursor-grab" : "opacity-30"].join(" ")}>
        <GripHorizontal size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p onDoubleClick={() => setIsEditing(true)} className="cursor-text text-[13px] leading-[1.32] text-black">{typedTodo.text}</p>
        {typedTodo.time ? <p className="mt-0.5 text-[11px] leading-4 text-black/75">{typedTodo.time}</p> : null}
        {subtitle ? <p className="text-[11px] leading-4 text-black/75">{subtitle}</p> : null}
        {overdueLabel ? <p className="mt-0.5 text-[11px] leading-4 text-[#ff4f46]">{overdueLabel}</p> : null}
      </div>
      {utilityActions}

      {showOverdueActions ? (
        <div className="ml-2 flex shrink-0 items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => updateCalendarTodo(typedTodo.id, { date: todayKey, rollover: true, dismissed: false, section: "schedule", endOfDay: false })}
            className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-black/55 transition hover:border-black/20 hover:text-black"
          >
            Rollover
          </button>
          <button
            type="button"
            onClick={() => updateCalendarTodo(typedTodo.id, { dismissed: true })}
            className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-black/55 transition hover:border-black/20 hover:text-black"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  )
}

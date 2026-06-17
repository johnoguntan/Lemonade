"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays, Flag, Paperclip, Plus } from "lucide-react"
import { CalendarDropdown } from "@/components/task-creation/CalendarDropdown"
import { PriorityDropdown } from "@/components/task-creation/PriorityDropdown"
import { AttachmentDropdown } from "@/components/task-creation/AttachmentDropdown"
import {
  createDefaultDraft,
  useQuickAddGlobalKeys,
  type TaskDraftState,
} from "@/components/task-creation/QuickInputBar"
import { formatLocalDateKey, type Todo } from "@/lib/store"

type DailySectionKey = "urgent" | "schedule" | "allday"
export type DailySectionInputKind = DailySectionKey | "overdue" | "collection"

// ─── Rich add options ────────────────────────────────────────────────────────
// The inline input bar can pass date / time / priority back to the add handler
// so tasks created from section rows carry the same detail as the top QuickInputBar.

export type RichAddOpts = {
  scheduleDate?: Date | null
  scheduleWhenever?: boolean
  scheduleTime?: string | null
  priority?: string
  collections?: string[]
  color?: string | null
  attachmentName?: string | null
  attachmentDataUrl?: string | null
}

// ─── Inline input row with 3 icons ───────────────────────────────────────────

type SectionInputRowProps = {
  onAdd: (text: string, opts?: RichAddOpts) => void
  onCancel: () => void
  placeholder?: string
}

// Identical design to the top QuickInputBar:
//   Row 1: [input] [CalendarDays] [+]
//   Row 2 (only after pressing + with empty input, or when a panel is open):
//          [CalendarDays] [Flag] [Paperclip]
// Hovering any icon opens its dropdown; it stays open until a click elsewhere.

function SectionInputRow({ onAdd, onCancel, placeholder = "Add a task…" }: SectionInputRowProps) {
  const [text, setText] = useState("")
  const [draft, setDraft] = useState<TaskDraftState>(() => createDefaultDraft())
  const [openPanel, setOpenPanel] = useState<"calendar" | "priority" | "attachment" | null>(null)
  const [iconsVisible, setIconsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lockedPanelRef = useRef<string | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.(".color-picker-panel")) return
      if (!containerRef.current?.contains(e.target as Node)) {
        lockedPanelRef.current = null
        setOpenPanel(null)
        setIconsVisible(false)
        // Cancel if the user clicked outside without typing anything.
        if (!text.trim()) onCancel()
      }
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [onCancel, text])

  const updateDraft = (updates: Partial<TaskDraftState>) =>
    setDraft((curr) => ({ ...curr, ...updates }))

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) { onCancel(); return }
    onAdd(trimmed, {
      scheduleDate: draft.scheduleDate,
      scheduleWhenever: draft.scheduleWhenever,
      scheduleTime: draft.scheduleTime,
      priority: draft.priority !== "none" ? draft.priority : undefined,
      collections: draft.collections.length ? draft.collections : undefined,
      color: draft.color,
      attachmentName: draft.attachmentName,
      attachmentDataUrl: draft.attachmentDataUrl,
    })
    setText("")
    setDraft(createDefaultDraft())
    lockedPanelRef.current = null
    setOpenPanel(null)
    setIconsVisible(false)
    onCancel()
  }

  // Window-level fallback: Enter submits even when focus has escaped the row
  // (clicking a non-focusable spot in a dropdown moves focus to <body>, and the
  // ColorPicker is portaled outside the container). Active whenever this row is
  // mounted — the row only exists while the user is mid-add.
  useQuickAddGlobalKeys({
    containerRef,
    isActive: () => true,
    onSubmit: submit,
    onEscape: () => {
      lockedPanelRef.current = null
      setOpenPanel(null)
      setIconsVisible(false)
      setText("")
      onCancel()
    },
  })

  // Container-level keydown — catches Enter/Escape when focus is inside a dropdown
  // (CalendarDropdown, PriorityDropdown, etc.) rather than the main input.
  const handleContainerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      lockedPanelRef.current = null; setOpenPanel(null); setIconsVisible(false); setText(""); onCancel(); return
    }
    if (e.key !== "Enter" || e.shiftKey) return
    const target = e.target as HTMLElement
    if (target.tagName === "TEXTAREA") return
    // If focus is on an input inside a dropdown (not the main text input), blur it
    // so its value is committed, then submit on the next tick.
    if (target.tagName === "INPUT" && target !== inputRef.current) {
      e.preventDefault()
      ;(target as HTMLInputElement).blur()
      window.setTimeout(() => submit(), 0)
      return
    }
    e.preventDefault()
    submit()
  }

  // Hover opens a dropdown and it STAYS open after the cursor leaves —
  // it only closes on a click somewhere else (outside mousedown above)
  // or by clicking the same icon again. Same behavior as QuickInputBar.
  const handleIconHoverEnter = (panel: "calendar" | "priority" | "attachment") => {
    setOpenPanel(panel)
  }
  const handleIconClick = (panel: "calendar" | "priority" | "attachment") => {
    setOpenPanel((p) => {
      if (p === panel) { lockedPanelRef.current = null; return null }
      lockedPanelRef.current = panel
      return panel
    })
  }

  const showIconRow = iconsVisible || openPanel !== null
  const iconCls = "text-[#8e8e8e] transition-all duration-200 hover:text-[#3d3d3d]"

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleContainerKey}>
      {/* Row 1: input + plus */}
      <div className="flex items-center gap-3 text-[#8e8e8e]">
        <input
          ref={inputRef}
          value={text}
          onFocus={() => setIconsVisible(true)}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="h-7 flex-1 bg-transparent text-[15px] font-normal text-[#111] outline-none placeholder:font-light placeholder:text-[#b9b9b9]"
        />

        {/* Calendar — only shown in compact state (hidden when expanded row is visible) */}
        {!showIconRow ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => handleIconClick("calendar")}
              onMouseEnter={() => handleIconHoverEnter("calendar")}
              className={iconCls}
              aria-label="Schedule"
            >
              <CalendarDays size={17} />
            </button>
            {openPanel === "calendar" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"
              >
                <CalendarDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Plus: toggles the 3-icon options row only — adding a task is Enter's job */}
        <button
          type="button"
          onClick={() => {
            setIconsVisible((v) => !v)
            setOpenPanel(null)
          }}
          className={iconCls}
          aria-label="Show task options"
        >
          <Plus size={17} />
        </button>
      </div>

      {/* Row 2: icon row — visible on focus, + press, or open panel */}
      {showIconRow ? (
        <div className="mt-2 flex items-center justify-end gap-4 pt-1 text-[#8e8e8e]">
          {/* Calendar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => handleIconClick("calendar")}
              onMouseEnter={() => handleIconHoverEnter("calendar")}
              className={iconCls}
              aria-label="Schedule"
            >
              <CalendarDays size={17} />
            </button>
            {openPanel === "calendar" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"
              >
                <CalendarDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => handleIconClick("priority")}
              onMouseEnter={() => handleIconHoverEnter("priority")}
              className={iconCls}
              aria-label="Priority"
            >
              <Flag size={17} />
            </button>
            {openPanel === "priority" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"
              >
                <PriorityDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => handleIconClick("attachment")}
              onMouseEnter={() => handleIconHoverEnter("attachment")}
              className={iconCls}
              aria-label="Attachment"
            >
              <Paperclip size={17} />
            </button>
            {openPanel === "attachment" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"
              >
                <AttachmentDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── SectionLines ─────────────────────────────────────────────────────────────

export type SectionLinesProps = {
  count?: number
  onAdd?: (text: string, opts?: RichAddOpts) => void
  ariaLabel?: string
  placeholder?: string
  className?: string
  lineHeightClass?: string
}

const DEFAULT_LINE_HEIGHT = "h-9"

export function SectionLines({
  count = 5,
  onAdd,
  ariaLabel = "Add a task",
  placeholder = "Add a task…",
  className = "",
  lineHeightClass = DEFAULT_LINE_HEIGHT,
}: SectionLinesProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (!onAdd) {
    return (
      <div className={className} aria-hidden="true">
        {Array.from({ length: count }).map((_, index) => (
          <div key={`line-${index}`} className={lineHeightClass} />
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => {
        if (activeIndex === index) {
          return (
            <SectionInputRow
              key={`line-${index}`}
              onAdd={onAdd}
              onCancel={() => setActiveIndex(null)}
              placeholder={placeholder}
            />
          )
        }
        return (
          <button
            key={`line-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={ariaLabel}
            className={`block w-full text-left ${lineHeightClass}`}
          />
        )
      })}
    </div>
  )
}

// ─── buildCalendarAddHandler ──────────────────────────────────────────────────
// Returns a (text, opts?) handler that DailySection / DateCollection /
// TagCollection pass to SectionLines as `onAdd`.  The `opts` come from the
// inline icon bar so date, time, priority etc. picked there are respected.

export function buildCalendarAddHandler(input: {
  addCalendarTodo: (todo: Partial<Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }>) => string
  ensureLabelIds: (names: string[]) => string[]
  selectedCalendarDate: string
  kind: DailySectionInputKind
  tagNames?: string[]
}): (text: string, opts?: RichAddOpts) => void {
  return (text: string, opts?: RichAddOpts) => {
    const {
      addCalendarTodo,
      ensureLabelIds,
      selectedCalendarDate,
      kind,
      tagNames,
    } = input

    // Resolve date from opts (user picked) or context default.
    const resolveDate = (): string | null => {
      if (opts?.scheduleWhenever) return null
      if (opts?.scheduleDate) return formatLocalDateKey(opts.scheduleDate)
      return selectedCalendarDate || null
    }

    const extraLabelIds = opts?.collections ? ensureLabelIds(opts.collections) : []

    if (kind === "overdue") {
      const past = new Date()
      past.setHours(0, 0, 0, 0)
      past.setDate(past.getDate() - 1)
      const pastKey = `${past.getFullYear()}-${`${past.getMonth() + 1}`.padStart(2, "0")}-${`${past.getDate()}`.padStart(2, "0")}`
      addCalendarTodo({
        text,
        completed: false,
        date: pastKey,
        section: "allday",
        priority: "normal",
        endOfDay: true,
        rollover: true,
      })
      return
    }

    if (kind === "collection") {
      const labelIds = tagNames ? ensureLabelIds(tagNames) : []
      addCalendarTodo({
        text,
        completed: false,
        date: resolveDate(),
        time: opts?.scheduleTime ?? undefined,
        priority: (opts?.priority as "urgent" | "high" | "medium" | "low" | "normal" | undefined) ?? "normal",
        labelIds: [...labelIds, ...extraLabelIds],
        color: opts?.color ?? undefined,
        endOfDay: false,
      })
      return
    }

    // "schedule" section: default to 12:00 PM so the task stays in SCHEDULE
    // (the DailyView filter requires a non-empty time for the schedule section).
    const defaultTime = kind === "schedule" ? "12:00 PM" : undefined
    const time = opts?.scheduleTime ?? defaultTime

    addCalendarTodo({
      text,
      completed: false,
      date: resolveDate(),
      time,
      section: kind,
      priority: (opts?.priority as "urgent" | "high" | "medium" | "low" | "normal" | undefined) ?? (kind === "urgent" ? "urgent" : "normal"),
      labelIds: extraLabelIds,
      color: opts?.color ?? undefined,
      endOfDay: kind === "allday",
    })
  }
}

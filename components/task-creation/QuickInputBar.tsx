"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays, Flag, Loader2, Paperclip, Plus } from "lucide-react"
import { CalendarDropdown } from "@/components/task-creation/CalendarDropdown"
import { AttachmentDropdown } from "@/components/task-creation/AttachmentDropdown"
import { PriorityDropdown } from "@/components/task-creation/PriorityDropdown"
import { toast } from "sonner"
import { aiParseSingleTask, type AiParsedTask } from "@/lib/ai-task-parser"
import { resolveParsedRecurringTodoFields } from "@/lib/task-shortcuts"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"

export type TaskPriority = "none" | "urgent" | "high" | "medium" | "low"
export type TaskSection = "urgent" | "schedule" | "allday"

export type TaskDraftState = {
  title: string
  section: TaskSection
  scheduleDate: Date | null
  scheduleWhenever: boolean   // true when user explicitly chose "Whenever" (date: null)
  scheduleTime: string | null
  dueDate: Date | null
  duration: number | null
  repeat: import("@/components/task-creation/RepeatPicker").RepeatConfig | null
  alert: string | null
  snooze: string | null
  priority: TaskPriority
  collections: string[]
  color: string | null
  icon: string | null
  subtasks: string[]
  url: string
  phone: string
  address: string
  attachmentFile: File | null
  attachmentName: string | null
  attachmentDataUrl: string | null
  notes: string
}

type DailySectionKey = "urgent" | "schedule" | "allday"
type StoreTodoWithDailyFields = Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }

export const createDefaultDraft = (): TaskDraftState => ({
  title: "",
  section: "allday",
  scheduleDate: null,
  scheduleWhenever: false,
  scheduleTime: null,
  dueDate: null,
  duration: null,
  repeat: null,
  alert: null,
  snooze: null,
  priority: "none",
  collections: [],
  color: null,
  icon: null,
  subtasks: [],
  url: "",
  phone: "",
  address: "",
  attachmentFile: null,
  attachmentName: null,
  attachmentDataUrl: null,
  notes: "",
})

// Cheap check for whether the text is worth parsing. Plain titles ("Buy milk")
// skip parsing entirely so they create instantly with no API round-trip.
const PARSE_SIGNAL_RE =
  /\b(today|tomorrow|tonight|tmr|tmrw|next|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|noon|midnight|every|daily|weekly|monthly|yearly)\b|\d{1,2}:\d{2}|\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\bin\s+\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b|[#!@]|https?:\/\//i

const looksParseable = (text: string) => PARSE_SIGNAL_RE.test(text)

// ─── Global Enter/Escape fallback ────────────────────────────────────────────
// The container's own onKeyDown only fires while focus is INSIDE the bar. But
// clicking a non-focusable spot in a dropdown moves focus to <body> (and in
// Safari/Firefox even buttons don't take focus on click), and the ColorPicker
// is portaled onto <body> — in all those cases Enter went nowhere. This hook
// listens on window so Enter always adds the task while a quick-add surface is
// active, without stealing Enter from unrelated inputs elsewhere on the page.
export function useQuickAddGlobalKeys({
  containerRef,
  isActive,
  onSubmit,
  onEscape,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  isActive: () => boolean
  onSubmit: () => void
  onEscape: () => void
}) {
  // Refs so the single window listener always sees the latest closures.
  const stateRef = useRef({ isActive, onSubmit, onEscape })
  useEffect(() => {
    stateRef.current = { isActive, onSubmit, onEscape }
  })

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { isActive, onSubmit, onEscape } = stateRef.current
      if (!isActive()) return
      // Another quick-add surface (or the container handler) already took it.
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      // Focus inside the bar bubbles through the container's own onKeyDown.
      if (target && containerRef.current?.contains(target)) return

      const inPortal = Boolean(target?.closest?.(".color-picker-panel"))
      // Only act when focus is "nowhere" (body/html) or inside a portaled
      // quick-add surface — never hijack typing in unrelated fields.
      const focusIsFree =
        !target || target === document.body || target === document.documentElement || inPortal
      if (!focusIsFree) return

      if (event.key === "Escape") {
        onEscape()
        return
      }
      if (event.key !== "Enter" || event.shiftKey) return
      if (target?.tagName === "TEXTAREA") return
      // A text field inside the portal: blur first so its onBlur commits the
      // value into the draft, then submit on the next tick.
      if (inPortal && target && (target.tagName === "INPUT" || target.tagName === "SELECT")) {
        event.preventDefault()
        ;(target as HTMLInputElement).blur()
        // Read through the ref at fire time: the blur above re-renders, and we
        // want the submit closure that sees the committed value.
        window.setTimeout(() => stateRef.current.onSubmit(), 0)
        return
      }
      event.preventDefault()
      onSubmit()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [containerRef])
}

// Map the Alert dropdown labels to reminder offsets (minutes before the event).
const ALERT_OFFSET_MINUTES: Record<string, number> = {
  "At time of event": 0,
  "5 min before": 5,
  "10 min before": 10,
  "15 min before": 15,
  "30 min before": 30,
  "1 hour before": 60,
  "1 day before": 1440,
}

export function QuickInputBar() {
  const [draft, setDraft] = useState<TaskDraftState>(() => createDefaultDraft())
  const [openPanel, setOpenPanel] = useState<
    "calendar" | "priority" | "attachment" | "subtasks" | "url" | "phone" | null
  >(null)
  // iconsVisible: the 3-icon row is only shown after the user presses + with an empty input.
  const [iconsVisible, setIconsVisible] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // when the user clicks an icon the panel is "locked" open; hover-away won't close it
  const lockedPanelRef = useRef<string | null>(null)
  // Always points at the latest draft so submit works even when triggered from
  // a deferred handler (e.g. after committing a field on Enter).
  const draftRef = useRef(draft)
  draftRef.current = draft

  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (todo: Partial<StoreTodoWithDailyFields>) => string
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)
  const selectedCalendarDate = useLemonadeStore((state) => state.selectedCalendarDate)

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      // Ignore clicks inside the portaled color picker (rendered on <body>).
      if (target?.closest?.(".color-picker-panel")) return
      if (!containerRef.current?.contains(event.target as Node)) {
        lockedPanelRef.current = null
        setOpenPanel(null)
        setIconsVisible(false)
      }
    }
    const handleFocusRequest = () => {
      inputRef.current?.focus()
    }
    window.addEventListener("mousedown", handleOutside)
    window.addEventListener("allsenadro:new-task-focus", handleFocusRequest)
    return () => {
      window.removeEventListener("mousedown", handleOutside)
      window.removeEventListener("allsenadro:new-task-focus", handleFocusRequest)
    }
  }, [])

  const updateDraft = (updates: Partial<TaskDraftState>) => {
    setDraft((current) => ({ ...current, ...updates }))
  }

  // The 3-icon row is visible when explicitly expanded OR when a panel is open.
  const showIconRow = iconsVisible || openPanel !== null

  // Hovering an icon opens its dropdown, and the dropdown STAYS open when the
  // cursor leaves — it only closes on a click somewhere else (the outside
  // mousedown handler above) or by clicking the same icon again.
  const handleIconHoverEnter = (panel: "calendar" | "priority" | "attachment") => {
    setOpenPanel(panel)
  }
  const handleIconClick = (panel: "calendar" | "priority" | "attachment") => {
    setOpenPanel((current) => {
      if (current === panel) { lockedPanelRef.current = null; return null }
      lockedPanelRef.current = panel
      return panel
    })
  }

  const handleSubmit = async () => {
    const draft = draftRef.current
    const trimmed = draft.title.trim()
    if (!trimmed || isParsing) return

    // Parse natural language ("call mom tomorrow 3pm #urgent") into fields.
    // Heuristic-first, AI fallback — only for inputs that actually carry signals.
    let parsed: AiParsedTask | null = null
    if (looksParseable(trimmed)) {
      setIsParsing(true)
      try {
        parsed = await aiParseSingleTask(trimmed)
      } catch {
        parsed = null
        // The task is still created as plain text — tell the user why the
        // date/time/priority weren't auto-filled instead of failing silently.
        toast.info("Added as a plain task — couldn't auto-detect details.")
      } finally {
        setIsParsing(false)
      }
    }

    // Explicit values picked via the dropdowns always win; parsed fills the gaps.
    const title = parsed?.title?.trim() || trimmed
    // "Whenever" = user explicitly wants no date (null).
    // Unset (scheduleWhenever false, scheduleDate null) falls back to parsed date or selected calendar day.
    const dateKey = draft.scheduleWhenever
      ? null
      : draft.scheduleDate
        ? formatLocalDateKey(draft.scheduleDate)
        : parsed?.date ?? selectedCalendarDate
    const time = draft.scheduleTime ?? parsed?.time ?? undefined
    const effectivePriority = draft.priority !== "none" ? draft.priority : parsed?.priority ?? "normal"
    const url = draft.url || parsed?.url || ""
    const phone = draft.phone || parsed?.phone || ""
    const address = draft.address || parsed?.location || ""
    const labelIds = ensureLabelIds(Array.from(new Set([...draft.collections, ...(parsed?.labels ?? [])])))
    const recurringFields = parsed ? resolveParsedRecurringTodoFields(parsed as unknown as Record<string, unknown>) : {}

    // An explicit Repeat choice from the dropdown wins over NLP-detected recurrence.
    const repeatFields: Partial<Todo> = draft.repeat
      ? {
          isRecurring: true,
          recurringFrequency:
            draft.repeat.frequency === "daily" ||
            draft.repeat.frequency === "weekly" ||
            draft.repeat.frequency === "monthly"
              ? draft.repeat.frequency
              : undefined,
          recurringInterval: draft.repeat.interval > 1 ? draft.repeat.interval : undefined,
          recurringDays: draft.repeat.daysOfWeek?.length ? draft.repeat.daysOfWeek : undefined,
          recurringCustomText: draft.repeat.frequency === "yearly" ? "yearly" : undefined,
        }
      : {}

    // Explicit Alert dropdown choice wins over NLP-detected reminder.
    const reminderOffset =
      draft.alert && draft.alert in ALERT_OFFSET_MINUTES
        ? ALERT_OFFSET_MINUTES[draft.alert]
        : parsed?.reminder ?? undefined

    const dueDateKey = draft.dueDate ? formatLocalDateKey(draft.dueDate) : undefined

    // Persist a chosen attachment (data URL captured by AttachmentDropdown).
    const attachments =
      draft.attachmentName && draft.attachmentDataUrl && draft.attachmentFile
        ? [
            {
              id: globalThis.crypto.randomUUID(),
              name: draft.attachmentName,
              type: draft.attachmentFile.type || "application/octet-stream",
              size: draft.attachmentFile.size,
              dataUrl: draft.attachmentDataUrl,
              createdAt: Date.now(),
            },
          ]
        : []
    const attachmentPhoto =
      attachments[0] && attachments[0].type.startsWith("image/") ? attachments[0].dataUrl : undefined

    const hasScheduledTime = Boolean(time)
    const resolvedSection: TaskSection =
      effectivePriority === "urgent" ? "urgent" : hasScheduledTime ? "schedule" : "allday"

    addCalendarTodo({
      text: title,
      completed: false,
      date: dateKey,
      time,
      durationMinutes: draft.duration ?? parsed?.duration ?? undefined,
      reminderOffsetMinutes: reminderOffset,
      dueDate: dueDateKey,
      attachments: attachments.length ? attachments : undefined,
      photoDataUrl: attachmentPhoto,
      // url/phone/address are real fields (rendered as functional chips on the
      // task) — they don't belong in the notes text.
      notes: [draft.notes, parsed?.notes].filter(Boolean).join("\n") || undefined,
      location: address || undefined,
      url: url || undefined,
      phone: phone || undefined,
      color: draft.color || undefined,
      icon: draft.icon || undefined,
      priority: effectivePriority,
      labelIds,
      subtasks: draft.subtasks.filter((item) => item.trim()).map((title) => ({
        id: globalThis.crypto.randomUUID(),
        title,
        completed: false,
        parentId: "",
      })),
      section: resolvedSection,
      endOfDay: resolvedSection === "allday",
      rollover: false,
      dismissed: false,
      ...recurringFields,
      ...repeatFields,
    })

    setDraft(createDefaultDraft())
    lockedPanelRef.current = null
    setOpenPanel(null)
    setIconsVisible(false)
  }

  // Window-level fallback: Enter adds the task even when focus has escaped the
  // container (body, or the portaled ColorPicker) while a dropdown is open.
  useQuickAddGlobalKeys({
    containerRef,
    isActive: () => openPanel !== null,
    onSubmit: () => void handleSubmit(),
    onEscape: () => {
      lockedPanelRef.current = null
      setOpenPanel(null)
      setIconsVisible(false)
    },
  })

  // Enter should add the task no matter where focus is inside the quick-add —
  // including while a dropdown (Schedule/Priority/etc.) is open.
  const handleContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      lockedPanelRef.current = null
      setOpenPanel(null)
      setIconsVisible(false)
      return
    }
    if (event.key !== "Enter" || event.shiftKey) return

    const target = event.target as HTMLElement
    const tag = target.tagName

    // Let multi-line notes keep their newlines.
    if (tag === "TEXTAREA") return

    // If a dropdown's own text field has focus (e.g. the Schedule date input),
    // commit it first (its onBlur parses the value), then submit on the next
    // tick so the parsed value is in the draft.
    if (tag === "INPUT" && target.getAttribute("data-quick-task-input") !== "true") {
      event.preventDefault()
      ;(target as HTMLInputElement).blur()
      window.setTimeout(() => void handleSubmit(), 0)
      return
    }

    // Title input, a panel button, or the panel surface itself → just submit.
    event.preventDefault()
    void handleSubmit()
  }

  // flex centering kills the inline-SVG baseline gap that made icons sit at
  // slightly different heights depending on whether they had a wrapper div.
  const iconButtonClass = "flex items-center justify-center text-[#8e8e8e] transition-all duration-200 hover:text-[#3d3d3d]"

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleContainerKeyDown}>
      {/* Row 1: input + plus */}
      <div className="flex items-center gap-3 text-[#8e8e8e]">
        <input
          data-quick-task-input="true"
          ref={inputRef}
          value={draft.title}
          onFocus={() => setIconsVisible(true)}
          onChange={(event) => updateDraft({ title: event.target.value })}
          placeholder="Add New Task"
          className="h-7 flex-1 bg-transparent text-[15px] font-normal text-[#111] outline-none placeholder:font-light placeholder:text-[#b9b9b9]"
        />

        {/* Calendar — only shown in compact state (hidden when expanded row is visible) */}
        {!showIconRow ? (
          <div className="relative flex items-center">
            <button
              type="button"
              // Click-only by design: this compact icon must not open the
              // dropdown (or show anything else) on hover.
              onClick={() => handleIconClick("calendar")}
              className={iconButtonClass}
              aria-label="Schedule"
            >
              <CalendarDays size={17} />
            </button>
            {openPanel === "calendar" ? (
              <div className="absolute right-0 top-full z-[70] mt-2">
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
          disabled={isParsing}
          className={iconButtonClass}
          aria-label="Show task options"
        >
          {isParsing ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
        </button>
      </div>

      {/* Row 2: icon row — visible on input focus, + press, or open panel */}
      {showIconRow ? (
        <div className="mt-2 flex items-center justify-end gap-4 pt-1 text-[#8e8e8e]">
          {/* Calendar */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => handleIconClick("calendar")}
              onMouseEnter={() => handleIconHoverEnter("calendar")}              className={iconButtonClass}
              aria-label="Schedule"
            >
              <CalendarDays size={17} />
            </button>
            {openPanel === "calendar" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"              >
                <CalendarDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>

          {/* Priority */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => handleIconClick("priority")}
              onMouseEnter={() => handleIconHoverEnter("priority")}              className={iconButtonClass}
              aria-label="Priority"
            >
              <Flag size={17} />
            </button>
            {openPanel === "priority" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"              >
                <PriorityDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>

          {/* Attachment */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => handleIconClick("attachment")}
              onMouseEnter={() => handleIconHoverEnter("attachment")}              className={iconButtonClass}
              aria-label="Attachment"
            >
              <Paperclip size={17} />
            </button>
            {openPanel === "attachment" ? (
              <div
                className="absolute right-0 top-full z-[70] mt-2"              >
                <AttachmentDropdown value={draft} onChange={updateDraft} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

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

const createDefaultDraft = (): TaskDraftState => ({
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
  const [isFocused, setIsFocused] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
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
        setOpenPanel(null)
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

  const isTyping = draft.title.trim().length > 0
  const isExpanded = isFocused || isTyping || openPanel !== null

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
      notes: [draft.notes, parsed?.notes, url, phone, address].filter(Boolean).join("\n") || undefined,
      location: address || undefined,
      url: url || undefined,
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
    setOpenPanel(null)
  }

  // Enter should add the task no matter where focus is inside the quick-add —
  // including while a dropdown (Schedule/Priority/etc.) is open.
  const handleContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpenPanel(null)
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

  const iconButtonClass = "text-[#8e8e8e] transition-all duration-200 hover:text-[#3d3d3d]"

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleContainerKeyDown}>
      <div className="transition-all duration-200">
        <div className="flex items-center gap-3 text-[#8e8e8e]">
          <input
            data-quick-task-input="true"
            ref={inputRef}
            value={draft.title}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              window.setTimeout(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setIsFocused(false)
                }
              }, 0)
            }}
            onChange={(event) => updateDraft({ title: event.target.value })}
            placeholder="Add New Task"
            className="h-7 flex-1 bg-transparent text-[15px] font-normal text-[#111] outline-none placeholder:font-light placeholder:text-[#b9b9b9]"
          />

          <button type="button" onClick={() => void handleSubmit()} disabled={isParsing} className={iconButtonClass} aria-label="Add task">
            {isParsing ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
          </button>

          {!isExpanded ? (
            <button
              type="button"
              onClick={() => {
                setIsFocused(true)
                setOpenPanel((current) => (current === "calendar" ? null : "calendar"))
              }}
              className={iconButtonClass}
              aria-label="Schedule"
            >
              <CalendarDays size={17} />
            </button>
          ) : null}
        </div>

        <div
          className={[
            "grid transition-all duration-200",
            isExpanded ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          ].join(" ")}
        >
          <div className={isExpanded ? "overflow-visible" : "overflow-hidden"}>
            <div className="flex items-center gap-4 pt-1 text-[#8e8e8e]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenPanel((current) => (current === "calendar" ? null : "calendar"))}
                  className={iconButtonClass}
                  aria-label="Schedule"
                >
                  <CalendarDays size={17} />
                </button>
                {openPanel === "calendar" ? (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <CalendarDropdown value={draft} onChange={updateDraft} />
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenPanel((current) => (current === "priority" ? null : "priority"))}
                  className={iconButtonClass}
                  aria-label="Priority"
                >
                  <Flag size={17} />
                </button>
                {openPanel === "priority" ? (
                  <div className="absolute left-0 top-full z-[60] mt-2">
                    <PriorityDropdown value={draft} onChange={updateDraft} />
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenPanel((current) => (current === "attachment" ? null : "attachment"))}
                  className={iconButtonClass}
                  aria-label="Attachment"
                >
                  <Paperclip size={17} />
                </button>
                {openPanel === "attachment" ? (
                  <div className="absolute left-0 top-full z-50 mt-2">
                    <AttachmentDropdown value={draft} onChange={updateDraft} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

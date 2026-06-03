"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, Flag, Paperclip, Plus } from "lucide-react"
import { CalendarDropdown } from "@/components/task-creation/CalendarDropdown"
import { AttachmentDropdown } from "@/components/task-creation/AttachmentDropdown"
import { PriorityDropdown } from "@/components/task-creation/PriorityDropdown"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"

export type TaskPriority = "none" | "urgent" | "high" | "medium" | "low"
export type TaskSection = "urgent" | "schedule" | "allday"

export type TaskDraftState = {
  title: string
  section: TaskSection
  scheduleDate: Date | null
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
  notes: string
}

type DailySectionKey = "urgent" | "schedule" | "allday"
type StoreTodoWithDailyFields = Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }

const createDefaultDraft = (): TaskDraftState => ({
  title: "",
  section: "allday",
  scheduleDate: null,
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
  notes: "",
})

export function QuickInputBar() {
  const [draft, setDraft] = useState<TaskDraftState>(() => createDefaultDraft())
  const [openPanel, setOpenPanel] = useState<"calendar" | "priority" | "attachment" | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (todo: Partial<StoreTodoWithDailyFields>) => string
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
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
  const scheduleDateKey = useMemo(() => formatLocalDateKey(draft.scheduleDate ?? new Date()), [draft.scheduleDate])

  const handleSubmit = () => {
    const trimmed = draft.title.trim()
    if (!trimmed) return

    const hasScheduledTime = Boolean(draft.scheduleTime?.trim())
    const labelIds = ensureLabelIds(draft.collections)
    const resolvedSection: TaskSection =
      draft.priority === "urgent"
        ? "urgent"
        : hasScheduledTime
          ? "schedule"
          : "allday"

    addCalendarTodo({
      text: trimmed,
      completed: false,
      date: scheduleDateKey,
      time: draft.scheduleTime ?? undefined,
      durationMinutes: draft.duration ?? undefined,
      notes: [draft.notes, draft.url, draft.phone, draft.address].filter(Boolean).join("\n") || undefined,
      location: draft.address || undefined,
      url: draft.url || undefined,
      color: draft.color || undefined,
      icon: draft.icon || undefined,
      priority: draft.priority === "none" ? "normal" : draft.priority,
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
    })

    setDraft(createDefaultDraft())
    setOpenPanel(null)
  }

  const iconButtonClass = "text-[#8e8e8e] transition-all duration-200 hover:text-[#3d3d3d]"

  return (
    <div ref={containerRef} className="relative">
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
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleSubmit()
              }
              if (event.key === "Escape") {
                setOpenPanel(null)
              }
            }}
            placeholder="Add New Task"
            className="h-7 flex-1 bg-transparent text-[15px] font-light text-[#666] outline-none placeholder:text-[#b9b9b9]"
          />

          <button type="button" onClick={handleSubmit} className={iconButtonClass} aria-label="Add task">
            <Plus size={17} />
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
                  <div className="absolute left-0 top-full z-50 mt-2">
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

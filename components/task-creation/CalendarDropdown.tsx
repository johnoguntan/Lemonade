"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, X } from "lucide-react"
import { TimeWheelPicker } from "@/components/task-creation/TimeWheelPicker"
import { RepeatPicker } from "@/components/task-creation/RepeatPicker"
import type { RepeatConfig } from "@/components/task-creation/RepeatPicker"
import type { TaskDraftState } from "@/components/task-creation/QuickInputBar"
import { parseFlexibleDate } from "@/lib/date-parse"

type CalendarDropdownProps = {
  value: TaskDraftState
  onChange: (updates: Partial<TaskDraftState>) => void
}

type PickerTarget = "schedule" | "dueDate" | "scheduleTime" | "dueTime" | "repeat" | "alert" | "snooze" | "customDuration"
type TimeAnchor = "today" | "tomorrow" | null

const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const dayLabels = ["S", "M", "T", "W", "T", "F", "S"]
const durationOptions = [
  ["1 Min", 1], ["5 Min", 5], ["10 Min", 10], ["20 Min", 20], ["30 Min", 30],
  ["45 Min", 45], ["1 Hour", 60], ["90 Min", 90], ["2 Hours", 120], ["2½ Hours", 150], ["3 Hours", 180],
] as const
const alertOptions = ["None", "At time of event", "5 min before", "10 min before", "15 min before", "30 min before", "1 hour before", "1 day before"]
const snoozeOptions = ["None", "Later today", "Tomorrow", "Next week", "Custom"]

const formatInputDate = (date: Date | null) => {
  if (!date) return ""
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${month}/${day}/${date.getFullYear()}`
}

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

const getDurationPillWidth = (duration: number) => {
  if (duration <= 5) return 92
  if (duration <= 20) return 104
  if (duration <= 45) return 112
  if (duration <= 90) return 118
  if (duration <= 120) return 132
  if (duration <= 150) return 148
  return 122
}

const startOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function MiniCalendar({
  value,
  onSelect,
  timeValue,
  onTimeOpen,
  onClose,
}: {
  value: Date | null
  onSelect: (date: Date) => void
  timeValue?: string | null
  onTimeOpen?: () => void
  onClose?: () => void
}) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(value ?? today)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const dates = useMemo(() => {
    const first = new Date(year, month, 1)
    const start = new Date(year, month, 1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const next = new Date(start)
      next.setDate(start.getDate() + index)
      return next
    })
  }, [month, year])

  return (
    <div className="w-[272px] rounded-[20px] bg-black p-4 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="bg-white px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-black">
          {formatInputDate(value ?? viewDate)}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calendar"
            className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="mt-3 text-[18px] tracking-[0.02em]">{year}</div>
        <div className="flex flex-col text-white/55">
          <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear() + 1, current.getMonth(), 1))}>
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear() - 1, current.getMonth(), 1))}>
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-x-2 gap-y-3 text-[10px] tracking-[0.16em] text-white/60">
        {monthLabels.map((label, index) => (
          <button key={label} type="button" onClick={() => setViewDate(new Date(year, index, 1))}>
            <span className={index === month ? "bg-white px-1.5 py-0.5 text-black" : ""}>{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
          <ChevronLeft size={15} />
        </button>
        <div className="text-[22px] font-semibold tracking-[0.12em]">{monthLabels[month]}</div>
        <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-[10px] tracking-[0.16em] text-white/45">
        {dayLabels.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[12px]">
        {dates.map((date) => {
          const inMonth = date.getMonth() === month
          const active =
            value &&
            date.getFullYear() === value.getFullYear() &&
            date.getMonth() === value.getMonth() &&
            date.getDate() === value.getDate()
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()

          return (
            <button key={date.toISOString()} type="button" onClick={() => onSelect(date)} className="flex justify-center">
              <span
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  active || isToday ? "bg-[#0d4f8b] text-white ring-1 ring-[#194f84]" : "",
                  inMonth ? "text-white" : "text-white/20",
                ].join(" ")}
              >
                {date.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {onTimeOpen ? (
        <div className="mt-6 flex items-center gap-3">
          <span className="text-[12px] font-semibold tracking-[0.18em] text-white">TIME</span>
          <button
            type="button"
            onClick={onTimeOpen}
            className="h-9 min-w-[132px] rounded-full bg-white px-4 text-[13px] font-medium text-black transition hover:bg-white/90"
          >
            {timeValue ?? "10:00 AM"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function RowButton({
  label,
  selected,
  onClick,
  rightContent,
}: {
  label: string
  selected?: boolean
  onClick?: () => void
  rightContent?: React.ReactNode
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3 py-1 text-left">
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="text-[17px] text-gray-900">{label}</span>
      </button>
      {rightContent ? (
        <span className={selected ? "rounded-full bg-[#dfeafe] px-3 py-1 text-sm text-gray-900" : ""}>{rightContent}</span>
      ) : null}
    </div>
  )
}

function FloatingPopover({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`absolute left-0 top-full z-20 mt-3 ${className}`}>
      {children}
    </div>
  )
}

export function CalendarDropdown({ value, onChange }: CalendarDropdownProps) {
  const [openPicker, setOpenPicker] = useState<PickerTarget | null>(null)
  const [timeAnchor, setTimeAnchor] = useState<TimeAnchor>(null)
  const [calendarTimeOpen, setCalendarTimeOpen] = useState(false)
  const [scheduleInput, setScheduleInput] = useState(formatInputDate(value.scheduleDate))
  const [dueInput, setDueInput] = useState(formatInputDate(value.dueDate))
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setScheduleInput(formatInputDate(value.scheduleDate))
  }, [value.scheduleDate])

  useEffect(() => {
    setDueInput(formatInputDate(value.dueDate))
  }, [value.dueDate])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpenPicker(null)
        setTimeAnchor(null)
        setCalendarTimeOpen(false)
      }
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [])

  const applyShortcut = (type: "today" | "tomorrow" | "nextWeek" | "nextMonth" | "nextYear" | "whenever") => {
    const today = startOfDay(new Date())

    if (type === "whenever") {
      onChange({ scheduleDate: null, scheduleTime: null })
      return
    }

    if (type === "today") onChange({ scheduleDate: today })
    if (type === "tomorrow") onChange({ scheduleDate: addDays(today, 1) })
    if (type === "nextWeek") onChange({ scheduleDate: addDays(today, 7), scheduleTime: null })
    if (type === "nextMonth") onChange({ scheduleDate: addDays(today, 30), scheduleTime: null })
    if (type === "nextYear") onChange({ scheduleDate: addDays(today, 365), scheduleTime: null })
  }

  const toggleScheduleTime = (anchor: Exclude<TimeAnchor, null>) => {
    const shouldClose = openPicker === "scheduleTime" && timeAnchor === anchor
    setTimeAnchor(shouldClose ? null : anchor)
    setCalendarTimeOpen(false)
    setOpenPicker(shouldClose ? null : "scheduleTime")
  }

  return (
    <div ref={panelRef} className="w-[380px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
      <div className="space-y-4">
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] text-gray-900">Schedule</span>
            <div className="relative flex items-center gap-2">
              <input
                value={scheduleInput}
                onChange={(event) => setScheduleInput(event.target.value)}
                onBlur={() => {
                  const parsed = parseFlexibleDate(scheduleInput)
                  if (parsed) onChange({ scheduleDate: parsed })
                  else setScheduleInput(formatInputDate(value.scheduleDate))
                }}
                placeholder="e.g. 2/10/2026 or 4th of July"
                className="rounded-full bg-[#dfeafe] px-4 py-1 text-sm outline-none"
              />
              <button type="button" onClick={() => setOpenPicker((current) => (current === "schedule" ? null : "schedule"))}>
                <CalendarDays size={18} className="text-gray-500" />
              </button>

              {openPicker === "schedule" ? (
                <div className="absolute right-0 top-full z-30 mt-3">
                  <div className="relative">
                    <MiniCalendar
                      value={value.scheduleDate}
                      onSelect={(date) => onChange({ scheduleDate: date })}
                      timeValue={value.scheduleTime}
                      onTimeOpen={() => setCalendarTimeOpen((current) => !current)}
                      onClose={() => {
                        setOpenPicker(null)
                        setCalendarTimeOpen(false)
                      }}
                    />
                    {calendarTimeOpen ? (
                      <div className="absolute left-0 top-full z-30 mt-3 w-[272px] rounded-[20px] border border-black/10 bg-white p-3 shadow-2xl">
                        <TimeWheelPicker value={value.scheduleTime} onChange={(scheduleTime) => onChange({ scheduleTime })} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <RowButton
              label="Today at"
              selected={Boolean(value.scheduleDate && startOfDay(value.scheduleDate).getTime() === startOfDay(new Date()).getTime())}
              onClick={() => applyShortcut("today")}
              rightContent={
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleScheduleTime("today")}
                  >
                    {value.scheduleTime ?? "10:00 AM"} <ChevronDown className="inline" size={16} />
                  </button>
                  {openPicker === "scheduleTime" && timeAnchor === "today" ? (
                    <div className="absolute right-0 top-full z-30 mt-2 w-[236px] rounded-2xl border border-gray-100 bg-white p-3 shadow-xl">
                      <TimeWheelPicker value={value.scheduleTime} onChange={(scheduleTime) => onChange({ scheduleTime })} />
                    </div>
                  ) : null}
                </div>
              }
            />
            <RowButton
              label="Tomorrow"
              selected={Boolean(value.scheduleDate && startOfDay(value.scheduleDate).getTime() === startOfDay(addDays(new Date(), 1)).getTime())}
              onClick={() => applyShortcut("tomorrow")}
              rightContent={
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleScheduleTime("tomorrow")}
                  >
                    {value.scheduleTime ?? "10:00 AM"} <ChevronDown className="inline" size={16} />
                  </button>
                  {openPicker === "scheduleTime" && timeAnchor === "tomorrow" ? (
                    <div className="absolute right-0 top-full z-30 mt-2 w-[236px] rounded-2xl border border-gray-100 bg-white p-3 shadow-xl">
                      <TimeWheelPicker value={value.scheduleTime} onChange={(scheduleTime) => onChange({ scheduleTime })} />
                    </div>
                  ) : null}
                </div>
              }
            />
            <RowButton label="Next Week" selected={false} onClick={() => applyShortcut("nextWeek")} />
            <RowButton label="Next Month" selected={false} onClick={() => applyShortcut("nextMonth")} />
            <RowButton label="Next Year" selected={false} onClick={() => applyShortcut("nextYear")} />
            <RowButton label="Whenever" selected={value.scheduleDate === null} onClick={() => applyShortcut("whenever")} />
          </div>
        </div>

        <div className="relative border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] text-gray-900">Due Date</span>
            <div className="flex items-center gap-2">
              <input
                value={dueInput}
                onChange={(event) => setDueInput(event.target.value)}
                onBlur={() => {
                  const parsed = parseFlexibleDate(dueInput)
                  if (parsed) onChange({ dueDate: parsed })
                  else setDueInput(formatInputDate(value.dueDate))
                }}
                placeholder="e.g. 2/10/2026 or 4th of July"
                className="rounded-full bg-[#dfeafe] px-4 py-1 text-sm outline-none"
              />
              <button type="button" onClick={() => setOpenPicker((current) => (current === "dueDate" ? null : "dueDate"))}>
                <CalendarDays size={18} className="text-gray-500" />
              </button>
            </div>
          </div>

          {openPicker === "dueDate" ? (
            <FloatingPopover>
              <MiniCalendar
                value={value.dueDate}
                onSelect={(date) => onChange({ dueDate: date })}
                onClose={() => setOpenPicker(null)}
              />
            </FloatingPopover>
          ) : null}
        </div>

        <div className="relative border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[17px] text-gray-900">Duration</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenPicker((current) => (current === "customDuration" ? null : "customDuration"))}
                className="rounded-full bg-[#dfeafe] px-4 py-1 text-sm"
              >
                {value.duration ? `${value.duration >= 60 ? `${value.duration / 60} Hour` : `${value.duration} Min`}` : "Custom"} <ChevronDown className="inline" size={16} />
              </button>
              <Clock3 size={18} className="text-gray-500" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {durationOptions.map(([label, duration]) => {
              const isSelected = value.duration === duration
              // Water level scales with duration (sqrt so 1 Min still shows a
              // visible splash and 3 Hours nearly fills the pill).
              const level = Math.round(18 + Math.sqrt(duration / 180) * 78)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange({ duration })}
                  className={[
                    "relative h-11 overflow-hidden rounded-full border bg-white text-sm transition-all duration-200 hover:-translate-y-0.5",
                    isSelected
                      ? "border-cyan-400/70 shadow-[0_5px_16px_rgba(8,145,178,0.22)]"
                      : "border-gray-200 hover:border-gray-300",
                  ].join(" ")}
                  style={{ width: `${getDurationPillWidth(duration)}px` }}
                >
                  {isSelected ? (
                    <span
                      aria-hidden="true"
                      data-liquid-anim
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: `${level}%`,
                        animation: "liquid-bob 3.2s ease-in-out infinite",
                      }}
                    >
                      {/* water body */}
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)",
                        }}
                      />
                      {/* back wave crest (lighter, slower) */}
                      <svg
                        viewBox="0 0 48 14"
                        preserveAspectRatio="none"
                        data-liquid-anim
                        style={{
                          position: "absolute",
                          left: 0,
                          top: -8,
                          width: "200%",
                          height: 12,
                          opacity: 0.55,
                          animation: "liquid-wave-move 2.4s linear infinite",
                        }}
                      >
                        <path d="M0 7 Q6 1 12 7 T24 7 T36 7 T48 7 V14 H0 Z" fill="#67e8f9" />
                      </svg>
                      {/* front wave crest (darker, faster) */}
                      <svg
                        viewBox="0 0 48 14"
                        preserveAspectRatio="none"
                        data-liquid-anim
                        style={{
                          position: "absolute",
                          left: 0,
                          top: -6,
                          width: "200%",
                          height: 12,
                          animation: "liquid-wave-move 1.4s linear infinite reverse",
                        }}
                      >
                        <path d="M0 7 Q6 13 12 7 T24 7 T36 7 T48 7 V14 H0 Z" fill="#06b6d4" />
                      </svg>
                    </span>
                  ) : null}
                  <span
                    className={[
                      "relative z-10 flex h-full items-center justify-center px-4 text-center font-medium leading-tight transition-colors duration-200",
                      isSelected ? "text-[#06363f]" : "text-gray-600",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          {openPicker === "customDuration" ? (
            <FloatingPopover className="w-[260px]">
              <input
                defaultValue={value.duration ?? ""}
                placeholder="36 hours or 20 minutes"
                onBlur={(event) => {
                  const text = event.target.value.trim().toLowerCase()
                  const number = Number.parseFloat(text)
                  if (!Number.isFinite(number)) return
                  const minutes = text.includes("hour") ? Math.round(number * 60) : Math.round(number)
                  onChange({ duration: minutes })
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none shadow-lg"
              />
            </FloatingPopover>
          ) : null}
        </div>

        <div className="relative border-t border-gray-100 pt-4">
          <RowButton
            label="Repeat"
            rightContent={
              <button type="button" onClick={() => setOpenPicker((current) => (current === "repeat" ? null : "repeat"))}>
                {value.repeat ? value.repeat.frequency[0].toUpperCase() + value.repeat.frequency.slice(1) : "Never"} <ChevronDown className="inline" size={16} />
              </button>
            }
          />

          {openPicker === "repeat" ? (
            <FloatingPopover className="w-[320px]">
              <RepeatPicker
                value={value.repeat as RepeatConfig | null}
                onChange={(repeat) => onChange({ repeat })}
                onClose={() => setOpenPicker(null)}
              />
            </FloatingPopover>
          ) : null}
        </div>

        <div className="relative border-t border-gray-100 pt-4">
          <RowButton
            label="Alert"
            rightContent={
              <button type="button" onClick={() => setOpenPicker((current) => (current === "alert" ? null : "alert"))}>
                {value.alert ?? "None"} <ChevronDown className="inline" size={16} />
              </button>
            }
          />

          {openPicker === "alert" ? (
            <FloatingPopover className="w-[240px]">
              <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-lg">
                <div className="space-y-1">
                  {alertOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onChange({ alert: option === "None" ? null : option })
                        setOpenPicker(null)
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </FloatingPopover>
          ) : null}
        </div>

        <div className="relative border-t border-gray-100 pt-4">
          <RowButton
            label="Snooze"
            rightContent={
              <button type="button" onClick={() => setOpenPicker((current) => (current === "snooze" ? null : "snooze"))}>
                {value.snooze ?? "Custom"} <ChevronDown className="inline" size={16} />
              </button>
            }
          />

          {openPicker === "snooze" ? (
            <FloatingPopover className="w-[280px]">
              <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-lg">
                <div className="space-y-1">
                  {snoozeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onChange({ snooze: option === "None" ? null : option })
                        if (option !== "Custom") setOpenPicker(null)
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {value.snooze === "Custom" ? (
                  <div className="mt-3">
                    <MiniCalendar value={value.scheduleDate} onSelect={(date) => onChange({ dueDate: date })} />
                  </div>
                ) : null}
              </div>
            </FloatingPopover>
          ) : null}
        </div>
      </div>
    </div>
  )
}

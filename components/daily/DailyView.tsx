"use client"

import { useMemo } from "react"
import { DailySection } from "@/components/daily/DailySection"
import { QuickInputBar } from "@/components/task-creation/QuickInputBar"
import { useLemonadeStore, type Todo } from "@/lib/store"

type DailySectionKey = "urgent" | "schedule" | "allday"

type DailyTodo = Todo & {
  section?: DailySectionKey
  rollover?: boolean
  dismissed?: boolean
}

const formatHeaderDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase()

const isBeforeToday = (value: string, todayKey: string) => value < todayKey

// Big heading: "TODAY" only when the selected day is actually today; otherwise a
// relative word or the weekday, so picking another date is reflected up top.
const getHeaderTitle = (selected: Date, todayKey: string, selectedKey: string) => {
  if (selectedKey === todayKey) return "TODAY"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sel = new Date(selected)
  sel.setHours(0, 0, 0, 0)
  const diffDays = Math.round((sel.getTime() - today.getTime()) / 86400000)
  if (diffDays === 1) return "TOMORROW"
  if (diffDays === -1) return "YESTERDAY"
  return selected.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
}

export function DailyView() {
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos) as DailyTodo[]
  const selectedCalendarDate = useLemonadeStore((state) => state.selectedCalendarDate)
  const todayKey = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = `${now.getMonth() + 1}`.padStart(2, "0")
    const day = `${now.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [])

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedCalendarDate.split("-").map(Number)
    return new Date(year, (month ?? 1) - 1, day ?? 1)
  }, [selectedCalendarDate])
  const selectedDateKey = selectedCalendarDate
  const isToday = selectedDateKey === todayKey
  const headerTitle = getHeaderTitle(selectedDate, todayKey, selectedDateKey)

  const visibleTodos = useMemo(
    () => calendarTodos.filter((todo) => !todo.completed && !todo.dismissed && !todo.isHeading),
    [calendarTodos]
  )

  const overdueTodos = useMemo(
    () =>
      visibleTodos
        .filter((todo) => typeof todo.date === "string" && isBeforeToday(todo.date, todayKey))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [todayKey, visibleTodos]
  )

  const urgentTodos = useMemo(
    () =>
      visibleTodos
        .filter(
          (todo) =>
            todo.date === selectedDateKey &&
            !todo.rollover &&
            (todo.section === "urgent" || todo.priority === "urgent" || todo.priority === "high")
        )
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [selectedDateKey, visibleTodos]
  )

  const scheduleTodos = useMemo(
    () =>
      visibleTodos
        .filter(
          (todo) =>
            (todo.date === selectedDateKey &&
              todo.section !== "urgent" &&
              Boolean(todo.time && todo.time.trim().length > 0)) ||
            // Rolled-over tasks only belong on today's schedule, not every date.
            (isToday && Boolean(todo.rollover))
        )
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [selectedDateKey, visibleTodos, isToday]
  )

  const allDayTodos = useMemo(
    () =>
      visibleTodos
        .filter(
          (todo) =>
            todo.date === selectedDateKey &&
            todo.section !== "urgent" &&
            !todo.rollover &&
            !Boolean(todo.time && todo.time.trim().length > 0)
        )
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [selectedDateKey, visibleTodos]
  )

  return (
    <section className="flex h-full w-full flex-col overflow-y-auto border-r border-black/10 bg-[#fcfcfa] text-gray-900">
      <div className="border-b border-black/10 px-12 py-5">
        <QuickInputBar />
      </div>

      <div className="flex-1 px-12 py-7">
        <header>
          <div className="flex items-start gap-2.5">
            <h1 className="font-heading text-[40px] leading-none tracking-[-0.03em] text-black">{headerTitle}</h1>
            {isToday ? <span className="pt-1 text-[32px] leading-none">🦮</span> : null}
          </div>
          <p className="mt-1 text-[13px] font-medium tracking-[-0.01em] text-black">{formatHeaderDate(selectedDate)}</p>
        </header>

        <div className="mt-9 space-y-8 pb-12">
          <DailySection title="SCHEDULE" todos={scheduleTodos} />
          <DailySection title="URGENT" todos={urgentTodos} />
          <DailySection title="ALL DAY" todos={allDayTodos} />
          {isToday ? <DailySection title="OVERDUE" todos={overdueTodos} showOverdueActions /> : null}
        </div>
      </div>
    </section>
  )
}

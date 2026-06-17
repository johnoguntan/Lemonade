"use client"

import { useEffect, useMemo, useRef } from "react"
import { Search, X } from "lucide-react"
import { DailySection } from "@/components/daily/DailySection"
import { TaskRow } from "@/components/daily/TaskRow"
import { QuickInputBar } from "@/components/task-creation/QuickInputBar"
import { useLemonadeStore, type Todo } from "@/lib/store"

function SearchResultRow({ todo }: { todo: Todo }) {
  const dateLabel = (() => {
    if (!todo.date) return "No date"
    const [y, m, d] = todo.date.split("-").map(Number)
    if (!y || !m || !d) return todo.date
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  })()
  return (
    <div>
      <p className="mb-0.5 text-[10px] uppercase tracking-[0.14em] text-black/30">{dateLabel}</p>
      <TaskRow todo={todo} />
    </div>
  )
}

// Task search is hidden for now — flip to true to re-enable the in-view search bar.
const SHOW_SEARCH = false

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
  const searchQuery = useLemonadeStore((state) => state.searchQuery)
  const setSearchQuery = useLemonadeStore((state) => state.setSearchQuery)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Focus the search field when the sidebar search icon is clicked.
  useEffect(() => {
    const focus = () => searchInputRef.current?.focus()
    window.addEventListener("allsenadro:focus-search", focus)
    return () => window.removeEventListener("allsenadro:focus-search", focus)
  }, [])
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

  // Completed tasks for the selected day — so they can be seen and un-completed.
  const completedTodos = useMemo(
    () =>
      calendarTodos
        .filter((todo) => todo.completed && !todo.dismissed && !todo.isHeading && todo.date === selectedDateKey)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [calendarTodos, selectedDateKey]
  )

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isSearching = SHOW_SEARCH && trimmedQuery.length > 0
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return []
    return calendarTodos
      .filter((todo) => !todo.dismissed && !todo.isHeading)
      .filter((todo) =>
        [todo.text, todo.notes, todo.location].filter(Boolean).join(" ").toLowerCase().includes(trimmedQuery)
      )
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  }, [calendarTodos, trimmedQuery])

  return (
    <section className="flex h-full w-full flex-col overflow-y-auto border-r border-black/10 bg-[#fcfcfa] text-gray-900">
      <div className="border-b border-black/10 px-12 py-5">
        <QuickInputBar />
      </div>

      {SHOW_SEARCH ? (
        <div className="flex items-center gap-2 border-b border-black/10 px-12 py-2.5">
          <Search size={15} className="shrink-0 text-black/35" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchQuery("")
            }}
            placeholder="Search tasks…"
            className="h-6 flex-1 bg-transparent text-[13px] text-black outline-none placeholder:text-black/35"
          />
          {isSearching ? (
            <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="text-black/35 hover:text-black">
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 px-12 py-7">
        {isSearching ? (
          <div className="pb-12">
            <h2 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#8f8f8f]">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{searchQuery.trim()}”
            </h2>
            {searchResults.length > 0 ? (
              <div className="space-y-1.5">
                {searchResults.map((todo) => (
                  <SearchResultRow key={todo.id} todo={todo} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-black/45">No matching tasks.</p>
            )}
          </div>
        ) : (
          <>
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
              {completedTodos.length > 0 ? <DailySection title="DONE" todos={completedTodos} /> : null}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

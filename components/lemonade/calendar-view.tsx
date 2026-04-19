"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { formatLocalDateKey, useLemonadeStore } from "@/lib/store"
import { DayColumn } from "./day-column"
import { cn } from "@/lib/utils"
import { ChevronUp } from "lucide-react"
import { TodoItem } from "./todo-item"

interface CalendarViewProps {
  startDate: Date
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day') => void
}

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const getDateArray = (startDate: Date, count: number): Date[] =>
  Array.from({ length: count }, (_, index) => addDays(startDate, index))

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function CalendarView({ startDate, onNavigate: _onNavigate }: CalendarViewProps) {
  const {
    preferences,
    calendarTodos,
    searchQuery,
    labelFilterIds,
    activeFilterColor,
    selectedCalendarDate,
    setSelectedCalendarDate,
    calendarTimeframe,
    setCalendarTimeframe,
    calendarFilterMode,
    setCalendarFilterMode,
  } = useLemonadeStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const today = useMemo(() => startOfDay(new Date()), [])
  const todayKey = useMemo(() => formatLocalDateKey(today), [today])
  const visibleStartDate = useMemo(() => startOfDay(startDate), [startDate])
  const expandedDays = useMemo(
    () => getDateArray(visibleStartDate, Math.max(preferences.columns * 10, 35)),
    [preferences.columns, visibleStartDate]
  )
  const futureDays = isExpanded ? expandedDays.slice(1) : []
  const weekdayAbbreviations = useMemo(
    () => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
    []
  )
  const nextThreeDays = useMemo(
    () =>
      [1, 2, 3].map((offset) => {
        const date = addDays(today, offset)
        return {
          label: weekdayAbbreviations[date.getDay()] ?? "DAY",
          dateKey: formatLocalDateKey(date),
        }
      }),
    [today, weekdayAbbreviations]
  )

  const nextWeekStartKey = useMemo(() => {
    const day = today.getDay()
    const daysUntilNextMonday = ((8 - day) % 7) || 7
    return formatLocalDateKey(addDays(today, daysUntilNextMonday))
  }, [today])

  const nextMonthStartKey = useMemo(() => {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return formatLocalDateKey(nextMonth)
  }, [today])

  const nextYearStartKey = useMemo(() => {
    const nextYear = new Date(today.getFullYear() + 1, 0, 1)
    return formatLocalDateKey(nextYear)
  }, [today])

  const pplTodos = useMemo(
    () =>
      calendarTodos.filter((todo) => {
        if (todo.date !== null) return false
        if (!preferences.showCompleted && todo.completed) return false
        if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
        if (activeFilterColor && todo.color !== activeFilterColor) return false
        return true
      }),
    [activeFilterColor, calendarTodos, labelFilterIds, preferences.showCompleted, searchQuery]
  )

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) {
      return
    }

    if (!isExpanded) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [isExpanded])

  return (
    <div className="calendar-focus-mode relative flex flex-1 px-4 pt-6">
      <div className="absolute bottom-[1.4rem] left-[0.35rem] z-[4] flex flex-col items-start gap-[0.12rem]">
        {nextThreeDays.map((entry) => {
          const isActive = calendarFilterMode === "all" && calendarTimeframe === "week" && selectedCalendarDate === entry.dateKey
          return (
            <button
              key={entry.dateKey}
              type="button"
              onClick={() => {
                setCalendarFilterMode("all")
                setCalendarTimeframe("week")
                setSelectedCalendarDate(entry.dateKey)
              }}
              className={cn(
                "calendar-focus-shortcut cursor-pointer",
                isActive && "text-[var(--accent-color)]"
              )}
            >
              {entry.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            setCalendarFilterMode("all")
            setCalendarTimeframe("week")
            setSelectedCalendarDate(todayKey)
          }}
          className={cn(
            "calendar-focus-shortcut cursor-pointer",
            calendarFilterMode === "all" && calendarTimeframe === "week" && selectedCalendarDate === todayKey && "text-[var(--accent-color)]"
          )}
        >
          WEEK
        </button>
        <button
          type="button"
          onClick={() => {
            setCalendarFilterMode("all")
            setCalendarTimeframe("next-week")
            setSelectedCalendarDate(nextWeekStartKey)
          }}
          className={cn(
            "calendar-focus-shortcut cursor-pointer",
            calendarFilterMode === "all" && calendarTimeframe === "next-week" && "text-[var(--accent-color)]"
          )}
        >
          NEXT WEEK
        </button>
        <button
          type="button"
          onClick={() => {
            setCalendarFilterMode("all")
            setCalendarTimeframe("next-month")
            setSelectedCalendarDate(nextMonthStartKey)
          }}
          className={cn(
            "calendar-focus-shortcut cursor-pointer",
            calendarFilterMode === "all" && calendarTimeframe === "next-month" && "text-[var(--accent-color)]"
          )}
        >
          NEXT MONTH
        </button>
        <button
          type="button"
          onClick={() => {
            setCalendarFilterMode("all")
            setCalendarTimeframe("next-year")
            setSelectedCalendarDate(nextYearStartKey)
          }}
          className={cn(
            "calendar-focus-shortcut cursor-pointer",
            calendarFilterMode === "all" && calendarTimeframe === "next-year" && "text-[var(--accent-color)]"
          )}
        >
          NEXT YEAR
        </button>
        <button
          type="button"
          onClick={() => {
            setCalendarTimeframe("week")
            setCalendarFilterMode("ppl")
          }}
          className={cn(
            "calendar-focus-shortcut cursor-pointer",
            calendarFilterMode === "ppl" && "text-[var(--accent-color)]"
          )}
        >
          PPL
        </button>
      </div>

      {!isExpanded ? (
        <button
          type="button"
          className="calendar-focus-overlay"
          aria-label="Show the rest of the calendar"
          onClick={() => setIsExpanded(true)}
        />
      ) : null}

      {isExpanded ? (
        <button
          type="button"
          className="calendar-focus-collapse"
          aria-label="Return to focus mode"
          onClick={() => setIsExpanded(false)}
        >
          <ChevronUp className="size-[13px]" strokeWidth={2.1} />
        </button>
      ) : null}

      <div ref={scrollRef} className="calendar-focus-scroll min-w-0 flex flex-1 flex-col">
        {calendarFilterMode === "ppl" ? (
          <div className="flex flex-1 flex-col px-2">
            <div className="mb-3">
              <div className="lemonade-day-label font-heading uppercase text-[20px] leading-[20px] text-foreground">
                PPL
              </div>
            </div>
            <div className="space-y-1">
              {pplTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} textSizeClass="lemonade-task-text" />
              ))}
              {pplTodos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground dark:bg-[rgba(19,19,19,0.5)]">
                  No procrastination tasks yet.
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>

        <div
          ref={(node) => {
            sectionRefs.current[`${visibleStartDate.getFullYear()}-${visibleStartDate.getMonth()}-${visibleStartDate.getDate()}`] = node
          }}
          className="calendar-focus-day is-collapsed"
        >
          <DayColumn date={visibleStartDate} isToday={isSameDay(visibleStartDate, today)} />
        </div>

        {futureDays.map((date) => {
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          return (
            <div
              key={key}
              ref={(node) => {
                sectionRefs.current[key] = node
              }}
              className={cn("calendar-focus-day", isExpanded ? "is-expanded" : "is-collapsed")}
            >
              <DayColumn
                date={date}
                isToday={isSameDay(date, today)}
              />
            </div>
          )
        })}
          </>
        )}
      </div>
    </div>
  )
}

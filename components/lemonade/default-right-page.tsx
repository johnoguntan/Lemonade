"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { formatLocalDateKey, todoMatchesSearchFilters, useLemonadeStore, type ShortcutType } from "@/lib/store"
import { DayColumn } from "./day-column"
import { cn } from "@/lib/utils"
import { ChevronUp } from "lucide-react"
import { TodoItem } from "./todo-item"
import { setPlannerTaskDragData } from "@/lib/task-dnd"

interface DefaultRightPageProps {
  startDate: Date
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day') => void
}

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate())
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const getDateArray = (startDate: Date, count: number): Date[] =>
  Array.from({ length: count }, (_, index) => addDays(startDate, index))

const endOfWeekSunday = (today: Date) => {
  // JS: 0 = Sunday ... 6 = Saturday
  const day = today.getDay()
  const daysUntilSunday = (7 - day) % 7
  return addDays(today, daysUntilSunday)
}

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)

const endOfYear = (date: Date) => new Date(date.getFullYear(), 11, 31)

const daysBetweenInclusive = (start: Date, end: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.max(1, Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / msPerDay) + 1)
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function DefaultRightPage({ startDate, onNavigate: _onNavigate }: DefaultRightPageProps) {
  const {
    preferences,
    calendarTodos,
    searchQuery,
    searchModeActive,
    taskSearchFilters,
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
  const periodLabel = useMemo(() => {
    if (calendarFilterMode === "ppl") return "PPL"
    if (calendarTimeframe === "next-week") return "NEXT WEEK"
    if (calendarTimeframe === "this-month") return selectedCalendarDate.slice(0, 7) === todayKey.slice(0, 7) ? "THIS MONTH" : "NEXT MONTH"
    if (calendarTimeframe === "this-year") return selectedCalendarDate.slice(0, 4) === todayKey.slice(0, 4) ? "THIS YEAR" : "NEXT YEAR"
    return "THIS WEEK"
  }, [calendarFilterMode, calendarTimeframe, selectedCalendarDate, todayKey])

  const viewRange = useMemo(() => {
    if (calendarFilterMode === "ppl") {
      return { start: visibleStartDate, end: visibleStartDate }
    }

    if (calendarTimeframe === "next-week") {
      const start = visibleStartDate
      const end = addDays(start, 6)
      return { start, end }
    }

    if (calendarTimeframe === "this-month") {
      const start = new Date(visibleStartDate.getFullYear(), visibleStartDate.getMonth(), 1)
      const end = endOfMonth(start)
      return { start, end }
    }

    if (calendarTimeframe === "this-year") {
      const start = new Date(visibleStartDate.getFullYear(), 0, 1)
      const end = endOfYear(start)
      return { start, end }
    }

    // Default: current week view - never show beyond the end of the current week (Sunday).
    const end = endOfWeekSunday(today)
    // If user navigated to a date beyond this week while still in "week" mode, clamp.
    const start = visibleStartDate > end ? today : visibleStartDate
    return { start, end }
  }, [calendarFilterMode, calendarTimeframe, today, visibleStartDate])

  const expandedDays = useMemo(() => {
    if (calendarFilterMode === "ppl") {
      return [visibleStartDate]
    }

    // For year view, avoid rendering 365 empty DayColumns. Render only dates that have tasks (after filters),
    // plus always include the range start date.
    if (calendarTimeframe === "this-year") {
      const startKey = formatLocalDateKey(viewRange.start)
      const endKey = formatLocalDateKey(viewRange.end)
      const keys = new Set<string>([startKey])
      for (const todo of calendarTodos) {
        if (!todo.date) continue
        if (todo.date < startKey || todo.date > endKey) continue
        if (
          !todoMatchesSearchFilters(todo, {
            searchQuery,
            searchModeActive,
            taskSearchFilters,
            labelFilterIds,
            activeFilterColor,
            showCompleted: preferences.showCompleted,
          })
        ) {
          continue
        }
        keys.add(todo.date)
      }
      return [...keys]
        .sort()
        .map((key) => {
          const [y, m, d] = key.split("-").map((v) => Number(v))
          return new Date(y, (m ?? 1) - 1, d ?? 1)
        })
    }

    const count = daysBetweenInclusive(viewRange.start, viewRange.end)
    return getDateArray(viewRange.start, count)
  }, [
    activeFilterColor,
    calendarFilterMode,
    calendarTimeframe,
    calendarTodos,
    labelFilterIds,
    preferences.showCompleted,
    searchModeActive,
    searchQuery,
    taskSearchFilters,
    viewRange.end,
    viewRange.start,
    visibleStartDate,
  ])

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
        return todoMatchesSearchFilters(todo, {
          searchQuery,
          searchModeActive,
          taskSearchFilters,
          labelFilterIds,
          activeFilterColor,
          showCompleted: preferences.showCompleted,
        })
      }),
    [activeFilterColor, calendarTodos, labelFilterIds, preferences.showCompleted, searchModeActive, searchQuery, taskSearchFilters]
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

  // Handle shortcut click - switch to project view for specific shortcuts
  const handleShortcutClick = (shortcut: ShortcutType) => {
    // Set the calendar state as before
    setIsExpanded(true)
    switch (shortcut) {
      case "NEXT_WEEK":
        setCalendarFilterMode("all")
        setCalendarTimeframe("next-week")
        setSelectedCalendarDate(nextWeekStartKey)
        break
      case "NEXT_MONTH":
        setCalendarFilterMode("all")
        setCalendarTimeframe("this-month")
        setSelectedCalendarDate(nextMonthStartKey)
        break
      case "NEXT_YEAR":
        setCalendarFilterMode("all")
        setCalendarTimeframe("this-year")
        setSelectedCalendarDate(nextYearStartKey)
        break
      case "PPL":
        setCalendarTimeframe("week")
        setCalendarFilterMode("ppl")
        break
    }
  }

  // Check if a shortcut is active (for highlighting)
  const isShortcutActive = (shortcut: ShortcutType): boolean => {
    switch (shortcut) {
      case "NEXT_WEEK":
        return calendarFilterMode === "all" && calendarTimeframe === "next-week"
      case "NEXT_MONTH":
        return calendarFilterMode === "all" && calendarTimeframe === "this-month"
      case "NEXT_YEAR":
        return calendarFilterMode === "all" && calendarTimeframe === "this-year"
      case "PPL":
        return calendarFilterMode === "ppl"
      default:
        return false
    }
  }

  const handlePplTodoDragStart = (event: DragEvent<HTMLDivElement>, todoId: string) => {
    setPlannerTaskDragData(event, { todoId, source: "calendar" })
  }

  return (
    <div className="calendar-focus-mode relative flex flex-1 flex-row pt-6">
      {/* LEFT MARGIN STRIP */}
      <div
        className="flex h-full w-[32px] flex-col items-center border-r border-black/10"
        aria-label="Date shortcuts"
      >
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
                "calendar-focus-shortcut w-full cursor-pointer py-1 text-center text-[9px] leading-none tracking-[0.18em] text-muted-foreground hover:text-foreground",
                "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180",
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
            setIsExpanded(false)
          }}
          className={cn(
            "calendar-focus-shortcut w-full cursor-pointer py-1 text-center text-[9px] leading-none tracking-[0.18em] text-muted-foreground hover:text-foreground",
            "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180",
            calendarFilterMode === "all" && calendarTimeframe === "week" && "text-[var(--accent-color)]"
          )}
        >
          WEEK
        </button>
        <button
          type="button"
          onClick={() => handleShortcutClick("NEXT_WEEK")}
          className={cn(
            "calendar-focus-shortcut w-full cursor-pointer py-1 text-center text-[9px] leading-none tracking-[0.18em] text-muted-foreground hover:text-foreground",
            "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180",
            isShortcutActive("NEXT_WEEK") && "text-[var(--accent-color)]"
          )}
        >
          NEXT WEEK
        </button>
        <button
          type="button"
          onClick={() => handleShortcutClick("NEXT_MONTH")}
          className={cn(
            "calendar-focus-shortcut w-full cursor-pointer py-1 text-center text-[9px] leading-none tracking-[0.18em] text-muted-foreground hover:text-foreground",
            "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180",
            isShortcutActive("NEXT_MONTH") && "text-[var(--accent-color)]"
          )}
        >
          NEXT MONTH
        </button>
        <button
          type="button"
          onClick={() => handleShortcutClick("NEXT_YEAR")}
          className={cn(
            "calendar-focus-shortcut w-full cursor-pointer py-1 text-center text-[9px] leading-none tracking-[0.18em] text-muted-foreground hover:text-foreground",
            "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180",
            isShortcutActive("NEXT_YEAR") && "text-[var(--accent-color)]"
          )}
        >
          NEXT YEAR
        </button>
        <button
          type="button"
          onClick={() => handleShortcutClick("PPL")}
          className={cn(
            "calendar-focus-shortcut w-full cursor-pointer py-1 text-center text-[9px] leading-none tracking-[0.18em] text-muted-foreground hover:text-foreground",
            "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180",
            isShortcutActive("PPL") && "text-[var(--accent-color)]"
          )}
        >
          PPL
        </button>
      </div>

      {/* TASK CONTENT AREA */}
      <div className="relative min-w-0 flex-1">
        {calendarFilterMode !== "all" || calendarTimeframe !== "week" ? (
          <div className="px-2 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {periodLabel}
            </div>
          </div>
        ) : null}
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

        <div ref={scrollRef} className="calendar-focus-scroll min-w-0 flex flex-1 flex-col overflow-y-auto pr-4">
        {calendarFilterMode === "ppl" ? (
          <div className="flex flex-1 flex-col px-2">
            <div className="mb-3">
              <div className="lemonade-day-label font-heading uppercase text-[20px] leading-[20px] text-foreground">
                PPL
              </div>
            </div>
            <div className="space-y-1">
              {pplTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  textSizeClass="lemonade-task-text"
                  draggable
                  onDragStart={(event) => handlePplTodoDragStart(event, todo.id)}
                />
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
    </div>
  )
}

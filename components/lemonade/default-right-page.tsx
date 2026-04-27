"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { formatLocalDateKey, todoMatchesSearchFilters, useLemonadeStore } from "@/lib/store"
import { DayColumn } from "./day-column"
import { TodoItem } from "./todo-item"
import { setPlannerTaskDragData } from "@/lib/task-dnd"

interface DefaultRightPageProps {
  startDate: Date
  onNavigate: (direction: "prev-week" | "next-week" | "prev-day" | "next-day" | "today") => void
}

const INITIAL_RENDERED_DAYS = 30
const RENDER_MORE_DAYS = 30
const MAX_RENDERED_DAYS = 365

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const getDateArray = (startDate: Date, count: number): Date[] =>
  Array.from({ length: count }, (_, index) => addDays(startDate, index))

const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
  let current = node?.parentElement ?? null

  while (current) {
    const { overflowY } = window.getComputedStyle(current)
    if (overflowY === "auto" || overflowY === "scroll") {
      return current
    }
    current = current.parentElement
  }

  return null
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

const getDayAnchorId = (dateKey: string) => `calendar-day-${dateKey}`

export function DefaultRightPage({ startDate, onNavigate: _onNavigate }: DefaultRightPageProps) {
  const {
    preferences,
    calendarTodos,
    searchQuery,
    searchModeActive,
    taskSearchFilters,
    labelFilterIds,
    activeFilterColor,
    calendarFilterMode,
    setCalendarPastTodayScroll,
  } = useLemonadeStore()
  const anchorDateKey = formatLocalDateKey(startDate)
  const anchorDate = useMemo(() => startOfDay(startDate), [anchorDateKey])
  const today = useMemo(() => startOfDay(new Date()), [])
  const isAnchoredToToday = useMemo(() => isSameDay(anchorDate, today), [anchorDate, today])
  const [renderedDayCount, setRenderedDayCount] = useState(INITIAL_RENDERED_DAYS)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const loadMoreBottomRef = useRef<HTMLDivElement | null>(null)
  const visibleDays = useMemo(
    () => getDateArray(anchorDate, renderedDayCount),
    [anchorDate, renderedDayCount]
  )

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

  // When the user navigates to a new anchor date (via footer arrows/date picker),
  // start the calendar exactly at that date entry point.
  useEffect(() => {
    const scrollParent = getScrollParent(pageRef.current)
    if (!scrollParent) return
    scrollParent.scrollTo({ top: 0, behavior: "auto" })
  }, [anchorDateKey])

  // Phase 1 (safest): forward-only infinite scroll triggered by scrolling near the bottom.
  useEffect(() => {
    const scrollParent = getScrollParent(pageRef.current)
    if (!scrollParent) return
    scrollParentRef.current = scrollParent

    const thresholdPx = 800
    const todayButtonThresholdPx = 60
    let ticking = false
    let lastPastToday = false

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        ticking = false
        const nearBottom =
          scrollParent.scrollTop + scrollParent.clientHeight >= scrollParent.scrollHeight - thresholdPx
        if (nearBottom) {
          setRenderedDayCount((current) => Math.min(MAX_RENDERED_DAYS, current + RENDER_MORE_DAYS))
        }

        const pastToday = isAnchoredToToday && scrollParent.scrollTop > todayButtonThresholdPx
        if (pastToday !== lastPastToday) {
          lastPastToday = pastToday
          setCalendarPastTodayScroll(pastToday)
        }
      })
    }

    scrollParent.addEventListener("scroll", onScroll, { passive: true })
    // Initialize once.
    onScroll()
    return () => scrollParent.removeEventListener("scroll", onScroll)
  }, [isAnchoredToToday, setCalendarPastTodayScroll])

  useEffect(() => {
    if (!isAnchoredToToday) {
      setCalendarPastTodayScroll(false)
    }
  }, [isAnchoredToToday, setCalendarPastTodayScroll])

  const handlePplTodoDragStart = (event: DragEvent<HTMLDivElement>, todoId: string) => {
    setPlannerTaskDragData(event, { todoId, source: "calendar" })
  }

  return (
    <div id="calendar-left-page-root" ref={pageRef} className="calendar-focus-mode relative px-4 pt-6">
      <div className="relative min-w-0 pb-28 pr-4">
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
            {visibleDays.map((date) => {
              const dateKey = formatLocalDateKey(date)
              return (
                <div
                  key={dateKey}
                  ref={(node) => {
                    sectionRefs.current[dateKey] = node
                  }}
                  className="calendar-focus-day"
                >
                  <DayColumn
                    date={date}
                    isToday={isSameDay(date, today)}
                    anchorId={getDayAnchorId(dateKey)}
                  />
                </div>
              )
            })}
            <div ref={loadMoreBottomRef} className="h-10" aria-hidden="true" />
          </>
        )}
      </div>
    </div>
  )
}

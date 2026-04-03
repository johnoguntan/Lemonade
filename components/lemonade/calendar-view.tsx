"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLemonadeStore } from "@/lib/store"
import { DayColumn } from "./day-column"
import { cn } from "@/lib/utils"
import { ChevronUp } from "lucide-react"

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
  const { preferences } = useLemonadeStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const today = useMemo(() => startOfDay(new Date()), [])
  const visibleStartDate = useMemo(() => startOfDay(startDate), [startDate])
  const expandedDays = useMemo(
    () => getDateArray(visibleStartDate, Math.max(preferences.columns * 10, 35)),
    [preferences.columns, visibleStartDate]
  )
  const futureDays = isExpanded ? expandedDays.slice(1) : []

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
      {!isExpanded ? (
        <button
          type="button"
          className="calendar-focus-overlay"
          aria-label="Show the rest of the calendar"
          onClick={() => setIsExpanded(true)}
        >
          <span className="calendar-focus-shortcut">W</span>
          <span className="calendar-focus-shortcut">T</span>
          <span className="calendar-focus-shortcut">F</span>
        </button>
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
      </div>
    </div>
  )
}

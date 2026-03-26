"use client"

import { useLemonadeStore } from "@/lib/store"
import { DayColumn } from "./day-column"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface CalendarViewProps {
  startDate: Date
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day') => void
}

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const getDateArray = (startDate: Date, count: number): Date[] =>
  Array.from({ length: count }, (_, index) => addDays(startDate, index))

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function CalendarView({ startDate, onNavigate }: CalendarViewProps) {
  const { preferences } = useLemonadeStore()
  const today = new Date()
  const days = getDateArray(startDate, 7).slice(0, preferences.columns)

  return (
    <div className="group/calendar-nav relative flex flex-1 px-10 pt-6">
      <div className="pointer-events-none absolute left-0 top-24 z-10 flex flex-col overflow-hidden rounded-r-md border border-border bg-[rgba(247,248,250,0.95)] opacity-0 transition-opacity duration-200 group-hover/calendar-nav:opacity-100 dark:bg-[rgba(19,19,19,0.9)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate('prev-day')}
          className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-[15px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate('prev-week')}
          className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
        >
          <ChevronsLeft className="size-[15px]" />
        </Button>
      </div>

      <div className="min-w-0 flex flex-1 flex-col">
        {days.map((date) => (
          <DayColumn
            key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
            date={date}
            isToday={isSameDay(date, today)}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute right-0 top-24 z-10 flex flex-col overflow-hidden rounded-l-md border border-border bg-[rgba(247,248,250,0.95)] opacity-0 transition-opacity duration-200 group-hover/calendar-nav:opacity-100 dark:bg-[rgba(19,19,19,0.9)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate('next-day')}
          className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-[15px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate('next-week')}
          className="pointer-events-auto size-8 rounded-none text-muted-foreground hover:text-foreground"
        >
          <ChevronsRight className="size-[15px]" />
        </Button>
      </div>
    </div>
  )
}

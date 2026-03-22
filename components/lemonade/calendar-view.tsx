"use client"

import { useLemonadeStore } from "@/lib/store"
import { DayColumn } from "./day-column"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CalendarViewProps {
  startDate: Date
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day') => void
}

const getDateArray = (startDate: Date, count: number): Date[] => {
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    dates.push(date)
  }
  return dates
}

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
  
  const dates = getDateArray(startDate, preferences.columns)

  return (
    <div className={cn(
      "group/calendar-nav relative flex flex-1 px-10 pt-6 dark:bg-[#131313]",
      preferences.showDotGridBackground && "journal-dot-grid-dark-only"
    )}>
      <div className={cn(
        "pointer-events-none absolute left-0 top-24 z-10 flex flex-col overflow-hidden rounded-r-md border border-border bg-[#f7f8fa] opacity-0 transition-opacity duration-200 group-hover/calendar-nav:opacity-100 dark:bg-[#131313]",
        preferences.showDotGridBackground && "journal-dot-grid-dark-only"
      )}>
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
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {dates.map((date) => (
          <DayColumn
            key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
            date={date}
            isToday={isSameDay(date, today)}
          />
        ))}
      </div>
      
      <div className={cn(
        "pointer-events-none absolute right-0 top-24 z-10 flex flex-col overflow-hidden rounded-l-md border border-border bg-[#f7f8fa] opacity-0 transition-opacity duration-200 group-hover/calendar-nav:opacity-100 dark:bg-[#131313]",
        preferences.showDotGridBackground && "journal-dot-grid-dark-only"
      )}>
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

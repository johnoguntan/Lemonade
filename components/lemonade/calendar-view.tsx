"use client"

import { DefaultRightPage } from "./default-right-page"
import { formatLocalDateKey } from "@/lib/store"

interface CalendarViewProps {
  startDate: Date
  onNavigate: (direction: "prev-week" | "next-week" | "prev-day" | "next-day" | "today") => void
}

export function CalendarView({ startDate, onNavigate }: CalendarViewProps) {
  return <DefaultRightPage key={formatLocalDateKey(startDate)} startDate={startDate} onNavigate={onNavigate} />
}

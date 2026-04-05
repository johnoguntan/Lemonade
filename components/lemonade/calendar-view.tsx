"use client"

import { DefaultRightPage } from "./default-right-page"

interface CalendarViewProps {
  startDate: Date
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day') => void
}

export function CalendarView({ startDate, onNavigate }: CalendarViewProps) {
  return <DefaultRightPage startDate={startDate} onNavigate={onNavigate} />
}

"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

type CalendarWidgetProps = {
  selectedDate?: Date
  onDateSelect: (date: Date) => void
}

const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

const isSameDay = (left?: Date, right?: Date) =>
  Boolean(left && right) &&
  left!.getFullYear() === right!.getFullYear() &&
  left!.getMonth() === right!.getMonth() &&
  left!.getDate() === right!.getDate()

export function CalendarWidget({ selectedDate, onDateSelect }: CalendarWidgetProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => selectedDate ?? today)

  const currentYear = viewDate.getFullYear()
  const currentMonth = viewDate.getMonth()

  const monthDays = useMemo(() => {
    const firstOfMonth = new Date(currentYear, currentMonth, 1)
    const startOffset = firstOfMonth.getDay()
    const startDate = new Date(currentYear, currentMonth, 1 - startOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)
      return date
    })
  }, [currentMonth, currentYear])

  const changeMonth = (direction: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  }

  const changeYear = (direction: number) => {
    setViewDate((current) => new Date(current.getFullYear() + direction, current.getMonth(), 1))
  }

  const selectMonth = (monthIndex: number) => {
    setViewDate((current) => new Date(current.getFullYear(), monthIndex, 1))
  }

  return (
    <section className="px-6 py-5 text-white">
      <div className="flex items-center gap-2 text-[32px] font-light tracking-[-0.03em]">
        <span>{currentYear}</span>
        <div className="flex flex-col text-[#6d6d6d]">
          <button type="button" onClick={() => changeYear(1)} aria-label="Next year">
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={() => changeYear(-1)} aria-label="Previous year">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-6 gap-x-2 gap-y-4 text-[12px] tracking-[0.12em] text-[#8c8c8c]">
        {MONTH_LABELS.map((month, index) => {
          const active = index === currentMonth

          return (
            <button
              key={month}
              type="button"
              onClick={() => selectMonth(index)}
              className={active ? "text-white" : "hover:text-[#d6d6d6]"}
            >
              <span className={active ? "bg-white px-1.5 py-0.5 text-black" : ""}>{month}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-10 flex items-center gap-2 text-[18px] font-light tracking-[0.16em] text-white">
        <span>{MONTH_LABELS[currentMonth]}</span>
        <div className="flex flex-col text-[#6d6d6d]">
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 place-items-center gap-y-2 text-center text-[11px] font-medium tracking-[0.14em] text-[#7c7c7c]">
        {DAY_LABELS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 place-items-center gap-y-2.5 text-center text-[13px]">
        {monthDays.map((date) => {
          const inMonth = date.getMonth() === currentMonth
          const isToday = isSameDay(date, today)
          const isSelected = isSameDay(date, selectedDate)

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onDateSelect(new Date(date))}
              className="flex items-center justify-center"
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
            >
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full tabular-nums transition-all duration-150",
                  inMonth ? "text-sky-50/85" : "text-white/15",
                  inMonth && !isToday && !isSelected ? "bg-sky-500/12 hover:bg-sky-500/30 hover:text-white" : "",
                  isSelected && !isToday ? "bg-sky-500/25 font-semibold text-white ring-[1.5px] ring-sky-400" : "",
                  isToday ? "bg-sky-500 font-semibold text-white shadow-[0_2px_10px_rgba(14,165,233,0.55)]" : "",
                ].join(" ")}
              >
                {date.getDate()}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

"use client"

import { useMemo, useState } from "react"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"

type DailySectionKey = "urgent" | "schedule" | "allday"
type StoreTodoWithDailyFields = Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

const taskLineClass =
  "group flex w-full items-center gap-3 border-b border-black/[0.07] py-3 text-[15px] font-light text-[#8e8e8e] transition-colors hover:text-[#3d3d3d] dark:border-white/[0.07] dark:text-white/55 dark:hover:text-white/90"

export function TaskEntryLines() {
  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (todo: Partial<StoreTodoWithDailyFields>) => string
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)
  const labelNames = useMemo(
    () => ["Tomorrow", "Next Week", "Next Month", "Next Year", "Whenever"],
    []
  )
  const labelIds = useMemo(() => ensureLabelIds(labelNames), [ensureLabelIds, labelNames])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [activeLine, setActiveLine] = useState<DailySectionKey | "collections" | "overdue" | null>(null)
  const [lineText, setLineText] = useState("")

  const insertTask = (section: DailySectionKey | "collections" | "overdue") => {
    const trimmed = lineText.trim()
    if (!trimmed) {
      setActiveLine(null)
      return
    }

    if (section === "overdue") {
      const pastKey = formatLocalDateKey(addDays(today, -1))
      addCalendarTodo({
        text: trimmed,
        completed: false,
        date: pastKey,
        section: "allday",
        priority: "normal",
        endOfDay: true,
        rollover: true,
      } as Partial<StoreTodoWithDailyFields>)
    } else if (section === "collections") {
      const tomorrow = labelIds[labelNames.indexOf("Tomorrow")]
      const nextWeek = labelIds[labelNames.indexOf("Next Week")]
      const nextMonth = labelIds[labelNames.indexOf("Next Month")]
      const nextYear = labelIds[labelNames.indexOf("Next Year")]
      const whenever = labelIds[labelNames.indexOf("Whenever")]
      addCalendarTodo({
        text: trimmed,
        completed: false,
        date: null,
        priority: "normal",
        labelIds: [tomorrow, nextWeek, nextMonth, nextYear, whenever].filter(Boolean),
        endOfDay: false,
      } as Partial<StoreTodoWithDailyFields>)
    } else {
      const todayKey = formatLocalDateKey(today)
      addCalendarTodo({
        text: trimmed,
        completed: false,
        date: todayKey,
        section,
        priority:
          section === "urgent" ? "urgent" : section === "schedule" ? "normal" : "normal",
        endOfDay: section === "allday",
      } as Partial<StoreTodoWithDailyFields>)
    }

    setLineText("")
    setActiveLine(null)
  }

  return (
    <div className="border-t border-black/[0.07] dark:border-white/[0.07]">
      {(
        [
          { key: "urgent" as const, label: "URGENT" },
          { key: "schedule" as const, label: "SCHEDULE" },
          { key: "allday" as const, label: "ALL DAY" },
          { key: "overdue" as const, label: "OVERDUE" },
          { key: "collections" as const, label: "ALL COLLECTIONS" },
        ]
      ).map((row) => {
        const isActive = activeLine === row.key
        return (
          <div key={row.key} className={taskLineClass}>
            <span className="w-[120px] shrink-0 text-[10.5px] font-semibold tracking-[0.18em] text-[#b9b9b9] dark:text-white/35">
              {row.label}
            </span>
            {isActive ? (
              <input
                autoFocus
                value={lineText}
                onChange={(event) => setLineText(event.target.value)}
                onBlur={() => {
                  if (!lineText.trim()) {
                    setActiveLine(null)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    insertTask(row.key)
                  } else if (event.key === "Escape") {
                    setLineText("")
                    setActiveLine(null)
                  }
                }}
                placeholder={`Add to ${row.label.toLowerCase()}...`}
                className="h-7 flex-1 bg-transparent text-[14px] font-light text-[#3d3d3d] outline-none placeholder:text-[#b9b9b9] dark:text-white/85 dark:placeholder:text-white/30"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveLine(row.key)
                  setLineText("")
                }}
                className="h-7 flex-1 text-left text-[14px] font-light italic text-[#c5c5c5] transition-colors hover:text-[#8e8e8e] dark:text-white/25 dark:hover:text-white/55"
              >
                Add a task to {row.label.toLowerCase()}…
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

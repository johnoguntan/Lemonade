"use client"

import { useMemo } from "react"
import { useLemonadeStore, formatLocalDateKey } from "@/lib/store"
import { TodoItem } from "./todo-item"
import { cn } from "@/lib/utils"
import { endOfMonth, endOfYear, startOfMonth, startOfYear, addDays, parseISO, isValid, format } from "date-fns"
import { Textarea } from "@/components/ui/textarea"

interface DualProjectListProps {
  startDate: Date
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const titleForRange = (range: string | null) => {
  switch (range) {
    case "NEXT_WEEK":
      return "Next Week"
    case "THIS_MONTH":
      return "This Month"
    case "THIS_YEAR":
      return "This Year"
    case "PPL":
      return "Playground"
    default:
      return "Project"
  }
}

export function DualProjectList({ startDate }: DualProjectListProps) {
  const {
    dualViewRange,
    setDualViewRange,
    setMainViewMode,
    calendarTodos,
    preferences,
    searchQuery,
    labelFilterIds,
    activeFilterColor,
    setCalendarTimeframe,
    setCalendarFilterMode,
    setSelectedCalendarDate,
    playgroundNote,
    setPlaygroundNote,
  } = useLemonadeStore()

  const today = useMemo(() => startOfDay(new Date()), [])
  const todayKey = useMemo(() => formatLocalDateKey(today), [today])

  const { minDate, maxDate } = useMemo(() => {
    if (dualViewRange === "NEXT_WEEK") {
      const min = startOfDay(startDate)
      return { minDate: min, maxDate: addDays(min, 6) }
    }

    if (dualViewRange === "THIS_MONTH") {
      return { minDate: startOfMonth(today), maxDate: endOfMonth(today) }
    }

    if (dualViewRange === "THIS_YEAR") {
      return { minDate: startOfYear(today), maxDate: endOfYear(today) }
    }

    return { minDate: null as Date | null, maxDate: null as Date | null }
  }, [dualViewRange, startDate, today])

  const filteredTodos = useMemo(() => {
    return calendarTodos.filter((todo) => {
      if (!preferences.showCompleted && todo.completed) return false
      if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
      if (activeFilterColor && todo.color !== activeFilterColor) return false

      if (dualViewRange === "PPL") {
        return todo.date === null
      }

      if (!todo.date) return false
      const date = parseISO(todo.date)
      if (!isValid(date)) return false
      if (minDate && date < minDate) return false
      if (maxDate && date > maxDate) return false
      return true
    })
  }, [activeFilterColor, calendarTodos, dualViewRange, labelFilterIds, maxDate, minDate, preferences.showCompleted, searchQuery])

  const sortedTodos = useMemo(() => {
    return [...filteredTodos].sort((a, b) => {
      if (a.date === null && b.date === null) return a.createdAt - b.createdAt
      if (a.date === null) return 1
      if (b.date === null) return -1
      return parseISO(a.date).getTime() - parseISO(b.date).getTime()
    })
  }, [filteredTodos])

  const groupedTodos = useMemo(() => {
    const groups: Record<string, typeof sortedTodos> = {}
    for (const todo of sortedTodos) {
      const key = dualViewRange === "PPL" ? "No Due Date" : (todo.date ?? "No Due Date")
      if (!groups[key]) groups[key] = []
      groups[key].push(todo)
    }
    return groups
  }, [dualViewRange, sortedTodos])

  const handleBack = () => {
    setMainViewMode("standard")
    setDualViewRange(null)
    setCalendarFilterMode("all")
    setCalendarTimeframe("week")
    setSelectedCalendarDate(todayKey)
  }

  const title = titleForRange(dualViewRange)

  return (
    <div className="flex flex-1 flex-col px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project</div>
          <h2 className="font-heading text-[20px] leading-[20px] text-foreground">{title}</h2>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
          )}
        >
          ← Back
        </button>
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        {filteredTodos.length} {filteredTodos.length === 1 ? "task" : "tasks"}
      </div>

      {dualViewRange === "PPL" ? (
        <div className="mb-4 rounded-2xl border border-border/70 bg-background/70 p-3 dark:bg-[rgba(19,19,19,0.6)]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notes
          </div>
          <Textarea
            value={playgroundNote}
            onChange={(event) => setPlaygroundNote(event.target.value)}
            placeholder="Type here…"
            className="min-h-[140px] resize-none border-border/50 bg-transparent text-[12px]"
          />
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {sortedTodos.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground dark:bg-[rgba(19,19,19,0.5)]">
            No tasks found.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTodos).map(([dateKey, todos]) => (
              <div key={dateKey} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateKey === "No Due Date" || dateKey === "No Due Date" ? (
                    "No Due Date"
                  ) : (
                    format(parseISO(dateKey), "EEE, MMM d")
                  )}
                </div>
                {todos.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} textSizeClass="lemonade-task-text" />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

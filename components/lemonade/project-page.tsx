"use client"

import { useMemo } from "react"
import { formatLocalDateKey, useLemonadeStore, type ShortcutType } from "@/lib/store"
import { TodoItem } from "./todo-item"
import { cn } from "@/lib/utils"

interface ProjectPageProps {
  startDate: Date
}

const addDays = (date: Date, amount: number): Date => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// Map shortcut to display title
const getShortcutTitle = (shortcut: ShortcutType): string => {
  switch (shortcut) {
    case "NEXT_WEEK":
      return "Next 7 Days"
    case "NEXT_MONTH":
      return "Next 30 Days"
    case "NEXT_YEAR":
      return "Next 365 Days"
    case "PPL":
      return "Procrastination Prevention List"
    default:
      return "Project"
  }
}

// Map shortcut to date range filter
const getDateRangeFilter = (shortcut: ShortcutType, today: Date): { minDate: Date | null; maxDate: Date | null } => {
  switch (shortcut) {
    case "NEXT_WEEK":
      return { minDate: today, maxDate: addDays(today, 7) }
    case "NEXT_MONTH":
      return { minDate: today, maxDate: addDays(today, 30) }
    case "NEXT_YEAR":
      return { minDate: today, maxDate: addDays(today, 365) }
    case "PPL":
      return { minDate: null, maxDate: null } // PPL shows tasks with no date
    default:
      return { minDate: null, maxDate: null }
  }
}

export function ProjectPage({ startDate: _startDate }: ProjectPageProps) {
  const {
    preferences,
    calendarTodos,
    searchQuery,
    labelFilterIds,
    activeFilterColor,
    selectedShortcut,
    setRightPageViewMode,
    setSelectedShortcut,
    setCalendarFilterMode,
    setCalendarTimeframe,
    setSelectedCalendarDate,
  } = useLemonadeStore()

  const today = useMemo(() => startOfDay(new Date()), [])
  const todayKey = useMemo(() => formatLocalDateKey(today), [today])

  // Filter tasks based on selected shortcut
  const filteredTodos = useMemo(() => {
    if (!selectedShortcut) return []

    const { minDate, maxDate } = getDateRangeFilter(selectedShortcut, today)

    return calendarTodos.filter((todo) => {
      // Apply filters based on shortcut type
      if (selectedShortcut === "PPL") {
        // PPL shows tasks with no date
        if (todo.date !== null) return false
      } else {
        // Other shortcuts show tasks within date range
        if (todo.date === null) return false
        
        const todoDate = new Date(todo.date)
        if (minDate && todoDate < minDate) return false
        if (maxDate && todoDate > maxDate) return false
      }

      // Apply general filters
      if (!preferences.showCompleted && todo.completed) return false
      if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
      if (activeFilterColor && todo.color !== activeFilterColor) return false
      
      return true
    })
  }, [selectedShortcut, today, calendarTodos, preferences.showCompleted, searchQuery, labelFilterIds, activeFilterColor])

  // Sort todos by date
  const sortedTodos = useMemo(() => {
    return [...filteredTodos].sort((a, b) => {
      if (a.date === null && b.date === null) return 0
      if (a.date === null) return 1
      if (b.date === null) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  }, [filteredTodos])

  // Group todos by date for display
  const groupedTodos = useMemo(() => {
    const groups: Record<string, typeof sortedTodos> = {}
    
    for (const todo of sortedTodos) {
      if (selectedShortcut === "PPL") {
        // For PPL, group by "No Date"
        const key = "No Date"
        if (!groups[key]) groups[key] = []
        groups[key].push(todo)
      } else {
        // For date-based shortcuts, group by date
        const dateKey = todo.date ?? "no-date"
        if (!groups[dateKey]) groups[dateKey] = []
        groups[dateKey].push(todo)
      }
    }
    
    return groups
  }, [sortedTodos, selectedShortcut])

  // Handle back to default view
  const handleBackToDefault = () => {
    setRightPageViewMode("project")
    setSelectedShortcut(null)
    setCalendarFilterMode("all")
    setCalendarTimeframe("week")
    setSelectedCalendarDate(todayKey)
  }

  if (!selectedShortcut) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground">No project selected</div>
      </div>
    )
  }

  const title = getShortcutTitle(selectedShortcut)
  const shortcutLabel = selectedShortcut.replace("_", " ")

  return (
    <div className="calendar-focus-mode relative flex flex-1 flex-col px-4 pt-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {shortcutLabel}
          </div>
          <h2 className="font-heading text-[20px] leading-[20px] text-foreground">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleBackToDefault}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
          )}
        >
          ← Back
        </button>
      </div>

      {/* Task count */}
      <div className="mb-3 text-xs text-muted-foreground">
        {filteredTodos.length} {filteredTodos.length === 1 ? "task" : "tasks"}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {sortedTodos.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground dark:bg-[rgba(19,19,19,0.5)]">
            No tasks found for {title.toLowerCase()}.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTodos).map(([dateKey, todos]) => (
              <div key={dateKey} className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateKey === "No Date" ? "No Due Date" : new Date(dateKey).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
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

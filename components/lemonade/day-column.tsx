"use client"

import { useState, useRef, useEffect, useMemo, type DragEvent } from "react"
import {
  formatLocalDateKey,
  useLemonadeStore,
  holidays,
  parseNaturalLanguageTaskInput,
  type NaturalLanguagePreviewToken,
  type Todo,
} from "@/lib/store"
import { cn } from "@/lib/utils"
import { TodoItem } from "./todo-item"
import { Check } from "lucide-react"
import { toast } from "sonner"

interface DayColumnProps {
  date: Date
  isToday: boolean
}

const formatDate = (date: Date) => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  return {
    month: months[date.getMonth()],
    day: date.getDate(),
    year: date.getFullYear(),
    dayName: days[date.getDay()],
  }
}

const getDateString = (date: Date) => {
  return formatLocalDateKey(date)
}

const sortEndOfDayTodos = (todos: Todo[]) => {
  const getBucket = (todo: Todo) => {
    if (!todo.completed && !todo.endOfDay) return 0
    if (!todo.completed && todo.endOfDay) return 1
    if (todo.completed && !todo.endOfDay) return 2
    return 3
  }

  // We sort explicitly by section and creation time so ordering stays predictable
  // across reloads and does not depend on engine sort stability.
  return todos
    .map((todo, index) => ({ todo, index }))
    .sort((a, b) => {
      const bucketDiff = getBucket(a.todo) - getBucket(b.todo)
      if (bucketDiff !== 0) return bucketDiff

      const createdAtDiff = a.todo.createdAt - b.todo.createdAt
      if (createdAtDiff !== 0) return createdAtDiff

      return a.index - b.index
    })
    .map(({ todo }) => todo)
}

export function DayColumn({ date, isToday }: DayColumnProps) {
  const preferences = useLemonadeStore((state) => state.preferences)
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos)
  const lastCreatedTodoId = useLemonadeStore((state) => state.lastCreatedTodoId)
  const addCalendarTodo = useLemonadeStore((state) => state.addCalendarTodo)
  const clearLastCreatedTodoId = useLemonadeStore((state) => state.clearLastCreatedTodoId)
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)
  const moveTodoToDate = useLemonadeStore((state) => state.moveTodoToDate)
  const searchQuery = useLemonadeStore((state) => state.searchQuery)
  const isCalendarExpanded = useLemonadeStore((state) => state.isCalendarExpanded)
  const labelFilterIds = useLemonadeStore((state) => state.labelFilterIds)
  const activeFilterColor = useLemonadeStore((state) => state.activeFilterColor)
  const labels = useLemonadeStore((state) => state.labels)
  const [newTodoText, setNewTodoText] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateStr = getDateString(date)
  const { month, day, year, dayName } = formatDate(date)
  const holiday = holidays[dateStr]

  const todosForDay: Todo[] = useMemo(
    () =>
      sortEndOfDayTodos(
        calendarTodos.filter((todo) => {
          if (todo.date !== dateStr) return false
          if (!preferences.showCompleted && todo.completed) return false
          if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
          if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
          if (activeFilterColor && todo.color !== activeFilterColor) return false
          return true
        })
      ),
    [activeFilterColor, calendarTodos, dateStr, labelFilterIds, preferences.showCompleted, searchQuery]
  )

  const textSizeClass = "lemonade-task-text"

  useEffect(() => {
    if (isAdding && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isAdding])

  const handleStartAdding = () => {
    setIsAdding(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const getResponsiveFontSizes = () => {
    return { date: 'text-[10px]' }
  }

  const { date: dateFontSize } = getResponsiveFontSizes()
  const visibleLineCount = isCalendarExpanded ? 18 : 9
  const fillerRowCount = Math.max(visibleLineCount - todosForDay.length - 1, 0)
  const parsedInput = parseNaturalLanguageTaskInput(newTodoText, { labels })

  const handleTodoDragStart = (event: DragEvent<HTMLDivElement>, todoId: string) => {
    event.dataTransfer.setData("text/plain", todoId)
    event.dataTransfer.effectAllowed = "move"
    setDraggedTodoId(todoId)
  }

  const handleColumnDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setIsDragOver(true)
  }

  const handleColumnDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const todoId = event.dataTransfer.getData("text/plain")

    if (todoId) {
      moveTodoToDate(todoId, dateStr)
      toast("Task moved", { duration: 2000 })
    }

    setIsDragOver(false)
    setDraggedTodoId(null)
  }

  const handleCreateNaturalLanguageTodo = () => {
    const parsed = parseNaturalLanguageTaskInput(newTodoText, { labels })
    const labelIds = [...parsed.labelIds, ...ensureLabelIds(parsed.newLabelNames)]

    if (!parsed.cleanText) {
      setNewTodoText("")
      return false
    }

    const isHeading = parsed.cleanText === parsed.cleanText.toUpperCase() && parsed.cleanText.length > 2

    const targetDate = parsed.scheduledDate ?? dateStr

    addCalendarTodo({
      text: parsed.cleanText,
      completed: false,
      date: targetDate,
      isHeading,
      isRecurring: parsed.recurrence?.isRecurring,
      recurringFrequency: parsed.recurrence?.recurringFrequency,
      recurringDays: parsed.recurrence?.recurringDays,
      priority: parsed.priority,
      labelIds,
      subtasks: parsed.subtaskTitles.map((title) => ({ title })),
      time: parsed.time,
    })

    setNewTodoText("")
    clearLastCreatedTodoId()
    return true
  }

  return (
    <div className="w-full">
      <div className="w-full px-4">
        <div className="lemonade-day-header pb-3 pt-3">
          <div
            className={cn("lemonade-day-date font-semibold tracking-[0.08em]", dateFontSize)}
            style={{ color: "#A4A4A4" }}
          >
            {month} {day}, {year}
          </div>
          <div className={cn(
            "lemonade-day-label font-heading uppercase text-[20px] leading-[20px]",
            isToday ? "text-[var(--accent-color)]" : "text-foreground"
          )}>
            {dayName}
          </div>
          {holiday && (
            <div className="mt-1 text-xs italic text-muted-foreground">
              {holiday}
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col transition-colors",
            isDragOver && "rounded-md border border-dashed border-border bg-accent/50"
          )}
          onDragOver={handleColumnDragOver}
          onDragEnter={handleColumnDragOver}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleColumnDrop}
        >
          <div className="flex flex-col">
            {todosForDay.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                autoFocus={todo.id === lastCreatedTodoId}
                textSizeClass={textSizeClass}
                isDragging={todo.id === draggedTodoId}
                draggable
                onDragStart={(event) => handleTodoDragStart(event, todo.id)}
                onDragEnd={() => {
                  setIsDragOver(false)
                  setDraggedTodoId(null)
                }}
              />
            ))}

            <div
              className="lemonade-task-row flex h-[42px] items-center px-0 transition-colors cursor-text hover:bg-accent/20"
              onClick={handleStartAdding}
            >
              {isAdding ? (
                <div className="w-full py-2">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          const created = handleCreateNaturalLanguageTodo()
                          if (created) {
                            requestAnimationFrame(() => {
                              inputRef.current?.focus()
                            })
                          }
                        } else if (e.key === "Escape") {
                          setIsAdding(false)
                          setNewTodoText("")
                        }
                      }}
                      onBlur={() => {
                        handleCreateNaturalLanguageTodo()
                        setIsAdding(false)
                      }}
                      className={cn(
                        "w-full bg-transparent px-0 pr-7 outline-none font-task",
                        textSizeClass
                      )}
                      placeholder="Add a todo..."
                    />
                    {newTodoText.trim() ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          const created = handleCreateNaturalLanguageTodo()
                          if (created) {
                            requestAnimationFrame(() => {
                              inputRef.current?.focus()
                            })
                          }
                        }}
                        className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-[var(--accent-color)] opacity-75 transition-opacity hover:opacity-100"
                        aria-label="Confirm task"
                      >
                        <Check className="size-4" strokeWidth={2.5} />
                      </button>
                    ) : null}
                  </div>
                  <TokenPreviewBar tokens={parsedInput.previewTokens} />
                </div>
              ) : null}
            </div>

            {Array.from({ length: fillerRowCount }).map((_, index) => (
              <div
                key={`${dateStr}-line-${index}`}
                className="lemonade-task-row flex h-[42px] items-center px-0 transition-colors cursor-text hover:bg-accent/20"
                onClick={handleStartAdding}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TokenPreviewBar({ tokens }: { tokens: NaturalLanguagePreviewToken[] }) {
  if (tokens.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tokens.map((token) => (
        <span
          key={token.key}
          className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          {token.label}
        </span>
      ))}
    </div>
  )
}

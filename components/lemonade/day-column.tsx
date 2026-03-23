"use client"

import { useState, useRef, useEffect, type DragEvent } from "react"
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
  const {
    preferences,
    calendarTodos,
    lastCreatedTodoId,
    addCalendarTodo,
    ensureTagIds,
    moveTodoToDate,
    searchQuery,
    isCalendarExpanded,
    tagFilterId,
    activeFilterColor,
    tags,
  } = useLemonadeStore()
  const [newTodoText, setNewTodoText] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateStr = getDateString(date)
  const { month, day, year, dayName } = formatDate(date)
  const holiday = holidays[dateStr]

  const todosForDay = sortEndOfDayTodos(calendarTodos.filter((todo) => {
    if (todo.date !== dateStr) return false
    if (!preferences.showCompleted && todo.completed) return false
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (tagFilterId && !todo.tags?.includes(tagFilterId)) return false
    if (activeFilterColor && todo.color !== activeFilterColor) return false
    return true
  }))

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
  const parsedInput = parseNaturalLanguageTaskInput(newTodoText, { tags })

  const handleTodoDragStart = (event: DragEvent<HTMLDivElement>, todoId: string) => {
    event.dataTransfer.setData("text/plain", todoId)
    event.dataTransfer.effectAllowed = "move"
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
    }

    setIsDragOver(false)
  }

  const handleCreateNaturalLanguageTodo = () => {
    const parsed = parseNaturalLanguageTaskInput(newTodoText, { tags })
    const tagIds = [...parsed.tagIds, ...ensureTagIds(parsed.newTagNames)]

    if (!parsed.cleanText) {
      setNewTodoText("")
      return null
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
      tags: tagIds.length > 0 ? tagIds : undefined,
      time: parsed.time,
    })

    const nextTaskId = addCalendarTodo({
      text: "",
      completed: false,
      date: targetDate,
    })

    setNewTodoText("")
    return nextTaskId
  }

  return (
    <div className="w-full border-b border-border/60">
      <div className="grid w-full grid-cols-[220px_minmax(0,1fr)] gap-0">
        <div className="px-4 pb-3 pt-3">
          <div
            className={cn("font-semibold tracking-[0.08em]", dateFontSize)}
            style={{ color: "#A4A4A4" }}
          >
            {month} {day}, {year}
          </div>
          <div className={cn(
            "font-heading uppercase text-[20px] leading-[20px]",
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
            isDragOver && "bg-accent/10"
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
                draggable
                onDragStart={(event) => handleTodoDragStart(event, todo.id)}
                onDragEnd={() => setIsDragOver(false)}
              />
            ))}

            <div
              className="lemonade-task-row flex h-[42px] items-center border-b border-border/60 px-0 transition-colors cursor-text hover:bg-accent/20"
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
                          const nextTaskId = handleCreateNaturalLanguageTodo()
                          if (nextTaskId) {
                            setIsAdding(false)
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
                          const nextTaskId = handleCreateNaturalLanguageTodo()
                          if (nextTaskId) {
                            setIsAdding(false)
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
                className="lemonade-task-row flex h-[42px] items-center border-b border-border/60 px-0 transition-colors cursor-text hover:bg-accent/20"
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

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

export function DayColumn({ date, isToday }: DayColumnProps) {
  const {
    preferences,
    calendarTodos,
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

  const todosForDay = calendarTodos.filter((todo) => {
    if (todo.date !== dateStr) return false
    if (!preferences.showCompleted && todo.completed) return false
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (tagFilterId && !todo.tags?.includes(tagFilterId)) return false
    if (activeFilterColor && todo.color !== activeFilterColor) return false
    return true
  })

  const textSizeClass = {
    S: 'text-[13px]',
    M: 'text-[14px]',
    L: 'text-[16px]',
  }[preferences.textSize]

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      const isHeading = newTodoText === newTodoText.toUpperCase() && newTodoText.length > 2
      addCalendarTodo({
        text: newTodoText.trim(),
        completed: false,
        date: dateStr,
        isHeading,
      })
      setNewTodoText("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTodo()
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setNewTodoText("")
    }
  }

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const getResponsiveFontSizes = () => {
    return { date: 'text-[10px]' }
  }

  const { date: dateFontSize } = getResponsiveFontSizes()
  const visibleLineCount = isCalendarExpanded ? 18 : 9
  const totalSlots = Math.max(visibleLineCount, todosForDay.length + (isAdding ? 1 : 0))
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
      return false
    }

    const isHeading = parsed.cleanText === parsed.cleanText.toUpperCase() && parsed.cleanText.length > 2

    addCalendarTodo({
      text: parsed.cleanText,
      completed: false,
      date: parsed.scheduledDate ?? dateStr,
      isHeading,
      isRecurring: parsed.recurrence?.isRecurring,
      recurringFrequency: parsed.recurrence?.recurringFrequency,
      recurringDays: parsed.recurrence?.recurringDays,
      priority: parsed.priority,
      tags: tagIds.length > 0 ? tagIds : undefined,
      time: parsed.time,
    })

    setNewTodoText("")
    return true
  }

  return (
    <div className={cn(
      "w-full border-b border-border/60 dark:bg-[#131313]",
      preferences.showDotGridBackground && "journal-dot-grid-dark-only"
    )}>
      <div className={cn(
        "grid w-full grid-cols-[220px_minmax(0,1fr)] gap-0 dark:bg-[#131313]",
        preferences.showDotGridBackground && "journal-dot-grid-dark-only"
      )}>
        <div className={cn(
          "px-4 pb-3 pt-3",
          preferences.showDotGridBackground && "journal-dot-grid-dark-only"
        )}>
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
            "flex flex-col transition-colors dark:bg-[#131313]",
            preferences.showDotGridBackground && "journal-dot-grid-dark-only",
            isDragOver && "bg-accent/10"
          )}
          onDragOver={handleColumnDragOver}
          onDragEnter={handleColumnDragOver}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleColumnDrop}
        >
          {preferences.showLines ? (
            <div className={cn(
              "flex flex-col",
              preferences.showDotGridBackground && "journal-dot-grid-dark-only"
            )}>
            {Array.from({ length: totalSlots }).map((_, index) => {
              const todo = todosForDay[index]
              if (todo) {
                return (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    textSizeClass={textSizeClass}
                    draggable
                    onDragStart={(event) => handleTodoDragStart(event, todo.id)}
                    onDragEnd={() => setIsDragOver(false)}
                  />
                )
              }

              const isInputRow = isAdding && index === todosForDay.length

              return (
                <div
                  key={`${dateStr}-line-${index}`}
                  className="flex h-[42px] items-center border-b border-border/60 px-0 transition-colors cursor-text hover:bg-accent/20"
                  onClick={() => setIsAdding(true)}
                >
                  {isInputRow ? (
                    <div className="w-full py-2">
                      <div className="relative">
                        <input
                          ref={inputRef}
                          type="text"
                          value={newTodoText}
                          onChange={(e) => setNewTodoText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCreateNaturalLanguageTodo()
                              setIsAdding(false)
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
              )
            })}
            </div>
          ) : (
            <>
              {todosForDay.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  textSizeClass={textSizeClass}
                  draggable
                  onDragStart={(event) => handleTodoDragStart(event, todo.id)}
                  onDragEnd={() => setIsDragOver(false)}
                />
              ))}
            </>
          )}
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

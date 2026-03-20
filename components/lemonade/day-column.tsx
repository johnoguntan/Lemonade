"use client"

import { useState, useRef, useEffect } from "react"
import { useLemonadeStore, holidays, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { TodoItem } from "./todo-item"

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
  return date.toISOString().split('T')[0]
}

export function DayColumn({ date, isToday }: DayColumnProps) {
  const { preferences, calendarTodos, addCalendarTodo, searchQuery, isCalendarExpanded, tagFilterId } = useLemonadeStore()
  const [newTodoText, setNewTodoText] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateStr = getDateString(date)
  const { month, day, year, dayName } = formatDate(date)
  const holiday = holidays[dateStr]

  const todosForDay = calendarTodos.filter((todo) => {
    if (todo.date !== dateStr) return false
    if (!preferences.showCompleted && todo.completed) return false
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (tagFilterId && !todo.tags?.includes(tagFilterId)) return false
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

  return (
    <div className="flex-1 min-w-0 dark:bg-[#131313]">
      {/* Header */}
      <div className="px-4 pb-2 pt-2">
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
          <div className="text-xs text-muted-foreground mt-1 italic">
            {holiday}
          </div>
        )}
      </div>

      {/* Todos */}
      <div className="flex flex-col dark:bg-[#131313]">
        {preferences.showLines ? (
          <div className="flex flex-col">
            {Array.from({ length: totalSlots }).map((_, index) => {
              const todo = todosForDay[index]
              if (todo) {
                return <TodoItem key={todo.id} todo={todo} textSizeClass={textSizeClass} />
              }

              const isInputRow = isAdding && index === todosForDay.length

              return (
                <div
                  key={`${dateStr}-line-${index}`}
                  className="flex h-[42px] items-center border-b border-border/60 px-0 transition-colors cursor-text hover:bg-accent/20"
                  onClick={() => setIsAdding(true)}
                >
                  {isInputRow ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={() => {
                        handleAddTodo()
                        setIsAdding(false)
                      }}
                      className={cn(
                        "w-full bg-transparent px-0 outline-none font-task",
                        textSizeClass
                      )}
                      placeholder="Add a todo..."
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {todosForDay.map((todo) => (
              <TodoItem key={todo.id} todo={todo} textSizeClass={textSizeClass} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

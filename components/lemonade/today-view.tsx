"use client"

import { useMemo } from "react"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"
import { TodoItem } from "./todo-item"
import { setPlannerTaskDragData } from "@/lib/task-dnd"

const parseTimeToMinutes = (value?: string) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()

  if (normalized === "morning") return 9 * 60
  if (normalized === "noon") return 12 * 60
  if (normalized === "evening") return 18 * 60
  if (normalized === "tonight") return 21 * 60

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHourMatch) {
    const hours = Number.parseInt(twentyFourHourMatch[1], 10)
    const minutes = Number.parseInt(twentyFourHourMatch[2], 10)
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null
    return hours * 60 + minutes
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (!match) return null

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2] ?? "0", 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const baseHour = hours % 12
  return (match[3] === "pm" ? baseHour + 12 : baseHour) * 60 + minutes
}

const sortDueTodos = (todos: Todo[]) =>
  [...todos].sort((left, right) => {
    const leftTime = parseTimeToMinutes(left.time)
    const rightTime = parseTimeToMinutes(right.time)

    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
      return leftTime - rightTime
    }

    if (leftTime !== null && rightTime === null) return -1
    if (leftTime === null && rightTime !== null) return 1

    return left.createdAt - right.createdAt
  })

export const getTodayViewBuckets = (todos: Todo[], showCompleted: boolean, todayKey: string) => {
  const overdue = todos.filter((todo) => {
    if (!todo.date) return false
    if (todo.date >= todayKey) return false
    if (todo.completed) return false
    return true
  })
  const today = todos.filter((todo) => {
    if (!todo.date) return false
    if (todo.date !== todayKey) return false
    if (!showCompleted && todo.completed) return false
    return true
  })

  return {
    overdue: sortDueTodos(overdue),
    today: sortDueTodos(today),
  }
}

export function TodayView() {
  const { calendarTodos, preferences, labelFilterIds, activeFilterColor, searchQuery } = useLemonadeStore()
  const todayKey = formatLocalDateKey(new Date())
  const filteredTodos = useMemo(
    () =>
      calendarTodos.filter((todo) => {
        if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
        if (activeFilterColor && todo.color !== activeFilterColor) return false
        return true
      }),
    [activeFilterColor, calendarTodos, labelFilterIds, searchQuery]
  )
  const { overdue, today } = useMemo(
    () => getTodayViewBuckets(filteredTodos, preferences.showCompleted, todayKey),
    [filteredTodos, preferences.showCompleted, todayKey]
  )

  const hasTasks = overdue.length > 0 || today.length > 0

  return (
    <div className="flex flex-1 flex-col px-4 pt-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {overdue.length > 0 ? (
          <section className="px-2 py-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Carried over
            </div>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-transparent">
              {Array.from({ length: Math.max(overdue.length, 9) }).map((_, index) => {
                const todo = overdue[index]
                if (todo) {
                  return (
                    <div key={todo.id} className="border-b border-[#e8e8ec] px-2 last:border-b-0 dark:border-white/15">
                      <TodoItem
                        todo={todo}
                        textSizeClass="lemonade-task-text"
                        draggable
                        onDragStart={(event) => {
                          setPlannerTaskDragData(event, { todoId: todo.id, source: "calendar" })
                        }}
                      />
                    </div>
                  )
                }
                return <div key={`filler-overdue-${index}`} className="h-11 border-b border-[#e8e8ec] last:border-b-0 dark:border-white/15" />
              })}
            </div>
          </section>
        ) : null}

        {today.length > 0 ? (
          <section className="px-2 py-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Today
            </div>
            <div className="space-y-1">
              {today.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  textSizeClass="lemonade-task-text"
                  draggable
                  onDragStart={(event) => {
                    setPlannerTaskDragData(event, { todoId: todo.id, source: "calendar" })
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!hasTasks ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 px-6 py-14 text-center dark:bg-[rgba(19,19,19,0.8)]">
            <div className="font-heading text-[22px] leading-[22px]">You&apos;re all clear for today.</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing is due right now. Breathe, then decide what deserves your attention next.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

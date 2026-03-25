"use client"

import { useMemo } from "react"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"
import { TodoItem } from "./todo-item"

const parseTimeToMinutes = (value?: string) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()

  if (normalized === "morning") return 9 * 60
  if (normalized === "noon") return 12 * 60
  if (normalized === "evening") return 18 * 60
  if (normalized === "tonight") return 21 * 60

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
    if (todo.date >= todayKey) return false
    if (todo.completed) return false
    return true
  })
  const today = todos.filter((todo) => {
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
    <div className="flex flex-1 flex-col px-10 pt-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {overdue.length > 0 ? (
          <section className="rounded-2xl border border-border/70 bg-background/90 px-5 py-4 dark:bg-[rgba(19,19,19,0.9)]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Carried over
            </div>
            <div className="space-y-1">
              {overdue.map((todo) => (
                <TodoItem key={todo.id} todo={todo} textSizeClass="lemonade-task-text" />
              ))}
            </div>
          </section>
        ) : null}

        {today.length > 0 ? (
          <section className="rounded-2xl border border-border/70 bg-background/90 px-5 py-4 dark:bg-[rgba(19,19,19,0.9)]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Today
            </div>
            <div className="space-y-1">
              {today.map((todo) => (
                <TodoItem key={todo.id} todo={todo} textSizeClass="lemonade-task-text" />
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

"use client"

import { useMemo } from "react"
import type { Collection } from "@/lib/types"
import { formatLocalDateKey, type Todo } from "@/lib/store"
import { CollectionDayBlock } from "@/components/collections/CollectionDayBlock"

type DateCollectionProps = {
  collection: Collection
  todos: Todo[]
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

const isTomorrowCollection = (collection: Collection) =>
  collection.name.trim().toLowerCase() === "tomorrow"

const getRangeDates = (collection: Collection) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isTomorrowCollection(collection)) {
    return [addDays(today, 1)]
  }

  if (collection.fixed_start_date && collection.fixed_end_date) {
    const start = parseDateKey(collection.fixed_start_date)
    const end = parseDateKey(collection.fixed_end_date)
    const dates: Date[] = []

    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(new Date(cursor))
    }

    return dates
  }

  const countByRange = {
    next_3_days: 3,
    next_5_days: 5,
    next_week: 7,
    next_month: 30,
    next_year: 365,
  } as const

  const count = collection.dynamic_range ? countByRange[collection.dynamic_range] : 5

  return Array.from({ length: count }, (_, index) => addDays(today, index))
}

export function DateCollection({ collection, todos }: DateCollectionProps) {
  const grouped = useMemo(() => {
    const dates = getRangeDates(collection)
    const byDate = new Map<string, Todo[]>()

    todos.forEach((todo) => {
      if (typeof todo.date !== "string") {
        return
      }

      const existing = byDate.get(todo.date) ?? []
      existing.push(todo)
      byDate.set(todo.date, existing)
    })

    return dates.map((date) => ({
      date,
      todos: byDate.get(formatLocalDateKey(date)) ?? [],
    }))
  }, [collection, todos])

  const nonEmpty = grouped.filter((entry) => entry.todos.length > 0)

  return (
    <section>
      {collection.name ? (
        <h2 className="mb-3 mt-8 text-xs tracking-widest uppercase text-gray-400">{collection.name}</h2>
      ) : null}

      {nonEmpty.length > 0 ? (
        nonEmpty.map((entry, index) => (
          <CollectionDayBlock
            key={entry.date.toISOString()}
            date={entry.date}
            todos={entry.todos}
            featured={index === 0}
            showEmpty
          />
        ))
      ) : (
        <CollectionDayBlock
          key={`empty-${collection.id}`}
          date={grouped[0]?.date ?? new Date()}
          todos={[]}
          featured
          showEmpty
        />
      )}
    </section>
  )
}

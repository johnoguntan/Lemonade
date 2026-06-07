"use client"

import { useMemo } from "react"
import type { Collection } from "@/lib/types"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"
import { CollectionDayBlock } from "@/components/collections/CollectionDayBlock"
import { TaskRow } from "@/components/daily/TaskRow"
import { SectionLines, buildCalendarAddHandler } from "@/components/daily/SectionLines"

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

/** Single-day collections (Tomorrow) get the date-block layout; multi-day get a flat list. */
const isSingleDay = (collection: Collection) =>
  Boolean(
    collection.fixed_start_date &&
      collection.fixed_end_date &&
      collection.fixed_start_date === collection.fixed_end_date
  )

/** The date to stamp on tasks added to a multi-day collection. */
const getAddDateKey = (collection: Collection): string => {
  if (collection.fixed_start_date) return collection.fixed_start_date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return formatLocalDateKey(addDays(today, 1))
}

// ─── Single-day (Tomorrow) ───────────────────────────────────────────────────

function SingleDayDateCollection({ collection, todos }: DateCollectionProps) {
  const date = collection.fixed_start_date
    ? parseDateKey(collection.fixed_start_date)
    : addDays(new Date(), 1)

  return (
    <section>
      <h2 className="mb-3 mt-8 text-xs tracking-widest uppercase text-gray-400">{collection.name}</h2>
      <CollectionDayBlock date={date} todos={todos} featured showEmpty />
    </section>
  )
}

// ─── Multi-day (Next Week / Month / Year) ────────────────────────────────────

function MultiDayDateCollection({ collection, todos }: DateCollectionProps) {
  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (
    todo: Partial<Todo & { section?: "urgent" | "schedule" | "allday"; rollover?: boolean; dismissed?: boolean }>
  ) => string
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)

  const addDateKey = useMemo(() => getAddDateKey(collection), [collection])

  const addHandler = useMemo(
    () =>
      buildCalendarAddHandler({
        addCalendarTodo,
        ensureLabelIds,
        selectedCalendarDate: addDateKey,
        kind: "schedule",
      }),
    [addCalendarTodo, ensureLabelIds, addDateKey]
  )

  return (
    <section>
      <h2 className="mb-3 mt-8 text-xs tracking-widest uppercase text-gray-400">{collection.name}</h2>

      {todos.length > 0 ? (
        <div className="space-y-2">
          {todos.map((todo) => (
            <TaskRow key={todo.id} todo={todo} appearance="collection" />
          ))}
        </div>
      ) : null}

      <SectionLines
        count={5}
        onAdd={addHandler}
        ariaLabel={`Add a task to ${collection.name}`}
        className="mt-2"
      />
    </section>
  )
}

// ─── Router ──────────────────────────────────────────────────────────────────

export function DateCollection({ collection, todos }: DateCollectionProps) {
  if (isSingleDay(collection)) {
    return <SingleDayDateCollection collection={collection} todos={todos} />
  }
  return <MultiDayDateCollection collection={collection} todos={todos} />
}

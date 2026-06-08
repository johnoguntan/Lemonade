"use client"

import { useCallback, useMemo, useRef, type DragEvent } from "react"
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
  const updateCalendarTodoBase = useLemonadeStore((state) => state.updateCalendarTodo)
  const updateCalendarTodo = updateCalendarTodoBase as unknown as (
    id: string, updates: Partial<Todo & { rollover?: boolean; dismissed?: boolean }>
  ) => void
  const sectionRef = useRef<HTMLElement | null>(null)

  const addDateKey = useMemo(() => getAddDateKey(collection), [collection])
  const dropDateKey = collection.fixed_start_date ?? addDateKey

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

  const setHighlight = useCallback((on: boolean) => {
    if (on) sectionRef.current?.setAttribute("data-drag-over", "true")
    else sectionRef.current?.removeAttribute("data-drag-over")
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setHighlight(true)
  }, [setHighlight])

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setHighlight(false)
  }, [setHighlight])

  const handleDrop = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setHighlight(false)
    const taskId = e.dataTransfer.getData("text/plain")
    if (!taskId) return
    updateCalendarTodo(taskId, { date: dropDateKey, rollover: false, dismissed: false })
  }, [updateCalendarTodo, setHighlight, dropDateKey])

  return (
    <section
      ref={sectionRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="px-8 transition-colors [&[data-drag-over=true]]:bg-sky-50/60"
    >
      <h2 className="mb-3 mt-8 text-xs tracking-widest uppercase text-gray-400">{collection.name}</h2>

      {todos.length > 0 ? (
        <div className="space-y-2">
          {todos.map((todo) => (
            <TaskRow key={todo.id} todo={todo} appearance="collection" draggable={true} />
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

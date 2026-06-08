"use client"

import { useCallback, useMemo, useRef, type DragEvent } from "react"
import type { Collection } from "@/lib/types"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { TaskRow } from "@/components/daily/TaskRow"
import { SectionLines, buildCalendarAddHandler } from "@/components/daily/SectionLines"

type TagCollectionProps = {
  collection: Collection
  todos: Todo[]
}

export function TagCollection({ collection, todos }: TagCollectionProps) {
  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (
    todo: Partial<Todo & { section?: "urgent" | "schedule" | "allday"; rollover?: boolean; dismissed?: boolean }>
  ) => string
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)
  const updateCalendarTodoBase = useLemonadeStore((state) => state.updateCalendarTodo)
  const updateCalendarTodo = updateCalendarTodoBase as unknown as (
    id: string, updates: Partial<Todo>
  ) => void
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos)
  const sectionRef = useRef<HTMLElement | null>(null)

  // Prefer the explicit `tag` field when available (e.g. the "Whenever" fallback
  // collection sets `tag: "Whenever"`), fall back to the collection name.
  const effectiveTag = (collection as Collection & { tag?: string | null }).tag ?? collection.name
  const tagNames = useMemo(() => [effectiveTag], [effectiveTag])
  const addHandler = useMemo(
    () =>
      buildCalendarAddHandler({
        addCalendarTodo,
        ensureLabelIds,
        selectedCalendarDate: "",
        kind: "collection",
        tagNames,
      }),
    [addCalendarTodo, ensureLabelIds, tagNames]
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
    // Add the tag label to this task without overwriting existing labels.
    const labelId = ensureLabelIds([effectiveTag])[0]
    if (!labelId) return
    const task = calendarTodos.find((t) => t.id === taskId)
    if (!task) return
    if (!task.labelIds.includes(labelId)) {
      updateCalendarTodo(taskId, { labelIds: [...task.labelIds, labelId] })
    }
  }, [ensureLabelIds, effectiveTag, calendarTodos, updateCalendarTodo, setHighlight])

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

"use client"

import { useMemo } from "react"
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

"use client"

import type { Collection } from "@/lib/types"
import type { Todo } from "@/lib/store"
import { TaskRow } from "@/components/daily/TaskRow"

type TagCollectionProps = {
  collection: Collection
  todos: Todo[]
}

export function TagCollection({ collection, todos }: TagCollectionProps) {
  return (
    <section>
      <h2 className="mb-3 mt-6 text-xs tracking-widest uppercase text-gray-400">{collection.name}</h2>

      {todos.length === 0 ? (
        <p className="text-[12px] text-gray-400">Nothing tagged here</p>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <TaskRow key={todo.id} todo={todo} appearance="collection" />
          ))}
        </div>
      )}
    </section>
  )
}

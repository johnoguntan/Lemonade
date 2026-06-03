"use client"

import { useState } from "react"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { TaskRow } from "@/components/daily/TaskRow"

type CollectionTodo = Todo & {
  section?: "urgent" | "schedule" | "allday"
  rollover?: boolean
  dismissed?: boolean
}

type CollectionDayBlockProps = {
  date: Date
  todos: Todo[]
  onTaskClick?: (todo: Todo) => void
  featured?: boolean
  showEmpty?: boolean
}

const formatDayName = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()

const sortTodos = (left: CollectionTodo, right: CollectionTodo) => {
  if (left.endOfDay !== right.endOfDay) {
    return left.endOfDay ? 1 : -1
  }
  if (left.time && right.time) {
    return left.time.localeCompare(right.time)
  }
  if (left.time) return -1
  if (right.time) return 1
  return left.createdAt - right.createdAt
}

export function CollectionDayBlock({
  date,
  todos,
  featured = false,
  showEmpty = false,
}: CollectionDayBlockProps) {
  const reorderCalendarTodo = useLemonadeStore((state) => state.reorderCalendarTodo)
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null)

  if (todos.length === 0 && !showEmpty) {
    return null
  }

  const sortedTodos = [...todos].map((todo) => todo as CollectionTodo).sort(sortTodos)
  const splitIndex = Math.ceil(sortedTodos.length / 2)
  const firstColumnTodos = sortedTodos.slice(0, splitIndex)
  const secondColumnTodos = sortedTodos.slice(splitIndex)

  const renderTask = (todo: CollectionTodo) => (
    <TaskRow
      key={todo.id}
      todo={todo}
      appearance="collection"
      showOverdueActions={false}
      draggable={true}
      isDragging={draggedTodoId === todo.id}
      onDragStart={(_event, todoId) => {
        setDraggedTodoId(todoId)
      }}
      onDropOnTask={(targetTodoId) => {
        if (!draggedTodoId || draggedTodoId === targetTodoId) return
        reorderCalendarTodo(draggedTodoId, targetTodoId, "after")
        setDraggedTodoId(null)
      }}
    />
  )

  return (
    <section className="grid min-h-[258px] grid-cols-[24%_38%_38%] gap-0 border-t border-black/8 bg-[#f7f7f4] px-7 py-9 first:border-t-0">
      <div className="flex items-start justify-start pt-1 text-left">
        {featured ? (
          <div className="inline-flex min-w-[104px] flex-col rounded-[28px] bg-black px-6 py-5 text-white">
            <div className="text-[17px] font-bold uppercase tracking-[0.06em]">{formatDayName(date)}</div>
            <div className="mt-2 text-[58px] font-black leading-[0.84]">{date.getDate()}</div>
          </div>
        ) : (
          <div className="pt-3">
            <div className="text-[18px] font-black uppercase leading-none tracking-[0.04em] text-black">{formatDayName(date)}</div>
            <div className="mt-2 text-[56px] font-black leading-[0.84] text-black">{date.getDate()}</div>
          </div>
        )}
      </div>

      <div className="grid content-start gap-y-4 pr-8 pt-1">
        {firstColumnTodos.map(renderTask)}
      </div>

      <div className="grid content-start gap-y-4 pr-2 pt-1">
        {secondColumnTodos.map(renderTask)}
      </div>
    </section>
  )
}

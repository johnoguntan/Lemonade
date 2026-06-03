"use client"

import { useState } from "react"
import type { Todo } from "@/lib/store"
import { useLemonadeStore } from "@/lib/store"
import { TaskRow } from "@/components/daily/TaskRow"

type DailySectionKey = "urgent" | "schedule" | "allday"

type DailySectionProps = {
  title: string
  todos: Todo[]
  showOverdueActions?: boolean
}

export function DailySection({ title, todos, showOverdueActions = false }: DailySectionProps) {
  const reorderCalendarTodo = useLemonadeStore((state) => state.reorderCalendarTodo)
  const updateCalendarTodoBase = useLemonadeStore((state) => state.updateCalendarTodo)
  const updateCalendarTodo = updateCalendarTodoBase as unknown as (
    id: string,
    updates: Partial<Todo> & { rollover?: boolean; dismissed?: boolean; section?: DailySectionKey }
  ) => void
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos) as (Todo & { rollover?: boolean })[]
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null)

  const handleDropOnTask = (targetTodoId: string) => {
    if (!draggedTodoId || draggedTodoId === targetTodoId) return

    // When dropping into a specific section update the task's section properties
    if (title === "URGENT") {
      updateCalendarTodo(draggedTodoId, { section: "urgent", rollover: false })
    } else if (title === "ALL DAY") {
      updateCalendarTodo(draggedTodoId, { section: undefined, rollover: false, time: undefined })
    } else if (title === "SCHEDULE") {
      const draggedTodo = calendarTodos.find((t) => t.id === draggedTodoId)
      if (draggedTodo && !draggedTodo.time && !draggedTodo.rollover) {
        updateCalendarTodo(draggedTodoId, { section: undefined, time: "12:00 PM", rollover: false })
      } else {
        updateCalendarTodo(draggedTodoId, { section: undefined, rollover: false })
      }
    }
    // For OVERDUE we don't change the section — the task stays overdue until date is changed

    reorderCalendarTodo(draggedTodoId, targetTodoId, "after")
    setDraggedTodoId(null)
  }

  return (
    <section>
      <h2 className="mb-4 text-[11px] tracking-[0.18em] uppercase text-[#8f8f8f]">{title}</h2>
      <div className="space-y-1.5">
        {todos.map((todo) => (
          <TaskRow
            key={todo.id}
            todo={todo}
            sectionTitle={title}
            showOverdueActions={showOverdueActions}
            // All tasks are draggable — overdue tasks can be dragged out to other sections
            draggable={true}
            isDragging={draggedTodoId === todo.id}
            onDragStart={(_event, todoId) => setDraggedTodoId(todoId)}
            onDropOnTask={handleDropOnTask}
          />
        ))}
      </div>
    </section>
  )
}

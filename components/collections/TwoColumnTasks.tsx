"use client"

import { TaskRow } from "@/components/daily/TaskRow"
import { SectionLines } from "@/components/daily/SectionLines"
import type { Todo } from "@/lib/store"

type TwoColumnTasksProps = {
  todos: Todo[]
  onAdd: (text: string) => void
  ariaLabel: string
  minSlotsPerColumn?: number
}

// The same two-side-by-side-columns layout the day block (Tomorrow) uses:
// tasks fill the left column first, and each column pads out with add-lines.
export function TwoColumnTasks({ todos, onAdd, ariaLabel, minSlotsPerColumn = 5 }: TwoColumnTasksProps) {
  const firstColumnCount = Math.ceil(todos.length / 2)
  const columns = [todos.slice(0, firstColumnCount), todos.slice(firstColumnCount)]

  return (
    <div className="grid grid-cols-2 gap-x-3">
      {columns.map((columnTodos, index) => (
        <div key={index} className="grid content-start gap-y-2 pr-2">
          {columnTodos.map((todo) => (
            <TaskRow key={todo.id} todo={todo} appearance="collection" draggable={true} />
          ))}
          <SectionLines
            count={Math.max(0, minSlotsPerColumn - columnTodos.length)}
            onAdd={onAdd}
            ariaLabel={ariaLabel}
          />
        </div>
      ))}
    </div>
  )
}

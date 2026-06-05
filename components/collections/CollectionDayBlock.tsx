"use client"

import { useMemo, useState } from "react"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { TaskRow } from "@/components/daily/TaskRow"
import { SectionLines, buildCalendarAddHandler } from "@/components/daily/SectionLines"

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

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`

export function CollectionDayBlock({
  date,
  todos,
  featured = false,
  showEmpty = false,
}: CollectionDayBlockProps) {
  const reorderCalendarTodo = useLemonadeStore((state) => state.reorderCalendarTodo)
  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (
    todo: Partial<Todo & { section?: "urgent" | "schedule" | "allday"; rollover?: boolean; dismissed?: boolean }>
  ) => string
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null)
  const [lineVersion, setLineVersion] = useState(0)

  if (todos.length === 0 && !showEmpty) {
    return null
  }

  const sortedTodos = [...todos].map((todo) => todo as CollectionTodo).sort(sortTodos)
  // Distribute the ACTUAL tasks across two side-by-side columns (left fills
  // first), then pad each column with add-lines to a minimum height.
  const firstColumnTaskCount = Math.ceil(sortedTodos.length / 2)
  const firstColumnTodos = sortedTodos.slice(0, firstColumnTaskCount)
  const secondColumnTodos = sortedTodos.slice(firstColumnTaskCount)
  const MIN_SLOTS_PER_COLUMN = 5

  const dateKey = useMemo(() => formatDateKey(date), [date])

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
      onDropOnTask={(targetTodoId, position = "after") => {
        if (!draggedTodoId || draggedTodoId === targetTodoId) return
        reorderCalendarTodo(draggedTodoId, targetTodoId, position)
        setDraggedTodoId(null)
      }}
    />
  )

  const slotsRemaining = (column: "first" | "second") => {
    const filled = column === "first" ? firstColumnTodos.length : secondColumnTodos.length
    return Math.max(0, MIN_SLOTS_PER_COLUMN - filled)
  }

  const buildAddHandler = () =>
    buildCalendarAddHandler({
      addCalendarTodo,
      ensureLabelIds: () => [],
      selectedCalendarDate: dateKey,
      kind: "schedule",
    })

  return (
    <section
      key={lineVersion}
      className="grid min-h-[258px] grid-cols-[112px_1fr_1fr] gap-x-3 border-t border-black/8 bg-[#f7f7f4] px-6 py-9 first:border-t-0"
    >
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

      <div className="grid content-start gap-y-5 pr-2 pt-1">
        {firstColumnTodos.map(renderTask)}
        <SectionLines
          count={Math.max(0, slotsRemaining("first"))}
          onAdd={(text) => {
            buildAddHandler()(text)
            setLineVersion((value) => value + 1)
          }}
          ariaLabel={`Add a task to ${formatDayName(date)} ${date.getDate()}`}
        />
      </div>

      <div className="grid content-start gap-y-5 pr-2 pt-1">
        {secondColumnTodos.map(renderTask)}
        <SectionLines
          count={Math.max(0, slotsRemaining("second"))}
          onAdd={(text) => {
            buildAddHandler()(text)
            setLineVersion((value) => value + 1)
          }}
          ariaLabel={`Add a task to ${formatDayName(date)} ${date.getDate()}`}
        />
      </div>
    </section>
  )
}


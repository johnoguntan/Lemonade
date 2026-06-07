"use client"

import { useCallback, useRef, useState, type DragEvent } from "react"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { TaskRow } from "@/components/daily/TaskRow"
import { SectionLines, buildCalendarAddHandler } from "@/components/daily/SectionLines"

type DailySectionKey = "urgent" | "schedule" | "allday"

type DailySectionProps = {
  title: string
  todos: Todo[]
  showOverdueActions?: boolean
}

const SECTION_KEY_MAP: Record<string, DailySectionKey | "overdue" | null> = {
  URGENT: "urgent",
  SCHEDULE: "schedule",
  "ALL DAY": "allday",
  OVERDUE: "overdue",
}

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`

export function DailySection({ title, todos, showOverdueActions = false }: DailySectionProps) {
  const reorderCalendarTodo = useLemonadeStore((state) => state.reorderCalendarTodo)
  const updateCalendarTodoBase = useLemonadeStore((state) => state.updateCalendarTodo)
  const updateCalendarTodo = updateCalendarTodoBase as unknown as (
    id: string,
    updates: Partial<Todo> & { rollover?: boolean; dismissed?: boolean; section?: DailySectionKey }
  ) => void
  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (
    todo: Partial<Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }>
  ) => string
  const selectedCalendarDate = useLemonadeStore((state) => state.selectedCalendarDate)

  const sectionRef = useRef<HTMLElement | null>(null)
  const draggedIdRef = useRef<string | null>(null)
  const todosRef = useRef<Todo[]>(todos)
  todosRef.current = todos
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sectionKey = SECTION_KEY_MAP[title] ?? null

  const setHighlight = useCallback((on: boolean) => {
    const node = sectionRef.current
    if (!node) return
    if (on) {
      node.setAttribute("data-drag-over", "true")
    } else {
      node.removeAttribute("data-drag-over")
    }
  }, [])

  const applyDropOnSection = useCallback(
    (draggedId: string) => {
      // Read from the store at call time (not a closed-over array) so this
      // callback stays referentially stable and doesn't re-render every TaskRow.
      const draggedTodo = (useLemonadeStore.getState().calendarTodos as (Todo & { rollover?: boolean })[]).find(
        (t) => t.id === draggedId
      )
      if (!draggedTodo) return

      if (title === "URGENT") {
        updateCalendarTodo(draggedId, {
          section: "urgent",
          priority: "urgent",
          rollover: false,
          endOfDay: false,
          time: undefined,
        })
      } else if (title === "ALL DAY") {
        updateCalendarTodo(draggedId, {
          section: undefined,
          priority: draggedTodo.priority === "urgent" ? "normal" : draggedTodo.priority,
          endOfDay: true,
          time: undefined,
          rollover: false,
        })
      } else if (title === "SCHEDULE") {
        const needsTime = !draggedTodo.time && !draggedTodo.rollover
        updateCalendarTodo(draggedId, {
          section: undefined,
          priority: draggedTodo.priority === "urgent" ? "normal" : draggedTodo.priority,
          endOfDay: false,
          time: needsTime ? "12:00 PM" : draggedTodo.time,
          rollover: false,
        })
      } else if (title === "OVERDUE") {
        const past = new Date()
        past.setHours(0, 0, 0, 0)
        past.setDate(past.getDate() - 1)
        updateCalendarTodo(draggedId, {
          section: "allday",
          priority: draggedTodo.priority,
          endOfDay: true,
          rollover: true,
          dismissed: false,
          date: formatDateKey(past),
        })
      }
    },
    [title, updateCalendarTodo]
  )

  const handleTaskDragStart = useCallback((_event: DragEvent<HTMLDivElement>, todoId: string) => {
    draggedIdRef.current = todoId
    setDraggingId(todoId)
  }, [])

  const handleTaskDrop = useCallback(
    (targetTodoId: string, position: "before" | "after" = "after", transferredId?: string) => {
      // Prefer the ID passed directly from the TaskRow's dataTransfer read —
      // this works even when the drag started in a different section (where
      // draggedIdRef would be null).
      const existsInStore = transferredId
        ? useLemonadeStore.getState().calendarTodos.some((t) => t.id === transferredId)
        : false
      const draggedId = draggedIdRef.current ?? (existsInStore ? transferredId : null)
      draggedIdRef.current = null
      setDraggingId(null)
      if (!draggedId || draggedId === targetTodoId) {
        setHighlight(false)
        return
      }
      // Only rewrite section/priority/time when the task is moving INTO this
      // section. A same-section reorder should just change order.
      const sameSection = todosRef.current.some((t) => t.id === draggedId)
      if (!sameSection) {
        applyDropOnSection(draggedId)
      }
      reorderCalendarTodo(draggedId, targetTodoId, position)
      setHighlight(false)
    },
    [applyDropOnSection, reorderCalendarTodo, setHighlight]
  )

  const handleSectionDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setHighlight(true)
    },
    [setHighlight]
  )

  const handleSectionDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node)) return
      setHighlight(false)
    },
    [setHighlight]
  )

  const handleSectionDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      const transferId = event.dataTransfer.getData("text/plain")
      const existsInStore = useLemonadeStore.getState().calendarTodos.some((t) => t.id === transferId)
      const droppedId = draggedIdRef.current ?? (existsInStore ? transferId : null)
      setHighlight(false)
      if (!droppedId) {
        draggedIdRef.current = null
        return
      }
      if (!todosRef.current.some((t) => t.id === droppedId)) {
        applyDropOnSection(droppedId)
      }
      draggedIdRef.current = null
    },
    [applyDropOnSection, setHighlight]
  )

  const handleSectionDragEnd = useCallback(() => {
    draggedIdRef.current = null
    setDraggingId(null)
    setHighlight(false)
  }, [setHighlight])

  const showLines = sectionKey !== null && sectionKey !== "overdue"

  const lineAddHandler =
    sectionKey && sectionKey !== "overdue"
      ? buildCalendarAddHandler({
          addCalendarTodo,
          ensureLabelIds: () => [],
          selectedCalendarDate,
          kind: sectionKey,
        })
      : undefined

  return (
    <section
      ref={sectionRef}
      onDragOver={handleSectionDragOver}
      onDragLeave={handleSectionDragLeave}
      onDrop={handleSectionDrop}
      onDragEnd={handleSectionDragEnd}
      className="rounded-2xl transition-colors [&[data-drag-over=true]]:bg-black/[0.04] dark:[&[data-drag-over=true]]:bg-white/[0.04]"
    >
      <h2 className="mb-3 text-[11px] tracking-[0.18em] uppercase text-[#8f8f8f]">{title}</h2>

      {todos.length > 0 ? (
        <div className="space-y-1.5">
          {todos.map((todo) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              sectionTitle={title}
              showOverdueActions={showOverdueActions}
              draggable={true}
              isDragging={todo.id === draggingId}
              onDragStart={handleTaskDragStart}
              onDropOnTask={handleTaskDrop}
            />
          ))}
        </div>
      ) : null}

      {showLines ? (
        <SectionLines
          count={5}
          onAdd={lineAddHandler}
          ariaLabel={`Add a task to ${title.toLowerCase()}`}
          className="mt-1"
        />
      ) : null}
    </section>
  )
}


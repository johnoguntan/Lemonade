import type { DragEvent as ReactDragEvent } from "react"

export type PlannerTaskDragSource = "calendar" | "timeline-unscheduled" | "timeline-timed" | "list"

export interface PlannerTaskDragPayload {
  todoId: string
  source: PlannerTaskDragSource
  listId?: string
}

const TASK_DRAG_MIME = "application/x-lemonade-task"

export const setPlannerTaskDragData = (
  event: ReactDragEvent<HTMLElement>,
  payload: PlannerTaskDragPayload
) => {
  const serialized = JSON.stringify(payload)
  event.dataTransfer.setData(TASK_DRAG_MIME, serialized)
  event.dataTransfer.setData("text/plain", payload.todoId)
  event.dataTransfer.effectAllowed = "move"
}

export const getPlannerTaskDragData = (
  event: Pick<ReactDragEvent<HTMLElement>, "dataTransfer">
): PlannerTaskDragPayload | null => {
  const serialized = event.dataTransfer.getData(TASK_DRAG_MIME)

  if (serialized) {
    try {
      const parsed = JSON.parse(serialized) as Partial<PlannerTaskDragPayload>
      if (
        typeof parsed.todoId === "string" &&
        (parsed.source === "calendar" ||
          parsed.source === "timeline-unscheduled" ||
          parsed.source === "timeline-timed" ||
          parsed.source === "list")
      ) {
        if (parsed.source === "list") {
          return typeof parsed.listId === "string" ? { todoId: parsed.todoId, source: "list", listId: parsed.listId } : null
        }
        return { todoId: parsed.todoId, source: parsed.source }
      }
    } catch {
      return null
    }
  }

  const todoId = event.dataTransfer.getData("text/plain")
  return todoId ? { todoId, source: "calendar" } : null
}

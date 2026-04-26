type TaskReminderShape = {
  id?: string | null
  title?: string | null
  date?: string | null
  time?: string | null
  location?: string | null
}

const APP_NAME = "Alessandro"

const buildDueDate = (date: string | null | undefined, time: string | null | undefined) => {
  if (!date || !time) return null

  const [year, month, day] = date.split("-").map((part) => Number(part))
  const [hour, minute] = time.split(":").map((part) => Number(part))

  if (!year || !month || !day) return null
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null

  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

const formatMinutesUntilDue = (task: TaskReminderShape, scheduledFor: string | null | undefined) => {
  const dueAt = buildDueDate(task.date ?? null, task.time ?? null)
  if (!dueAt || !scheduledFor) return null

  const reminderAt = new Date(scheduledFor)
  if (Number.isNaN(reminderAt.getTime())) return null

  const diffMinutes = Math.round((dueAt.getTime() - reminderAt.getTime()) / 60000)

  if (diffMinutes <= 0) return "due now"
  if (diffMinutes === 1) return "due in 1 minute"
  if (diffMinutes < 60) return `due in ${diffMinutes} minutes`

  const hours = Math.round(diffMinutes / 60)
  if (hours === 1) return "due in 1 hour"
  return `due in ${hours} hours`
}

export const buildTaskReminderPushPayload = ({
  notificationId,
  task,
  scheduledFor,
}: {
  notificationId: string
  task: TaskReminderShape
  scheduledFor: string | null | undefined
}) => {
  const title = (task.title ?? "").trim() || "Task reminder"
  const timing = formatMinutesUntilDue(task, scheduledFor)
  const body = timing ? `⏰ ${title} — ${timing}` : `⏰ ${title}`

  return {
    type: "task-reminder",
    notificationId,
    taskId: task.id ?? null,
    title: APP_NAME,
    body,
    taskTitle: title,
    location: task.location ?? null,
    url: task.id ? `/?task=${encodeURIComponent(task.id)}${task.date ? `&date=${encodeURIComponent(task.date)}` : ""}` : "/",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    actions: [
      { action: "done", title: "Done" },
      { action: "snooze-30", title: "Snooze 30min" },
    ],
  }
}

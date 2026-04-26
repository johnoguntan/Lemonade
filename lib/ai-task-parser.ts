"use client"

export type AiParsedTask = {
  title: string
  date: string | null
  time: string | null
  priority: "urgent" | "important" | "normal"
  location: string | null
  duration: number | null
  reminder: number | null
  recurring: "daily" | "weekly" | "monthly" | "yearly" | null
  recurringDay: string | null
  notes: string | null
  url: string | null
  labels: string[]
}

export type AiParsedTaskRecord = Record<string, unknown> & {
  title?: unknown
  date?: unknown
  time?: unknown
}

const coerceStringOrNull = (value: unknown) => (typeof value === "string" ? value : null)
const coerceNumberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null)
const coercePriority = (value: unknown): AiParsedTask["priority"] =>
  value === "urgent" || value === "important" || value === "normal" ? value : "normal"

const getClientTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const buildParseBody = (input: string) => ({
  input,
  now: new Date().toISOString(),
  userTimezone: getClientTimezone(),
})

export async function aiParseSingleTask(input: string, signal?: AbortSignal): Promise<AiParsedTask> {
  const raw = input.trim()
  if (!raw) {
    throw new Error("AI parse failed")
  }

  const response = await fetch("/api/parse-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildParseBody(raw)),
    signal,
  })

  if (!response.ok) {
    throw new Error("AI parse failed")
  }

  const data = await response.json()
  const title = typeof data?.title === "string" && data.title.trim() ? data.title.trim() : ""

  if (!title) {
    throw new Error("AI parse failed")
  }

  return {
    title,
    date: coerceStringOrNull(data.date),
    time: coerceStringOrNull(data.time),
    priority: coercePriority(data.priority),
    location: coerceStringOrNull(data.location),
    duration: coerceNumberOrNull(data.duration),
    reminder: coerceNumberOrNull(data.reminder),
    recurring:
      data.recurring === "daily" ||
      data.recurring === "weekly" ||
      data.recurring === "monthly" ||
      data.recurring === "yearly"
        ? data.recurring
        : null,
    recurringDay: coerceStringOrNull(data.recurringDay),
    notes: coerceStringOrNull(data.notes),
    url: coerceStringOrNull(data.url),
    labels: Array.isArray(data.labels)
      ? data.labels.filter((label: unknown): label is string => typeof label === "string")
      : [],
  }
}

export async function aiParseTasks(input: string, signal?: AbortSignal): Promise<AiParsedTaskRecord[]> {
  const raw = input.trim()
  if (!raw) return []

  const response = await fetch("/api/parse-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildParseBody(raw)),
    signal,
  })

  if (!response.ok) {
    throw new Error("AI parse failed")
  }

  const data = await response.json()
  if (Array.isArray(data)) return data as AiParsedTaskRecord[]
  return data && typeof data === "object" ? [data as AiParsedTaskRecord] : []
}

export async function aiParseTaskInput(input: string, signal?: AbortSignal): Promise<AiParsedTask> {
  const raw = input.trim()
  if (!raw) {
    return {
      title: "",
      date: null,
      time: null,
      priority: "normal",
      location: null,
      duration: null,
      reminder: null,
      recurring: null,
      recurringDay: null,
      notes: null,
      url: null,
      labels: [],
    }
  }

  try {
    return await aiParseSingleTask(raw, signal)
  } catch {
    throw new Error("AI parse failed")
  }
}

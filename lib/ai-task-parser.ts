"use client"

export type AiParsedTask = {
  title: string
  date: string | null
  time: string | null
}

export type AiParsedTaskRecord = Record<string, unknown> & {
  title?: unknown
  date?: unknown
  time?: unknown
}

const coerceStringOrNull = (value: unknown) => (typeof value === "string" ? value : null)

export async function aiParseTasks(input: string, signal?: AbortSignal): Promise<AiParsedTaskRecord[]> {
  const raw = input.trim()
  if (!raw) return []

  const response = await fetch("/api/parse-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: raw }),
    signal,
  })

  if (!response.ok) {
    throw new Error("AI parse failed")
  }

  const data = await response.json()
  return Array.isArray(data) ? (data as AiParsedTaskRecord[]) : []
}

export async function aiParseTaskInput(input: string, signal?: AbortSignal): Promise<AiParsedTask> {
  const raw = input.trim()
  if (!raw) {
    return { title: "", date: null, time: null }
  }

  try {
    const tasks = await aiParseTasks(raw, signal)
    const first = tasks[0]
    const title = (typeof first?.title === "string" && first.title.trim() ? first.title.trim() : raw)

    return {
      title,
      date: coerceStringOrNull(first?.date),
      time: coerceStringOrNull(first?.time),
    }
  } catch {
    return { title: raw, date: null, time: null }
  }
}

"use client"

import { addMinutes, format } from "date-fns"
import {
  buildHeuristicParsedTask,
  extractExplicitSignals,
  hasShortcutFields,
} from "@/lib/task-shortcuts"

export type AiParsedTask = {
  title: string
  date: string | null
  time: string | null
  priority: "urgent" | "important" | "normal"
  location: string | null
  duration: number | null
  reminder: number | null
  recurring: "daily" | "weekday" | "weekly" | "monthly" | "yearly" | null
  recurringDay: number | null
  recurringDays?: number[]
  notes: string | null
  url: string | null
  phone: string | null
  attachment: string | null
  labels: string[]
}

export type AiParsedTaskRecord = Record<string, unknown> & {
  title?: unknown
  date?: unknown
  time?: unknown
}

const coerceStringOrNull = (value: unknown) => (typeof value === "string" ? value : null)
const coerceNumberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null)
const coerceWeekdays = (value: unknown) => {
  if (!Array.isArray(value)) return undefined
  const days = value
    .filter((day): day is number => typeof day === "number" && Number.isFinite(day))
    .map((day) => Math.floor(day))
    .filter((day) => day >= 0 && day <= 6)

  return days.length > 0 ? Array.from(new Set(days)) : undefined
}
const coercePriority = (value: unknown): AiParsedTask["priority"] =>
  value === "urgent" || value === "important" || value === "normal" ? value : "normal"

const getClientTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd")
const formatTimeKey = (date: Date) => format(date, "HH:mm")

const getZonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

  const parts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""

  return {
    dateKey: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    timeKey: `${getPart("hour")}:${getPart("minute")}`,
  }
}

const extractRelativeTimeMinutes = (rawInput: string) => {
  const input = rawInput.toLowerCase()
  const match = input.match(/\b(?:in|after)\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/)
  if (!match) return null

  const amount = Number.parseInt(match[1], 10)
  if (!Number.isFinite(amount) || amount <= 0) return null

  const unit = match[2]
  const minutes = unit.startsWith("h") ? amount * 60 : amount
  return { minutes, matchText: match[0] }
}

const buildClientShortcutTask = (input: string): AiParsedTask | null => {
  const raw = input.trim()
  if (!raw) return null

  const timezone = getClientTimezone()
  const now = new Date()
  const today = getZonedParts(now, timezone).dateKey
  const relative = extractRelativeTimeMinutes(raw)
  const inputForModel = relative?.matchText
    ? raw
        .replace(new RegExp(`\\b${relative.matchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "")
        .replace(/\s+/g, " ")
        .trim()
    : raw
  const extracted = extractExplicitSignals(inputForModel)
  const hasExplicitShortcutSignals = extracted.inputForModel !== inputForModel || hasShortcutFields(extracted.explicit)

  if (relative) {
    const scheduledAt = addMinutes(now, relative.minutes)
    const zoned = getZonedParts(scheduledAt, timezone)
    const heuristic = buildHeuristicParsedTask(extracted.inputForModel || inputForModel, today, extracted.explicit)
    if (!heuristic) return null

    return {
      ...heuristic,
      date: zoned.dateKey,
      time: zoned.timeKey,
      reminder: extracted.explicit.reminder ?? 0,
    }
  }

  if (!hasExplicitShortcutSignals) {
    return null
  }

  return buildHeuristicParsedTask(extracted.inputForModel || inputForModel, today, extracted.explicit)
}

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

  const clientShortcutTask = buildClientShortcutTask(raw)
  if (clientShortcutTask) {
    return clientShortcutTask
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
      data.recurring === "weekday" ||
      data.recurring === "weekly" ||
      data.recurring === "monthly" ||
      data.recurring === "yearly"
        ? data.recurring
        : null,
    recurringDay: coerceNumberOrNull(data.recurringDay),
    recurringDays: coerceWeekdays(data.recurringDays),
    notes: coerceStringOrNull(data.notes),
    url: coerceStringOrNull(data.url),
    phone: coerceStringOrNull(data.phone),
    attachment: coerceStringOrNull(data.attachment),
    labels: Array.isArray(data.labels)
      ? data.labels.filter((label: unknown): label is string => typeof label === "string")
      : [],
  }
}

export async function aiParseTasks(input: string, signal?: AbortSignal): Promise<AiParsedTaskRecord[]> {
  const raw = input.trim()
  if (!raw) return []

  const clientShortcutTask = buildClientShortcutTask(raw)
  if (clientShortcutTask) {
    return [clientShortcutTask as unknown as AiParsedTaskRecord]
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
      phone: null,
      attachment: null,
      labels: [],
    }
  }

  try {
    return await aiParseSingleTask(raw, signal)
  } catch {
    throw new Error("AI parse failed")
  }
}

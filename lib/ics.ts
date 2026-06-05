import type { Todo } from "@/lib/store"

// Lightweight .ics (iCalendar) generation for a single task. Produces a file
// that opens in Apple Calendar, Google Calendar, Outlook, etc. This is the
// no-account bridge to calendars before full two-way sync.

const pad = (value: number) => String(value).padStart(2, "0")

// Accepts "15:00", "3:00 PM", "7:45 pm", "9 AM" → minutes since midnight.
const parseTimeToMinutes = (value?: string | null): number | null => {
  if (!value) return null
  const raw = value.trim()

  const h24 = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) {
    const hours = Number(h24[1])
    const minutes = Number(h24[2])
    if (hours <= 23 && minutes <= 59) return hours * 60 + minutes
  }

  const h12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (h12) {
    let hours = Number(h12[1]) % 12
    const minutes = h12[2] ? Number(h12[2]) : 0
    if (/pm/i.test(h12[3])) hours += 12
    if (hours <= 23 && minutes <= 59) return hours * 60 + minutes
  }

  return null
}

const escapeIcs = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")

const localStamp = (date: Date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`

const utcStamp = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`

const dateOnly = (year: number, month: number, day: number) => `${year}${pad(month)}${pad(day)}`

export const buildTaskIcs = (todo: Todo): string => {
  const [year, month, day] = (todo.date ?? "").split("-").map(Number)

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alessandro//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${todo.id}@alessandro`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `SUMMARY:${escapeIcs(todo.text || "Task")}`,
  ]

  const minutes = parseTimeToMinutes(todo.time)

  if (year && month && day && minutes != null) {
    const start = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
    const durationMin =
      typeof todo.durationMinutes === "number" && todo.durationMinutes > 0 ? todo.durationMinutes : 60
    const end = new Date(start.getTime() + durationMin * 60_000)
    lines.push(`DTSTART:${localStamp(start)}`, `DTEND:${localStamp(end)}`)
  } else if (year && month && day) {
    const next = new Date(year, month - 1, day + 1)
    lines.push(
      `DTSTART;VALUE=DATE:${dateOnly(year, month, day)}`,
      `DTEND;VALUE=DATE:${dateOnly(next.getFullYear(), next.getMonth() + 1, next.getDate())}`
    )
  }

  if (todo.location) lines.push(`LOCATION:${escapeIcs(todo.location)}`)
  if (todo.url) lines.push(`URL:${escapeIcs(todo.url)}`)
  if (todo.notes) lines.push(`DESCRIPTION:${escapeIcs(todo.notes)}`)

  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.join("\r\n")
}

export const downloadTaskIcs = (todo: Todo) => {
  const ics = buildTaskIcs(todo)
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  const safeName = (todo.text || "task").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40).toLowerCase()
  anchor.download = `${safeName || "task"}.ics`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

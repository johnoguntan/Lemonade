// Forgiving normalizer for the Custom time input in the task scheduler.
// Users type whatever feels natural; we convert it to one of the app's
// canonical value shapes when they finish (blur/Enter):
//
//   Clock time   "10"  "10pm"  "1030"  "10.30"  "14:00"  → "10:00 AM" / "2:00 PM"
//   Duration     "28"  "1.5"  "10h"  "90 min"  "10 hours" → "28 hours" / "90 minutes"
//   Range        "2-4pm"  "10 to 12"                      → "2:00 PM - 4:00 PM"
//
// Smart-guess rule for bare numbers: integers 0-23 are clock times (24h
// convention above 12), integers 24+ and any decimal are durations in hours.
// Anything unrecognized is returned as-is — free text is still allowed.

type Clock = { hour24: number; minute: number; hadMeridiem: boolean }

const formatClock = ({ hour24, minute }: Clock): string => {
  const meridiem = hour24 >= 12 ? "PM" : "AM"
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${h12}:${String(minute).padStart(2, "0")} ${meridiem}`
}

// Parses one clock-time token. Returns null if it isn't one.
const parseClock = (raw: string): Clock | null => {
  const s = raw.trim().toLowerCase()

  // "1030", "930", "2230" — compact military-ish entry
  const compact = s.match(/^(\d{3,4})\s*(am|pm)?$/)
  if (compact) {
    const digits = compact[1]
    const hour = Number(digits.slice(0, digits.length - 2))
    const minute = Number(digits.slice(-2))
    if (minute > 59) return null
    return resolveClock(hour, minute, compact[2])
  }

  // "10", "10:30", "10.30", "10 pm", "10:30pm", "14:00"
  // Minutes must be exactly two digits — "1.5" is a decimal duration, not 1:50.
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  if (minute > 59) return null
  return resolveClock(hour, minute, m[3])
}

const resolveClock = (hour: number, minute: number, meridiem?: string): Clock | null => {
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    const h24 = (hour % 12) + (meridiem === "pm" ? 12 : 0)
    return { hour24: h24, minute, hadMeridiem: true }
  }
  if (hour > 23) return null
  return { hour24: hour, minute, hadMeridiem: false }
}

const DURATION_RE =
  /^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/i

const formatDuration = (amount: number, unit: "hours" | "minutes"): string => {
  const label = amount === 1 ? unit.slice(0, -1) : unit
  // Drop trailing ".0" but keep real decimals ("1.5 hours")
  const n = Number.isInteger(amount) ? String(amount) : String(amount)
  return `${n} ${label}`
}

export const normalizeCustomTime = (input: string): string => {
  const raw = input.trim().replace(/\s+/g, " ")
  if (!raw) return raw

  // ---- Range: "a - b" / "a to b" / "a – b" -------------------------------
  const rangeParts = raw.split(/\s*(?:-|–|—|\bto\b)\s*/i)
  if (rangeParts.length === 2 && rangeParts[0] && rangeParts[1]) {
    const end = parseClock(rangeParts[1])
    let start = parseClock(rangeParts[0])
    if (start && end) {
      // Meridiem inference: "2-4pm" means 2 PM, "11-1pm" means 11 AM.
      if (!start.hadMeridiem && end.hadMeridiem && start.hour24 <= 12 && start.hour24 >= 1) {
        const endIsPm = end.hour24 >= 12
        const sameMeridiem = start.hour24 % 12 < end.hour24 % 12 || (start.hour24 % 12 === end.hour24 % 12)
        const startPm = endIsPm ? sameMeridiem : !sameMeridiem
        start = { ...start, hour24: (start.hour24 % 12) + (startPm ? 12 : 0) }
      }
      return `${formatClock(start)} - ${formatClock(end)}`
    }
  }

  // ---- Duration with unit: "10h", "90 min", "1.5 hours" ------------------
  const dur = raw.match(DURATION_RE)
  if (dur) {
    const amount = Number(dur[1])
    const unit = /^h/i.test(dur[2]) ? "hours" : "minutes"
    return formatDuration(amount, unit)
  }

  // ---- Single clock time: "10pm", "10:30", "1030", "10.30", "14:00" ------
  // Checked BEFORE the bare-number rule so compact entries like "1030" and
  // dotted entries like "10.30" read as times, not 1030-hour durations.
  // (A bare 1-2 digit integer like "10" or "28" doesn't reach here as a
  // wrong answer: parseClock rejects hours > 23, and 0-23 → clock time is
  // exactly the smart-guess rule.)
  const clock = parseClock(raw)
  if (clock) return formatClock(clock)

  // ---- Bare number: smart guess ------------------------------------------
  // Only durations remain: decimals ("1.5") and integers ≥ 24 ("28", "40").
  const bare = raw.match(/^\d+(\.\d+)?$/)
  if (bare) {
    const n = Number(raw)
    return formatDuration(n, "hours")
  }

  // Unrecognized — keep the user's text untouched.
  return raw
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const ITEM_HEIGHT_PX = 32
const LOOP_COPIES = 5
const LOOP_MIDDLE_INDEX = Math.floor(LOOP_COPIES / 2)

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const parseReminderTime = (value: string | undefined) => {
  if (!value) {
    return { hour: 9, minute: "00", meridiem: "AM" as const }
  }

  const [rawHour, rawMinute] = value.split(":")
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 9, minute: "00", meridiem: "AM" as const }
  }

  const normalizedHour = clamp(Math.floor(hour), 0, 23)
  const snappedMinute = ((Math.round(minute / 5) * 5) % 60 + 60) % 60
  const minuteLabel = String(snappedMinute).padStart(2, "0")
  const meridiem = normalizedHour >= 12 ? ("PM" as const) : ("AM" as const)
  const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12
  return { hour: hour12, minute: minuteLabel, meridiem }
}

const formatReminderTime = (hour12: number, minuteLabel: string, meridiem: "AM" | "PM") => {
  const clampedHour12 = clamp(Math.floor(hour12), 1, 12)
  const minute = clamp(Math.floor(Number(minuteLabel)), 0, 59)
  const base = clampedHour12 % 12
  const hour24 = meridiem === "PM" ? base + 12 : base
  const hh = String(hour24).padStart(2, "0")
  const mm = String(minute).padStart(2, "0")
  return `${hh}:${mm}`
}

type ColumnValue = string

function buildLoopedValues(values: ColumnValue[]) {
  return Array.from({ length: LOOP_COPIES }, () => values).flat()
}

function WheelColumn({
  ariaLabel,
  values,
  value,
  onValueChange,
}: {
  ariaLabel: string
  values: ColumnValue[]
  value: ColumnValue
  onValueChange: (next: ColumnValue) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const stopTimerRef = useRef<number | null>(null)
  const looped = useMemo(() => buildLoopedValues(values), [values])

  const centerOffset = values.length * LOOP_MIDDLE_INDEX

  const scrollToValue = (target: ColumnValue, behavior: ScrollBehavior) => {
    const container = ref.current
    if (!container) return

    const baseIndex = values.indexOf(target)
    const resolvedBaseIndex = baseIndex >= 0 ? baseIndex : 0
    const loopIndex = centerOffset + resolvedBaseIndex
    container.scrollTo({ top: loopIndex * ITEM_HEIGHT_PX, behavior })
  }

  useEffect(() => {
    scrollToValue(value, "auto")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollToValue(value, "smooth")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const normalizeLoopPosition = () => {
    const container = ref.current
    if (!container) return

    const rawIndex = Math.round(container.scrollTop / ITEM_HEIGHT_PX)
    const baseIndex = ((rawIndex % values.length) + values.length) % values.length
    const desiredIndex = centerOffset + baseIndex
    const desiredTop = desiredIndex * ITEM_HEIGHT_PX
    const delta = Math.abs(desiredTop - container.scrollTop)
    if (delta > values.length * ITEM_HEIGHT_PX) {
      container.scrollTo({ top: desiredTop, behavior: "auto" })
    }
  }

  const snapAndCommit = () => {
    const container = ref.current
    if (!container) return

    normalizeLoopPosition()

    const rawIndex = Math.round(container.scrollTop / ITEM_HEIGHT_PX)
    const baseIndex = ((rawIndex % values.length) + values.length) % values.length
    const desiredTop = (centerOffset + baseIndex) * ITEM_HEIGHT_PX
    container.scrollTo({ top: desiredTop, behavior: "smooth" })

    const nextValue = values[baseIndex]
    if (nextValue !== value) {
      onValueChange(nextValue)
    }
  }

  const handleScroll = () => {
    normalizeLoopPosition()
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current)
    }
    stopTimerRef.current = window.setTimeout(() => {
      snapAndCommit()
    }, 120)
  }

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="relative">
      <div
        ref={ref}
        aria-label={ariaLabel}
        onScroll={handleScroll}
        className={cn(
          "h-[160px] w-[86px] overflow-y-auto overscroll-contain rounded-lg",
          "snap-y snap-mandatory scroll-smooth",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{ scrollSnapType: "y mandatory" }}
      >
        {/* top padding so first item can center */}
        <div style={{ height: ITEM_HEIGHT_PX * 2 }} />
        {looped.map((entry, index) => (
          <div
            key={`${entry}-${index}`}
            className="flex items-center justify-center text-sm"
            style={{ height: ITEM_HEIGHT_PX, scrollSnapAlign: "center" }}
          >
            {entry}
          </div>
        ))}
        {/* bottom padding */}
        <div style={{ height: ITEM_HEIGHT_PX * 2 }} />
      </div>

      {/* center highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-muted/50"
      />
    </div>
  )
}

export function ReminderTimeWheel({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
}) {
  const parsed = useMemo(() => parseReminderTime(value), [value])
  const [hour, setHour] = useState<string>(String(parsed.hour))
  const [minute, setMinute] = useState<string>(parsed.minute)
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(parsed.meridiem)

  useEffect(() => {
    setHour(String(parsed.hour))
    setMinute(parsed.minute)
    setMeridiem(parsed.meridiem)
  }, [parsed.hour, parsed.meridiem, parsed.minute])

  useEffect(() => {
    onChange(formatReminderTime(Number(hour), minute, meridiem))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, minute, meridiem])

  const hours = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1)), [])
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")),
    []
  )
  const meridiems = useMemo(() => ["AM", "PM"] as const, [])

  return (
    <div className="relative grid grid-cols-3 gap-2">
      <WheelColumn ariaLabel="Hours" values={hours} value={hour} onValueChange={setHour} />
      <WheelColumn ariaLabel="Minutes" values={minutes} value={minute} onValueChange={setMinute} />
      <WheelColumn ariaLabel="AM or PM" values={[...meridiems]} value={meridiem} onValueChange={(v) => setMeridiem(v as "AM" | "PM")} />
    </div>
  )
}


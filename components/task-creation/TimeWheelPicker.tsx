"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type TimeWheelPickerProps = {
  value: string | null
  onChange: (value: string) => void
}

const ITEM_HEIGHT = 40
const VISIBLE_ROWS = 3
const PADDING_ITEMS = 1

const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]
const minutes = Array.from({ length: 12 }, (_, index) => `${index * 5}`.padStart(2, "0"))
const meridiems = ["AM", "PM"]
const modeOptions = ["Time", "Range", "Custom"] as const
type PickerMode = (typeof modeOptions)[number]

const parseSingleTimeValue = (value: string | null) => {
  const fallback = { hour: "10", minute: "00", meridiem: "AM" }
  if (!value) return fallback

  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return fallback

  return {
    hour: match[1],
    minute: match[2],
    meridiem: match[3].toUpperCase(),
  }
}

const parseRangeValue = (value: string | null) => {
  const fallback = {
    start: { hour: "10", minute: "00", meridiem: "AM" },
    end: { hour: "11", minute: "00", meridiem: "AM" },
  }

  if (!value) return fallback

  const match = value.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  )

  if (!match) return fallback

  return {
    start: {
      hour: match[1],
      minute: match[2],
      meridiem: match[3].toUpperCase(),
    },
    end: {
      hour: match[4],
      minute: match[5],
      meridiem: match[6].toUpperCase(),
    },
  }
}

type WheelColumnProps = {
  options: string[]
  selected: string
  onSelect: (value: string) => void
}

// Number of copies to render for infinite illusion — 9 copies gives plenty of
// room to scroll in either direction before the user could ever hit an edge.
const LOOP_COPIES = 9
const MID_COPY = Math.floor(LOOP_COPIES / 2)

function WheelColumn({ options, selected, onSelect }: WheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Flag to suppress the scroll handler while we silently re-center.
  const silentRef = useRef(false)
  const n = options.length
  const selectedIndex = Math.max(0, options.indexOf(selected))

  // Local index for immediate visual highlight while scrolling (before debounce fires).
  const [localIdx, setLocalIdx] = useState(selectedIndex)

  // Looped options: 9 × the real list.
  const loopedOptions = useMemo(
    () => Array.from({ length: LOOP_COPIES }, () => options).flat(),
    [options]
  )

  // Jump to the center copy's position whenever the external `selected` changes.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    silentRef.current = true
    node.scrollTop = (MID_COPY * n + selectedIndex) * ITEM_HEIGHT
    setLocalIdx(selectedIndex)
    requestAnimationFrame(() => { silentRef.current = false })
  }, [n, selectedIndex])

  const handleScroll = () => {
    if (silentRef.current) return
    const node = scrollRef.current
    if (!node) return

    // Immediate visual feedback — update the highlighted row as the user scrolls.
    const rawIndex = Math.round(node.scrollTop / ITEM_HEIGHT)
    const actualIndex = ((rawIndex % n) + n) % n
    setLocalIdx(actualIndex)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const raw = Math.round(node.scrollTop / ITEM_HEIGHT)
      const actual = ((raw % n) + n) % n
      onSelect(options[actual] ?? selected)
      // Silently snap back to the center copy so there is always room to scroll
      // in either direction without hitting the end of the list.
      silentRef.current = true
      node.scrollTop = (MID_COPY * n + actual) * ITEM_HEIGHT
      requestAnimationFrame(() => { silentRef.current = false })
    }, 120)
  }

  return (
    <div className="relative h-40 overflow-hidden rounded-xl bg-gray-50">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 border-y border-black/8 bg-white/60" />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ paddingTop: ITEM_HEIGHT * PADDING_ITEMS, paddingBottom: ITEM_HEIGHT * PADDING_ITEMS }}>
          {loopedOptions.map((option, index) => {
            const active = option === options[localIdx]
            return (
              <button
                key={`${option}-${index}`}
                type="button"
                onClick={() => {
                  const actualIndex = options.indexOf(option)
                  onSelect(option)
                  setLocalIdx(actualIndex)
                  silentRef.current = true
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = (MID_COPY * n + actualIndex) * ITEM_HEIGHT
                  }
                  requestAnimationFrame(() => { silentRef.current = false })
                }}
                className={[
                  "flex h-10 w-full items-center justify-center transition-all",
                  active ? "text-lg font-semibold text-gray-900" : "text-sm text-gray-300",
                ].join(" ")}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TimeWheelPicker({ value, onChange }: TimeWheelPickerProps) {
  const parsedSingle = useMemo(() => parseSingleTimeValue(value), [value])
  const parsedRange = useMemo(() => parseRangeValue(value), [value])
  const isRangeValue = Boolean(value && /-\s*\d{1,2}:\d{2}\s*(AM|PM)$/i.test(value))
  const isCustomValue = Boolean(value && /hours?|minutes?|mins?/i.test(value))
  const parsedStart = isRangeValue ? parsedRange.start : parsedSingle
  const initialMode: PickerMode =
    isRangeValue
      ? "Range"
      : isCustomValue
        ? "Custom"
        : "Time"

  const [mode, setMode] = useState<PickerMode>(initialMode)
  const [hour, setHour] = useState(parsedStart.hour)
  const [minute, setMinute] = useState(parsedStart.minute)
  const [meridiem, setMeridiem] = useState(parsedStart.meridiem)
  const [endHour, setEndHour] = useState(parsedRange.end.hour)
  const [endMinute, setEndMinute] = useState(parsedRange.end.minute)
  const [endMeridiem, setEndMeridiem] = useState(parsedRange.end.meridiem)
  const [customValue, setCustomValue] = useState(
    isCustomValue ? value ?? "" : ""
  )
  const lastEmittedRef = useRef<string | null>(value)

  useEffect(() => {
    setHour(parsedStart.hour)
    setMinute(parsedStart.minute)
    setMeridiem(parsedStart.meridiem)
    setEndHour(parsedRange.end.hour)
    setEndMinute(parsedRange.end.minute)
    setEndMeridiem(parsedRange.end.meridiem)

    lastEmittedRef.current = value

    if (isCustomValue) {
      setMode("Custom")
      setCustomValue(value ?? "")
    } else if (isRangeValue) {
      setMode("Range")
    } else {
      setMode("Time")
      setCustomValue("")
    }
  }, [
    isCustomValue,
    isRangeValue,
    parsedStart.hour,
    parsedStart.meridiem,
    parsedStart.minute,
    parsedRange.end.hour,
    parsedRange.end.meridiem,
    parsedRange.end.minute,
    value,
  ])

  useEffect(() => {
    const nextValue =
      mode === "Custom"
        ? customValue.trim()
        : mode === "Range"
          ? `${hour}:${minute} ${meridiem} - ${endHour}:${endMinute} ${endMeridiem}`
          : `${hour}:${minute} ${meridiem}`

    if (!nextValue) {
      return
    }

    if (!value && nextValue === "10:00 AM") {
      return
    }

    if (lastEmittedRef.current === nextValue) {
      return
    }
    lastEmittedRef.current = nextValue
    onChange(nextValue)
  }, [customValue, endHour, endMeridiem, endMinute, hour, meridiem, minute, mode, onChange])

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {modeOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={[
              "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition",
              mode === option ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/55",
            ].join(" ")}
          >
            {option}
          </button>
        ))}
      </div>

      {mode === "Custom" ? (
        <div className="rounded-2xl bg-gray-50 p-3">
          <input
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            placeholder="28 hours or 40 hours"
            className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-[13px] text-black outline-none placeholder:text-black/35"
          />
        </div>
      ) : mode === "Range" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <WheelColumn options={hours} selected={hour} onSelect={setHour} />
            <WheelColumn options={minutes} selected={minute} onSelect={setMinute} />
            <WheelColumn options={meridiems} selected={meridiem} onSelect={setMeridiem} />
          </div>
          <div className="px-1 text-center text-[11px] uppercase tracking-[0.18em] text-black/35">to</div>
          <div className="grid grid-cols-3 gap-3">
            <WheelColumn options={hours} selected={endHour} onSelect={setEndHour} />
            <WheelColumn options={minutes} selected={endMinute} onSelect={setEndMinute} />
            <WheelColumn options={meridiems} selected={endMeridiem} onSelect={setEndMeridiem} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <WheelColumn options={hours} selected={hour} onSelect={setHour} />
          <WheelColumn options={minutes} selected={minute} onSelect={setMinute} />
          <WheelColumn options={meridiems} selected={meridiem} onSelect={setMeridiem} />
        </div>
      )}
    </div>
  )
}

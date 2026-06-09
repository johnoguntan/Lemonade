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

// Accumulated wheel delta (px) required to step one item. A standard mouse
// notch is ~100px, a trackpad sends many small deltas — this maps both to a
// controlled one-item-at-a-time movement instead of flinging 3-6 items.
const WHEEL_STEP_THRESHOLD = 60

function WheelColumn({ options, selected, onSelect }: WheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True while WE are moving the scroll position — suppresses handleScroll.
  const silentRef = useRef(false)
  // Accumulated wheel delta since the last step.
  const wheelAccumRef = useRef(0)
  // Active rAF id for the wheel-step animation.
  const animRef = useRef<number | null>(null)
  const n = options.length
  const selectedIndex = Math.max(0, options.indexOf(selected))

  // LOOPED index (0 … LOOP_COPIES*n-1) of the item we are centered on /
  // animating toward. Tracking the looped index (not value, not index % n)
  // means exactly ONE copy highlights — duplicate values like "AM"/"PM"
  // no longer all light up at once.
  const targetRef = useRef(MID_COPY * n + selectedIndex)
  const [centerIdx, setCenterIdx] = useState(MID_COPY * n + selectedIndex)

  // Looped options: 9 × the real list.
  const loopedOptions = useMemo(
    () => Array.from({ length: LOOP_COPIES }, () => options).flat(),
    [options]
  )

  // Helper: move the scroll container to an exact position without triggering
  // the browser's snap animation (which fires many scroll events and causes
  // the debounce / scrollend to read wrong intermediate positions).
  const scrollInstant = (node: HTMLDivElement, top: number) => {
    silentRef.current = true
    // 'instant' skips the CSS scroll-snap animation — lands in one frame.
    node.scrollTo({ top, behavior: "instant" as ScrollBehavior })
    requestAnimationFrame(() => { silentRef.current = false })
  }

  // Animate scrollTop manually with rAF. We CANNOT use scrollTo({ behavior:
  // "smooth" }) here: on a scroll-snap-type: mandatory container Chrome
  // cancels programmatic smooth scrolls and re-snaps to the current position,
  // so the wheel never moves (verified live). Snap is disabled during the
  // animation and restored once we land — the target is always an exact snap
  // position, so restoring never causes a jump.
  const animateTo = (node: HTMLDivElement, top: number) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    const start = node.scrollTop
    const dist = top - start
    if (dist === 0) return
    // Each per-frame scrollTop assignment is an "instant scroll" to Chrome,
    // which fires scroll/scrollend BETWEEN frames. Without this flag those
    // events trigger an early commit whose re-center yanks the wheel back
    // mid-animation. Suppress them and commit explicitly when we land.
    silentRef.current = true
    node.style.scrollSnapType = "none"
    const t0 = performance.now()
    const DURATION = 150
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION)
      const ease = 1 - Math.pow(1 - p, 3) // ease-out cubic
      node.scrollTop = start + dist * ease
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        animRef.current = null
        node.style.scrollSnapType = "y mandatory"
        silentRef.current = false
        commitRef.current?.(node)
      }
    }
    animRef.current = requestAnimationFrame(tick)
  }

  // Re-center on the correct item whenever the external `selected` changes.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const idx = MID_COPY * n + selectedIndex
    scrollInstant(node, idx * ITEM_HEIGHT)
    targetRef.current = idx
    setCenterIdx(idx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, selectedIndex])

  // Commit the currently-centered item and re-center on the middle copy so
  // the user always has room to scroll in either direction.
  const commitRef = useRef<((node: HTMLDivElement) => void) | null>(null)
  commitRef.current = (node: HTMLDivElement) => {
    if (silentRef.current) return
    const raw = Math.round(node.scrollTop / ITEM_HEIGHT)
    const actual = ((raw % n) + n) % n
    const recentered = MID_COPY * n + actual
    targetRef.current = recentered
    setCenterIdx(recentered)
    onSelect(options[actual] ?? selected)
    scrollInstant(node, recentered * ITEM_HEIGHT)
  }

  // scrollend fires AFTER the CSS snap animation completes — the most accurate
  // moment to read the final position. Fall back to a 380ms debounce for
  // browsers that don't support scrollend (Safari < 17.4).
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onScrollEnd = () => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
      commitRef.current?.(node)
    }
    node.addEventListener("scrollend", onScrollEnd)
    return () => node.removeEventListener("scrollend", onScrollEnd)
  }, [])

  // KEY FIX for "one scroll = 5 hours": take full control of wheel input.
  // Native wheel scrolling moves ~100-120px per notch (plus momentum), which
  // at 40px/item flings the wheel 3-6 items past where the user aimed.
  // Instead we preventDefault every wheel event, accumulate the delta, and
  // step exactly ONE item per threshold crossing with a smooth animation —
  // iOS-picker behavior. Touch scrolling on mobile is unaffected (it doesn't
  // fire wheel events) and keeps the native snap + scrollend path.
  // Must be a native listener with { passive: false } — React's onWheel can
  // be registered passive, which would make preventDefault a no-op.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // deltaMode 1 = lines (Firefox mouse wheel) — convert to px.
      const delta = event.deltaMode === 1 ? event.deltaY * ITEM_HEIGHT : event.deltaY
      wheelAccumRef.current += delta
      if (Math.abs(wheelAccumRef.current) < WHEEL_STEP_THRESHOLD) return
      const direction = wheelAccumRef.current > 0 ? 1 : -1
      // Reset (don't just subtract) so a single fast notch can never burst
      // through multiple items.
      wheelAccumRef.current = 0
      const maxIdx = LOOP_COPIES * n - 1
      const next = Math.min(maxIdx, Math.max(0, targetRef.current + direction))
      targetRef.current = next
      setCenterIdx(next)
      animateTo(node, next * ITEM_HEIGHT)
      // The animation fires scroll events → scrollend (or the debounce
      // fallback) commits the value and re-centers — same path as touch.
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      node.removeEventListener("wheel", onWheel)
      if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const handleScroll = () => {
    if (silentRef.current) return
    const node = scrollRef.current
    if (!node) return

    // Immediate visual feedback — highlight the item nearest the center.
    // Clamp to the looped list bounds for overscroll.
    const rawIndex = Math.min(
      LOOP_COPIES * n - 1,
      Math.max(0, Math.round(node.scrollTop / ITEM_HEIGHT))
    )
    setCenterIdx(rawIndex)

    // Fallback debounce for browsers without scrollend support.
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      commitRef.current?.(node)
    }, 380)
  }

  return (
    // CRITICAL: every height here is set in PX from ITEM_HEIGHT via inline
    // styles — never rem-based Tailwind classes like h-10. The app sets
    // html { font-size: 12px }, which silently shrinks rem classes (h-10 →
    // 30px) while the scroll math still assumes ITEM_HEIGHT px. That mismatch
    // made commits land hours away from the visually-centered item.
    // Container = VISIBLE_ROWS × ITEM_HEIGHT so the center row aligns with
    //   paddingTop + offset × ITEM_HEIGHT + ITEM_HEIGHT/2
    // exactly when scrollTop = offset × ITEM_HEIGHT.
    <div
      className="relative overflow-hidden rounded-2xl bg-[#f5f5f5]"
      style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}
    >
      {/* Liquid-glass selection card */}
      <div
        className="pointer-events-none absolute inset-x-2 top-1/2 z-20 -translate-y-1/2 rounded-xl"
        style={{
          height: ITEM_HEIGHT,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(10px) saturate(180%)",
          WebkitBackdropFilter: "blur(10px) saturate(180%)",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)",
          border: "1px solid rgba(0,0,0,0.07)",
        }}
      />
      {/* Top fade — masks items scrolling out of view */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-9 bg-gradient-to-b from-[#f5f5f5] via-[#f5f5f5]/80 to-transparent" />
      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9 bg-gradient-to-t from-[#f5f5f5] via-[#f5f5f5]/80 to-transparent" />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ paddingTop: ITEM_HEIGHT * PADDING_ITEMS, paddingBottom: ITEM_HEIGHT * PADDING_ITEMS }}>
          {loopedOptions.map((option, index) => {
            // Highlight by LOOPED index — exactly one copy is active, so
            // duplicate values ("AM"/"PM") never light up together.
            const active = index === centerIdx
            return (
              <button
                key={`${option}-${index}`}
                type="button"
                // height MUST be px from ITEM_HEIGHT (not h-10, which is rem
                // and shrinks under the app's html { font-size: 12px }).
                style={{ scrollSnapAlign: "center", height: ITEM_HEIGHT }}
                onClick={() => {
                  const actualIndex = index % n
                  const recentered = MID_COPY * n + actualIndex
                  onSelect(options[actualIndex] ?? option)
                  targetRef.current = recentered
                  setCenterIdx(recentered)
                  if (scrollRef.current) {
                    scrollInstant(scrollRef.current, recentered * ITEM_HEIGHT)
                  }
                }}
                className={[
                  "relative z-30 flex w-full items-center justify-center transition-all duration-100",
                  active
                    ? "text-[17px] font-bold tracking-tight text-black"
                    : "text-[13px] font-medium text-black/40",
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
    // KEY GUARD: if this value change is just the parent echoing back what we
    // emitted, do nothing. Without this, typing in the Custom input emits
    // partial text (e.g. "2"), the echo doesn't match the custom regex yet,
    // and this effect would flip the mode back to "Time" and wipe the input —
    // making it impossible to type. Only genuinely external changes (presets,
    // shortcuts, reopening with a saved value) should re-derive local state.
    if (lastEmittedRef.current === value) return

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

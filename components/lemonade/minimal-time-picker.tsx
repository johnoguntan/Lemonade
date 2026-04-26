"use client"

import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MinimalTimePickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const pad2 = (n: number) => `${n}`.padStart(2, "0")

const parse24h = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = Number.parseInt(match[1], 10)
  const m = Number.parseInt(match[2], 10)
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return { hour12, minute: m, period }
}

const to24h = (hour12: number, minute: number, period: "AM" | "PM") => {
  const base = hour12 % 12
  const hour24 = period === "PM" ? base + 12 : base
  return `${pad2(hour24)}:${pad2(minute)}`
}

const formatLabel = (value: string) => {
  const parsed = parse24h(value)
  if (!parsed) return ""
  return `${parsed.hour12}:${pad2(parsed.minute)} ${parsed.period}`
}

export function MinimalTimePicker({ value, onChange, placeholder = "—", className }: MinimalTimePickerProps) {
  const parsed = useMemo(() => parse24h(value), [value])
  const [open, setOpen] = useState(false)

  const hour = parsed?.hour12 ?? 9
  const minute = parsed?.minute ?? 0
  const period = (parsed?.period ?? "AM") as "AM" | "PM"

  const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const minuteOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), [])

  const label = value ? formatLabel(value) : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-left text-sm text-foreground outline-none",
            "focus-visible:border-foreground focus-visible:ring-0",
            className
          )}
        >
          <span className={cn(!label && "text-muted-foreground")}>{label || placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] rounded-2xl border border-border/70 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={`${hour}`}
            onValueChange={(next) => {
              const nextHour = Number.parseInt(next, 10)
              onChange(to24h(nextHour, minute, period))
            }}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Hour" />
            </SelectTrigger>
            <SelectContent className="max-h-[240px]">
              {hourOptions.map((h) => (
                <SelectItem key={h} value={`${h}`}>
                  {pad2(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={`${minute}`}
            onValueChange={(next) => {
              const nextMinute = Number.parseInt(next, 10)
              onChange(to24h(hour, nextMinute, period))
            }}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Min" />
            </SelectTrigger>
            <SelectContent className="max-h-[240px]">
              {minuteOptions.map((m) => (
                <SelectItem key={m} value={`${m}`}>
                  {pad2(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={period}
            onValueChange={(next) => {
              const nextPeriod = next === "PM" ? "PM" : "AM"
              onChange(to24h(hour, minute, nextPeriod))
            }}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="AM/PM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
          <Button type="button" size="sm" className="h-8 rounded-full px-4" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

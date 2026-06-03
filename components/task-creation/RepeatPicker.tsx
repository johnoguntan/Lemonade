"use client"

import { useEffect, useState } from "react"

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly"

export type RepeatConfig = {
  frequency: RepeatFrequency
  interval: number
  daysOfWeek?: number[]
}

type RepeatPickerProps = {
  value: RepeatConfig | null
  onChange: (value: RepeatConfig | null) => void
  onClose?: () => void
}

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"]

export function RepeatPicker({ value, onChange, onClose }: RepeatPickerProps) {
  const [frequency, setFrequency] = useState<RepeatFrequency>(value?.frequency ?? "daily")
  const [interval, setInterval] = useState<number>(value?.interval ?? 1)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(value?.daysOfWeek ?? [1])

  useEffect(() => {
    setFrequency(value?.frequency ?? "daily")
    setInterval(value?.interval ?? 1)
    setDaysOfWeek(value?.daysOfWeek ?? [1])
  }, [value])

  const apply = () => {
    const nextValue: RepeatConfig = {
      frequency,
      interval: Math.max(1, interval || 1),
      ...(frequency === "weekly" ? { daysOfWeek } : {}),
    }
    onChange(nextValue)
    onClose?.()
  }

  const clear = () => {
    onChange(null)
    onClose?.()
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
      <div className="space-y-4">
        <div className="space-y-2">
          {([
            ["daily", "Daily"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
            ["yearly", "Yearly"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFrequency(key)}
              className={[
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                frequency === key ? "bg-[#ff4d57] text-white" : "bg-gray-50 text-gray-800 hover:bg-gray-100",
              ].join(" ")}
            >
              <span>{label}</span>
              {frequency === key ? <span>✓</span> : null}
            </button>
          ))}
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <span>Every</span>
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(event) => setInterval(Number.parseInt(event.target.value || "1", 10))}
              className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none"
            />
            <span>
              {frequency === "daily" && "day(s)"}
              {frequency === "weekly" && "week(s)"}
              {frequency === "monthly" && "month(s)"}
              {frequency === "yearly" && "year(s)"}
            </span>
          </label>

          {frequency === "weekly" ? (
            <div>
              <p className="mb-2 text-sm text-gray-700">On</p>
              <div className="flex gap-1">
                {dayLabels.map((label, index) => {
                  const active = daysOfWeek.includes(index)
                  return (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      onClick={() =>
                        setDaysOfWeek((current) =>
                          current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort()
                        )
                      }
                      className={[
                        "flex h-9 w-9 items-center justify-center border text-sm transition",
                        active ? "border-[#ff4d57] bg-[#ff4d57] text-white" : "border-gray-300 text-gray-700",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={clear} className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700">
            Cancel
          </button>
          <button type="button" onClick={apply} className="rounded-xl bg-[#ff4d57] px-4 py-2 text-sm text-white">
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

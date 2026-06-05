"use client"

import { useState, type KeyboardEvent } from "react"
import { useLemonadeStore, type Todo } from "@/lib/store"

type DailySectionKey = "urgent" | "schedule" | "allday"

export type SectionLinesProps = {
  count?: number
  onAdd?: (text: string) => void
  ariaLabel?: string
  placeholder?: string
  className?: string
  lineHeightClass?: string
}

const DEFAULT_LINE_HEIGHT = "h-9"

export function SectionLines({
  count = 5,
  onAdd,
  ariaLabel = "Add a task",
  placeholder = "Add a task…",
  className = "",
  lineHeightClass = DEFAULT_LINE_HEIGHT,
}: SectionLinesProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [text, setText] = useState("")

  if (!onAdd) {
    return (
      <div className={className} aria-hidden="true">
        {Array.from({ length: count }).map((_, index) => (
          <div key={`line-${index}`} className={lineHeightClass} />
        ))}
      </div>
    )
  }

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setActiveIndex(null)
      return
    }
    onAdd(trimmed)
    setText("")
    setActiveIndex(null)
  }

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      submit()
    } else if (event.key === "Escape") {
      setText("")
      setActiveIndex(null)
    }
  }

  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => {
        if (activeIndex === index) {
          return (
            <div key={`line-${index}`} className={`flex items-center ${lineHeightClass}`}>
              <input
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                onBlur={() => {
                  if (!text.trim()) setActiveIndex(null)
                }}
                onKeyDown={handleKey}
                placeholder={placeholder}
                className="h-7 w-full bg-transparent text-[14px] font-light text-[#3d3d3d] outline-none placeholder:text-[#c5c5c5] dark:text-white/90 dark:placeholder:text-white/25"
              />
            </div>
          )
        }
        return (
          <button
            key={`line-${index}`}
            type="button"
            onClick={() => {
              setActiveIndex(index)
              setText("")
            }}
            aria-label={ariaLabel}
            className={`block w-full text-left ${lineHeightClass}`}
          />
        )
      })}
    </div>
  )
}

export type DailySectionInputKind = DailySectionKey | "overdue" | "collection"

export function buildCalendarAddHandler(input: {
  addCalendarTodo: (todo: Partial<Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }>) => string
  ensureLabelIds: (names: string[]) => string[]
  selectedCalendarDate: string
  kind: DailySectionInputKind
  tagNames?: string[]
}) {
  return (text: string) => {
    if (input.kind === "overdue") {
      const past = new Date()
      past.setHours(0, 0, 0, 0)
      past.setDate(past.getDate() - 1)
      const pastKey = `${past.getFullYear()}-${`${past.getMonth() + 1}`.padStart(2, "0")}-${`${past.getDate()}`.padStart(2, "0")}`
      input.addCalendarTodo({
        text,
        completed: false,
        date: pastKey,
        section: "allday",
        priority: "normal",
        endOfDay: true,
        rollover: true,
      })
      return
    }

    if (input.kind === "collection") {
      const labelIds = input.tagNames ? input.ensureLabelIds(input.tagNames) : []
      input.addCalendarTodo({
        text,
        completed: false,
        date: null,
        priority: "normal",
        labelIds,
        endOfDay: false,
      })
      return
    }

    input.addCalendarTodo({
      text,
      completed: false,
      date: input.selectedCalendarDate,
      section: input.kind,
      priority: input.kind === "urgent" ? "urgent" : "normal",
      endOfDay: input.kind === "allday",
    })
  }
}

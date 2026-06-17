"use client"

import { useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"

type DailySectionKey = "urgent" | "schedule" | "allday"

type StoreTodoWithDailyFields = Todo & {
  section?: DailySectionKey
  rollover?: boolean
  dismissed?: boolean
}

const sectionConfig: Array<{ key: DailySectionKey; label: string }> = [
  { key: "urgent", label: "Urgent" },
  { key: "schedule", label: "Schedule" },
  { key: "allday", label: "All Day" },
]

export function QuickInput() {
  const [value, setValue] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [targetSection, setTargetSection] = useState<DailySectionKey>("schedule")
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (todo: Partial<StoreTodoWithDailyFields>) => string

  const todayKey = formatLocalDateKey(new Date())

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleEscape)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [menuOpen])

  const submitTask = () => {
    const trimmed = value.trim()

    if (!trimmed) {
      setMenuOpen(true)
      return
    }

    addCalendarTodo({
      text: trimmed,
      completed: false,
      date: todayKey,
      labelIds: [],
      subtasks: [],
      section: targetSection,
      endOfDay: targetSection === "allday",
      priority: targetSection === "urgent" ? "urgent" : "normal",
      rollover: false,
      dismissed: false,
    })

    setValue("")
    setMenuOpen(false)
    setTargetSection("schedule")
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-4">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submitTask()
            }

            if (event.key === "Escape") {
              setMenuOpen(false)
            }
          }}
          placeholder="Add a task..."
          className="h-11 w-full rounded-full border border-black/10 bg-white px-6 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-black/30"
        />

        <button
          type="button"
          onClick={submitTask}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-neutral-100"
          aria-label="Add task"
        >
          <Plus size={24} strokeWidth={1.75} />
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute left-0 top-full z-20 mt-3 min-w-[180px] bg-white py-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
          {sectionConfig.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setTargetSection(section.key)
                setMenuOpen(false)
                window.requestAnimationFrame(() => {
                  inputRef.current?.focus()
                })
              }}
              className="block w-full px-4 py-2 text-left text-[12px] uppercase tracking-[0.18em] text-gray-700 transition hover:bg-gray-100"
            >
              {section.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

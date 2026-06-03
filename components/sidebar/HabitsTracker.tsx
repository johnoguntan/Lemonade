"use client"

import { useEffect, useRef, useState } from "react"
import { useAllsenadroStore } from "@/lib/allsenadro-store"

export function HabitsTracker() {
  const habits = useAllsenadroStore((state) => state.habits)
  const fetchHabits = useAllsenadroStore((state) => state.fetchHabits)
  const toggleHabitToday = useAllsenadroStore((state) => state.toggleHabitToday)
  const addHabit = useAllsenadroStore((state) => state.addHabit)
  const userId = useAllsenadroStore((state) => state.userId)
  const [isAdding, setIsAdding] = useState(false)
  const [draftName, setDraftName] = useState("")
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!userId) return
    void fetchHabits()
  }, [fetchHabits, userId])

  useEffect(() => {
    if (!isAdding) return
    inputRef.current?.focus()
  }, [isAdding])

  useEffect(() => {
    if (!isAdding) return

    const handleOutside = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsAdding(false)
        setDraftName("")
      }
    }

    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [isAdding])

  const handleAddHabit = async () => {
    if (!userId) return

    const trimmed = draftName.trim()

    if (!trimmed) {
      return
    }

    const today = new Date().toISOString().slice(0, 10)

    await addHabit({
      user_id: userId,
      name: trimmed,
      repeat_duration_days: 1,
      start_date: today,
      end_date: null,
      color: "#f59e0b",
      sort_order: habits.length,
      is_active: true,
    })

    setDraftName("")
    setIsAdding(false)
  }

  return (
    <section className="px-6 py-4">
      <div ref={popoverRef} className="relative mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#545454]">Daily + Habits</p>
        <button
          type="button"
          onClick={() => setIsAdding((current) => !current)}
          className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#5f5f5f] transition hover:border-black/30 hover:text-black"
        >
          Add
        </button>

        {isAdding ? (
          <div className="absolute right-0 top-full z-20 mt-2 w-[220px] rounded-2xl border border-black/10 bg-white p-3 shadow-lg">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#7a7a7a]">New Habit</p>
            <input
              ref={inputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleAddHabit()
                }

                if (event.key === "Escape") {
                  setIsAdding(false)
                  setDraftName("")
                }
              }}
              placeholder="Take vitamins"
              className="mt-2 h-9 w-full rounded-full border border-black/10 bg-white px-3 text-[13px] text-black outline-none placeholder:text-[#9a9a9a]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false)
                  setDraftName("")
                }}
                className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[#7a7a7a] transition hover:text-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddHabit()}
                className="rounded-full bg-black px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white transition hover:bg-[#222]"
              >
                Save
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {habits.length === 0 ? (
        <p className="text-[12px] text-[#686868]">No habits yet</p>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <button
              key={habit.id}
              type="button"
              onClick={() => void toggleHabitToday(habit.id)}
              className="flex w-full items-center gap-3 text-left"
            >
              <span
                className={[
                  "relative flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors",
                  habit.completed_today ? "border-black bg-black" : "border-[#9b9b9b] bg-transparent",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-4 w-4 rounded-full transition-transform",
                    habit.completed_today ? "translate-x-5 bg-white" : "translate-x-1 bg-black",
                  ].join(" ")}
                />
              </span>
              <span className="text-[14px] leading-5 text-black">{habit.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

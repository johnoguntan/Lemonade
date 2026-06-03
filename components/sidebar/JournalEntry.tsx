"use client"

import { useEffect, useMemo, useState } from "react"
import { useAllsenadroStore } from "@/lib/allsenadro-store"

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

const toDateKey = (date: Date) => date.toISOString().slice(0, 10)

export function JournalEntry() {
  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => toDateKey(today), [today])
  const [content, setContent] = useState("")

  const journalEntry = useAllsenadroStore((state) => state.journalEntry)
  const fetchJournalEntry = useAllsenadroStore((state) => state.fetchJournalEntry)
  const saveJournalEntry = useAllsenadroStore((state) => state.saveJournalEntry)
  const userId = useAllsenadroStore((state) => state.userId)

  useEffect(() => {
    if (!userId) return
    void fetchJournalEntry(todayKey)
  }, [fetchJournalEntry, todayKey, userId])

  useEffect(() => {
    setContent(journalEntry?.date === todayKey ? journalEntry.content : "")
  }, [journalEntry, todayKey])

  return (
    <section className="px-6 py-4">
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#545454]">5 Minute Memory / Story</p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#5f5f5f]">{formatDateLabel(today)}</p>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onBlur={() => {
          void saveJournalEntry(content, todayKey)
        }}
        placeholder="Write anything..."
        className="min-h-[220px] w-full resize-none bg-transparent text-[13px] leading-5 text-black outline-none placeholder:text-[#555]"
      />
    </section>
  )
}

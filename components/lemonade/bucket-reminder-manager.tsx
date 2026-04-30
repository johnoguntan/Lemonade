"use client"

import { useEffect, useMemo, useState } from "react"
import { formatLocalDateKey, useLemonadeStore } from "@/lib/store"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"

type BucketId = "next-week" | "this-month" | "next-month" | "next-year"

type DueItem = {
  bucketId: BucketId
  todoId: string
  text: string
  dueDate: string
}

const BUCKET_LABEL: Record<BucketId, string> = {
  "next-week": "Next Week",
  "this-month": "This Month",
  "next-month": "Next Month",
  "next-year": "Next Year",
}

const getTomorrowKey = (base: Date) => {
  const next = new Date(base)
  next.setDate(next.getDate() + 1)
  return formatLocalDateKey(next)
}

export function BucketReminderManager() {
  const { lists, addCalendarTodo, deleteListTodo, updateListTodo } = useLemonadeStore()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<DueItem | null>(null)

  const todayKey = useMemo(() => formatLocalDateKey(new Date()), [])

  const dueItems = useMemo(() => {
    const buckets: BucketId[] = ["next-week", "this-month", "next-month", "next-year"]
    const result: DueItem[] = []
    for (const bucketId of buckets) {
      const list = lists.find((l) => l.id === bucketId)
      if (!list) continue
      for (const item of list.todos) {
        if (typeof item.date !== "string" || !item.date) continue
        if (item.completed) continue
        if (item.date <= todayKey) {
          result.push({ bucketId, todoId: item.id, text: item.text, dueDate: item.date })
        }
      }
    }
    // Oldest-first
    result.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    return result
  }, [lists, todayKey])

  // Poll lightly so it can trigger after midnight without refresh.
  useEffect(() => {
    const interval = window.setInterval(() => {
      // trigger memo recalculation via state toggling open/active below
      if (!active && dueItems.length > 0) {
        setActive(dueItems[0])
        setOpen(true)
      }
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [active, dueItems])

  // Open when a due item appears.
  useEffect(() => {
    if (open) return
    if (active) return
    if (dueItems.length === 0) return
    window.setTimeout(() => {
      setActive(dueItems[0])
      setOpen(true)
    }, 0)
  }, [active, dueItems, open])

  const handleMoveToToday = () => {
    if (!active) return
    const nowKey = formatLocalDateKey(new Date())
    addCalendarTodo({
      text: active.text,
      completed: false,
      date: nowKey,
      labelIds: [],
      subtasks: [],
    })
    deleteListTodo(active.bucketId, active.todoId)
    setOpen(false)
    setActive(null)
  }

  const handleKeepInArchive = () => {
    if (!active) return
    const tomorrowKey = getTomorrowKey(new Date())
    updateListTodo(active.bucketId, active.todoId, { date: tomorrowKey })
    setOpen(false)
    setActive(null)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="mx-auto w-full max-w-[520px] pb-4">
        <DrawerHeader>
          <DrawerTitle className="text-[12px] font-extrabold uppercase tracking-[0.16em]">
            Reminder
          </DrawerTitle>
          <div className="mt-2 text-[14px] font-task font-medium text-foreground">
            {active?.text ?? ""}
          </div>
          <div className="mt-2 text-[12px] text-muted-foreground">
            This item is ready from <span className="font-medium">{BUCKET_LABEL[active?.bucketId ?? "next-week"]}</span>. Add it to today?
          </div>
        </DrawerHeader>
        <DrawerFooter className="gap-2 px-5">
          <Button type="button" className="h-11" onClick={handleMoveToToday}>
            Add to Today
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={handleKeepInArchive}>
            Keep in Archive
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" className="h-11">
              Dismiss
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

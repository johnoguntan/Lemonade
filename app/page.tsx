"use client"

import { useEffect } from "react"
import { RotateCcw, RotateCw, Undo2 } from "lucide-react"
import { CollectionsPanel } from "@/components/collections/CollectionsPanel"
import { DailyView } from "@/components/daily/DailyView"
import { LeftSidebar } from "@/components/sidebar/LeftSidebar"
import { useAllsenadroStore } from "@/lib/allsenadro-store"
import type { Collection, HabitWithLog, JournalEntry, PresetWithCollections } from "@/lib/types"
import { formatLocalDateKey, useLemonadeStore, type Todo } from "@/lib/store"
import { createSupabaseBrowserClient, getSupabaseBrowserSession } from "@/lib/supabase/client"

type DailySectionKey = "urgent" | "schedule" | "allday"
type StoreTodoWithDailyFields = Todo & { section?: DailySectionKey; rollover?: boolean; dismissed?: boolean }

const DEMO_SEED_KEY = "allsenadro-demo-seeded-v2"

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export default function Page() {
  const initializeAllsenadro = useAllsenadroStore((state) => state.initializeAllsenadro)
  const initializedUserId = useAllsenadroStore((state) => state.userId)
  const isLoading = useAllsenadroStore((state) => state.isLoading)
  const habits = useAllsenadroStore((state) => state.habits)
  const collections = useAllsenadroStore((state) => state.collections)
  const presets = useAllsenadroStore((state) => state.presets)
  const journalEntry = useAllsenadroStore((state) => state.journalEntry)
  const restoreLastDeletedTodo = useLemonadeStore((state) => state.restoreLastDeletedTodo)
  const undoTaskAction = useLemonadeStore((state) => state.undoTaskAction)
  const redoTaskAction = useLemonadeStore((state) => state.redoTaskAction)
  const canUndoTaskAction = useLemonadeStore((state) => state.canUndoTaskAction)
  const canRedoTaskAction = useLemonadeStore((state) => state.canRedoTaskAction)
  const lastDeleted = useLemonadeStore((state) => state.lastDeleted)
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos)
  const addCalendarTodoBase = useLemonadeStore((state) => state.addCalendarTodo)
  const addCalendarTodo = addCalendarTodoBase as unknown as (todo: Partial<StoreTodoWithDailyFields>) => string

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      const supabase = createSupabaseBrowserClient()
      const session = await getSupabaseBrowserSession(supabase)
      const userId = session?.user?.id

      if (!userId || cancelled) {
        return
      }

      if (initializedUserId === userId || isLoading) {
        return
      }

      await initializeAllsenadro(userId)
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [initializeAllsenadro, initializedUserId, isLoading])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const editing = isEditableTarget(event.target)

      // Undo / redo — but don't hijack native text-editing undo while typing.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        if (editing) return
        event.preventDefault()
        undoTaskAction()
        return
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        ((event.shiftKey && event.key.toLowerCase() === "z") || event.key.toLowerCase() === "y")
      ) {
        if (editing) return
        event.preventDefault()
        redoTaskAction()
        return
      }

      // "n" — jump to the new-task input (only when not already typing somewhere).
      if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault()
        window.dispatchEvent(new Event("allsenadro:new-task-focus"))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [redoTaskAction, undoTaskAction])

  useEffect(() => {
    if (typeof window === "undefined" || isLoading || !initializedUserId) {
      return
    }

    const host = window.location.hostname
    const isLocalDemoHost = host === "localhost" || host === "127.0.0.1" || host === "::1"

    if (!isLocalDemoHost) {
      return
    }

    if (window.localStorage.getItem(DEMO_SEED_KEY) === "1") {
      return
    }

    const hasLocalContent = calendarTodos.length > 0 || Boolean(journalEntry?.content?.trim()) || habits.length > 0
    if (hasLocalContent) {
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = addDays(today, 1)
    const dayAfterTomorrow = addDays(today, 2)
    const nextWeek = addDays(today, 7)
    const nextWeekTwo = addDays(today, 8)
    const nextMonth = addDays(today, 30)
    const nextYear = addDays(today, 365)
    const twoDaysAgo = addDays(today, -2)

    const defaultCollectionNames = ["Tomorrow", "Next Week", "Next Month", "Next Year", "Whenever"]
    const labelIds = useLemonadeStore.getState().ensureLabelIds(defaultCollectionNames)
    const labelIdByName = new Map(defaultCollectionNames.map((name, index) => [name, labelIds[index] ?? ""]))

    const demoTodos: Array<Partial<StoreTodoWithDailyFields>> = [
      {
        text: "Call NY IRS figure out how...",
        date: formatLocalDateKey(today),
        time: "9:15 AM - 10:05 AM",
        priority: "normal",
        section: "schedule",
        endOfDay: false,
      },
      {
        text: "Make appointment with Dr. Allen for mom",
        date: formatLocalDateKey(today),
        time: "9:45 AM - 10:05 AM",
        priority: "important",
        section: "schedule",
        endOfDay: false,
      },
      {
        text: "Lunch with Nancy",
        date: formatLocalDateKey(today),
        time: "1:00 PM",
        priority: "low",
        section: "schedule",
        endOfDay: false,
      },
      {
        text: "Follow up with the welding man to see if he will put casters on",
        date: formatLocalDateKey(today),
        location: "MR WELDING",
        notes: "212-987-4532",
        priority: "urgent",
        section: "urgent",
        endOfDay: false,
      },
      {
        text: "Write review of Kiehl's Nicole at Nolita",
        date: formatLocalDateKey(today),
        notes: "NOTES: She was super rude and this is why I am writing a review of her.",
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Check if Aqualectra account has been opened and funded.",
        date: formatLocalDateKey(today),
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Follow up with Michelle from Industrious",
        date: formatLocalDateKey(today),
        notes: "Ph 212-555-1212 212-555-1212",
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Transfer $$ to RBC for Electric Bill",
        date: formatLocalDateKey(today),
        notes: "- Look at online statement to confirm",
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Write movie review for insta",
        date: formatLocalDateKey(today),
        notes: "- The Laundromat",
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Transfer $$ to RBC for Electric Bill",
        date: formatLocalDateKey(twoDaysAgo),
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Ask Euba about closet doors",
        date: formatLocalDateKey(addDays(today, -21)),
        priority: "medium",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Return Amazon Fans",
        date: formatLocalDateKey(tomorrow),
        time: "2:15 PM - 3:05 AM",
        priority: "medium",
        section: "schedule",
        endOfDay: false,
        labelIds: [labelIdByName.get("Tomorrow") ?? ""].filter(Boolean),
      },
      {
        text: "Follow up with the welding man to see if he will put casters on",
        date: formatLocalDateKey(tomorrow),
        time: "7:45 PM - 8:05 PM",
        priority: "low",
        section: "schedule",
        endOfDay: false,
        labelIds: [labelIdByName.get("Tomorrow") ?? ""].filter(Boolean),
      },
      {
        text: "Ask Euba about closet doors",
        date: formatLocalDateKey(dayAfterTomorrow),
        notes: "(212) 555-1212",
        priority: "important",
        section: "allday",
        endOfDay: true,
      },
      {
        text: "Edit Chris Document",
        date: formatLocalDateKey(nextWeek),
        time: "9:15 AM - 10:05 AM",
        priority: "normal",
        section: "schedule",
        endOfDay: false,
        labelIds: [labelIdByName.get("Next Week") ?? ""].filter(Boolean),
      },
      {
        text: "Follow up with the welding man to see if he will put casters on",
        date: formatLocalDateKey(nextWeekTwo),
        time: "7:45 PM - 8:05 PM",
        notes: "www.Instagram.com/34thdskjl",
        priority: "normal",
        section: "schedule",
        endOfDay: false,
        labelIds: [labelIdByName.get("Next Week") ?? ""].filter(Boolean),
      },
      {
        text: "Return Amazon Fans",
        date: formatLocalDateKey(nextMonth),
        time: "2:15 PM - 3:05 AM",
        priority: "medium",
        section: "schedule",
        endOfDay: false,
        labelIds: [labelIdByName.get("Next Month") ?? ""].filter(Boolean),
      },
      {
        text: "Make appointment with Dr. Alex",
        date: formatLocalDateKey(nextMonth),
        notes: "(212) 555-1212",
        time: "9:15 AM - 10:05 AM",
        priority: "high",
        section: "schedule",
        endOfDay: false,
        labelIds: [labelIdByName.get("Next Month") ?? ""].filter(Boolean),
      },
      {
        text: "Plan 2027 vision week",
        date: formatLocalDateKey(nextYear),
        notes: "Big-picture planning block",
        priority: "low",
        section: "allday",
        endOfDay: true,
        labelIds: [labelIdByName.get("Next Year") ?? ""].filter(Boolean),
      },
      {
        text: "Someday dinner at NOK by Alara",
        date: formatLocalDateKey(addDays(today, 4)),
        notes: "Whenever collection example",
        priority: "normal",
        section: "allday",
        endOfDay: true,
        labelIds: [labelIdByName.get("Whenever") ?? ""].filter(Boolean),
      },
    ]

    demoTodos.forEach((todo) => addCalendarTodo(todo))

    const demoCollections: Collection[] = [
      {
        id: "demo-col-tomorrow",
        user_id: initializedUserId ?? "demo-user",
        name: "Tomorrow",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(tomorrow),
        fixed_end_date: formatLocalDateKey(tomorrow),
        is_default: true,
        sort_order: 0,
        created_at: "",
        updated_at: "",
      },
      {
        id: "demo-col-next-week",
        user_id: initializedUserId ?? "demo-user",
        name: "Next Week",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(nextWeek),
        fixed_end_date: formatLocalDateKey(addDays(nextWeek, 6)),
        is_default: true,
        sort_order: 1,
        created_at: "",
        updated_at: "",
      },
      {
        id: "demo-col-next-month",
        user_id: initializedUserId ?? "demo-user",
        name: "Next Month",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(nextMonth),
        fixed_end_date: formatLocalDateKey(addDays(nextMonth, 29)),
        is_default: true,
        sort_order: 2,
        created_at: "",
        updated_at: "",
      },
      {
        id: "demo-col-next-year",
        user_id: initializedUserId ?? "demo-user",
        name: "Next Year",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(nextYear),
        fixed_end_date: formatLocalDateKey(addDays(nextYear, 364)),
        is_default: true,
        sort_order: 3,
        created_at: "",
        updated_at: "",
      },
      {
        id: "demo-col-whenever",
        user_id: initializedUserId ?? "demo-user",
        name: "Whenever",
        type: "tag-based",
        color: null,
        date_range_type: null,
        dynamic_range: null,
        fixed_start_date: null,
        fixed_end_date: null,
        is_default: true,
        sort_order: 4,
        created_at: "",
        updated_at: "",
      },
    ]

    const demoPreset: PresetWithCollections = {
      id: "demo-preset-default",
      user_id: initializedUserId ?? "demo-user",
      name: "Default",
      is_default: true,
      sort_order: 0,
      created_at: "",
      collections: demoCollections,
    }

    const demoHabits: HabitWithLog[] = [
      {
        id: "demo-habit-1",
        user_id: initializedUserId ?? "demo-user",
        name: "Take Naltrexone Pill",
        repeat_duration_days: 1,
        start_date: formatLocalDateKey(today),
        end_date: null,
        color: "#f59e0b",
        sort_order: 0,
        is_active: true,
        created_at: "",
        updated_at: "",
        completed_today: false,
        log_id: null,
      },
      {
        id: "demo-habit-2",
        user_id: initializedUserId ?? "demo-user",
        name: "Swam 70 laps",
        repeat_duration_days: 1,
        start_date: formatLocalDateKey(today),
        end_date: null,
        color: "#f59e0b",
        sort_order: 1,
        is_active: true,
        created_at: "",
        updated_at: "",
        completed_today: false,
        log_id: null,
      },
    ]

    const demoJournalEntry: JournalEntry = {
      id: "demo-journal-today",
      user_id: initializedUserId ?? "demo-user",
      content: "Caught a clear thought about the kind of week I want to create. Keep the pace intentional.",
      date: formatLocalDateKey(today),
      created_at: "",
      updated_at: "",
    }

    useAllsenadroStore.setState((state) => ({
      ...state,
      collections: demoCollections,
      presets: [demoPreset],
      activePresetId: demoPreset.id,
      uiPreferences: {
        ...state.uiPreferences,
        activePresetId: demoPreset.id,
      },
      habits: demoHabits,
      journalEntry: demoJournalEntry,
    }))

    window.localStorage.setItem(DEMO_SEED_KEY, "1")
  }, [
    addCalendarTodo,
    calendarTodos.length,
    collections.length,
    habits.length,
    initializedUserId,
    isLoading,
    journalEntry?.content,
    presets.length,
  ])

  const focusQuickTaskInput = () => {
    window.dispatchEvent(new Event("allsenadro:new-task-focus"))
  }

  const toolbarButtonClass =
    "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/70 transition hover:border-black/20 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#f4f3ef]">
      <div className="h-full min-w-0 basis-[20%]">
        <LeftSidebar />
      </div>

      <div className="flex min-w-0 basis-[80%] flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-[#f7f6f1] px-5">
          <div />

          <div className="flex items-center gap-2">
            <button type="button" onClick={focusQuickTaskInput} className={toolbarButtonClass}>
              New Task
            </button>
            <button
              type="button"
              onClick={() => restoreLastDeletedTodo()}
              disabled={!lastDeleted}
              className={toolbarButtonClass}
            >
              <RotateCcw size={14} />
              Restore
            </button>
            <button
              type="button"
              onClick={() => undoTaskAction()}
              disabled={!canUndoTaskAction}
              className={toolbarButtonClass}
            >
              <Undo2 size={14} />
              Undo
            </button>
            <button
              type="button"
              onClick={() => redoTaskAction()}
              disabled={!canRedoTaskAction}
              className={toolbarButtonClass}
            >
              <RotateCw size={14} />
              Redo
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="h-full min-w-0 basis-1/2">
            <DailyView />
          </div>
          <div className="h-full min-w-0 basis-1/2">
            <CollectionsPanel />
          </div>
        </div>
      </div>
    </main>
  )
}

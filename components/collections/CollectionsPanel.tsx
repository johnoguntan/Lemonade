"use client"

import { useEffect, useMemo, useState } from "react"
import { CollectionsEditor, type EditableCollection } from "@/components/collections/CollectionsEditor"
import { DateCollection } from "@/components/collections/DateCollection"
import { PresetSwitcher } from "@/components/collections/PresetSwitcher"
import { TagCollection } from "@/components/collections/TagCollection"
import { useAllsenadroStore } from "@/lib/allsenadro-store"
import type { Collection } from "@/lib/types"
import { formatLocalDateKey, useLemonadeStore, type Label, type Todo } from "@/lib/store"

type DailySectionKey = "urgent" | "schedule" | "allday"

type CollectionTodo = Todo & {
  section?: DailySectionKey
  rollover?: boolean
  dismissed?: boolean
}

type TagLikeCollection = Collection & {
  tag?: string | null
}

const LOCAL_COLLECTIONS_KEY = "allsenadro-right-column-collections-v1"

const normalizeName = (value: string) => value.trim().toLowerCase()

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function CollectionsPanel() {
  const presets = useAllsenadroStore((state) => state.presets)
  const activePresetId = useAllsenadroStore((state) => state.activePresetId)
  const setActivePreset = useAllsenadroStore((state) => state.setActivePreset)
  const fetchPresets = useAllsenadroStore((state) => state.fetchPresets)
  const userId = useAllsenadroStore((state) => state.userId)

  const calendarTodos = useLemonadeStore((state) => state.calendarTodos) as CollectionTodo[]
  const labels = useLemonadeStore((state) => state.labels) as Label[]

  useEffect(() => {
    if (!userId) {
      return
    }

    if (presets.length > 0) {
      return
    }

    void fetchPresets()
  }, [fetchPresets, presets.length, userId])

  const usablePresets = useMemo(() => presets.filter((preset) => preset.collections.length > 0), [presets])
  const resolvedActivePresetId = activePresetId || usablePresets[0]?.id || ""
  const activePreset = usablePresets.find((preset) => preset.id === resolvedActivePresetId) ?? null

  const visibleTodos = useMemo(
    () =>
      calendarTodos.filter((todo) => {
        if (todo.completed || todo.dismissed || todo.isHeading || typeof todo.date !== "string") {
          return false
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayKey = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`

        return todo.date >= todayKey
      }),
    [calendarTodos]
  )

  const labelsById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels])

  const fallbackCollections = useMemo<EditableCollection[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = addDays(today, 1)
    const nextWeekStart = addDays(today, 7)
    const nextWeekEnd = addDays(today, 13)
    const nextMonthStart = addDays(today, 30)
    const nextMonthEnd = addDays(today, 59)
    const nextYearStart = addDays(today, 365)
    const nextYearEnd = addDays(today, 729)

    return [
      {
        id: "fallback-tomorrow",
        user_id: "local",
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
        id: "fallback-next-week",
        user_id: "local",
        name: "Next Week",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(nextWeekStart),
        fixed_end_date: formatLocalDateKey(nextWeekEnd),
        is_default: true,
        sort_order: 1,
        created_at: "",
        updated_at: "",
      },
      {
        id: "fallback-next-month",
        user_id: "local",
        name: "Next Month",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(nextMonthStart),
        fixed_end_date: formatLocalDateKey(nextMonthEnd),
        is_default: true,
        sort_order: 2,
        created_at: "",
        updated_at: "",
      },
      {
        id: "fallback-next-year",
        user_id: "local",
        name: "Next Year",
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatLocalDateKey(nextYearStart),
        fixed_end_date: formatLocalDateKey(nextYearEnd),
        is_default: true,
        sort_order: 3,
        created_at: "",
        updated_at: "",
      },
      {
        id: "fallback-whenever",
        user_id: "local",
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
        tag: "Whenever",
      },
    ]
  }, [])

  const [localCollections, setLocalCollections] = useState<EditableCollection[]>(fallbackCollections)
  const [localCollectionsHydrated, setLocalCollectionsHydrated] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCAL_COLLECTIONS_KEY)
    if (!stored) {
      setLocalCollections(fallbackCollections)
      setLocalCollectionsHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(stored) as EditableCollection[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setLocalCollections(parsed)
        setLocalCollectionsHydrated(true)
        return
      }
    } catch {
      // Ignore invalid local data and fall back to defaults.
    }

    setLocalCollections(fallbackCollections)
    setLocalCollectionsHydrated(true)
  }, [fallbackCollections])

  useEffect(() => {
    if (!localCollectionsHydrated) return
    window.localStorage.setItem(LOCAL_COLLECTIONS_KEY, JSON.stringify(localCollections))
  }, [localCollections, localCollectionsHydrated])

  const getTodosForCollection = (collection: Collection) => {
    if (collection.type === "date-based") {
      return visibleTodos.filter((todo) => typeof todo.date === "string")
    }

    const targetName = normalizeName(((collection as TagLikeCollection).tag || collection.name) ?? collection.name)
    if (!targetName) {
      return []
    }

    return visibleTodos.filter((todo) =>
      todo.labelIds.some((labelId) => normalizeName(labelsById.get(labelId)?.name ?? "") === targetName)
    )
  }

  const collectionsToRender = activePreset?.collections.length
    ? activePreset.collections
    : localCollections

  const availableTagNames = useMemo(
    () => Array.from(new Set(labels.map((label) => label.name).filter(Boolean))),
    [labels]
  )

  return (
    <aside className="h-full w-full overflow-y-auto border-l border-black/10 bg-[#f7f7f4]">
      <div className="flex items-center justify-between gap-3 px-8 pt-5">
        {activePreset && usablePresets.length > 1 ? (
          <PresetSwitcher
            presets={usablePresets}
            activePresetId={resolvedActivePresetId}
            onSwitch={setActivePreset}
          />
        ) : (
          <div />
        )}

        {!activePreset ? (
          <CollectionsEditor
            collections={localCollections}
            availableTagNames={availableTagNames}
            onChange={setLocalCollections}
          />
        ) : null}
      </div>

      <div className={activePreset && usablePresets.length > 1 ? "mt-4" : "pt-1"}>
        {collectionsToRender.map((collection) => {
          const todos = getTodosForCollection(collection)

          if (collection.type === "date-based") {
            return <DateCollection key={collection.id} collection={collection} todos={todos} />
          }

          return <TagCollection key={collection.id} collection={collection} todos={todos} />
        })}
      </div>
    </aside>
  )
}

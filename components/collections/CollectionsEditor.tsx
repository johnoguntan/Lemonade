"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import type { Collection, CollectionType } from "@/lib/types"

export type EditableCollection = Collection & {
  tag?: string | null
}

type DateTemplate = "tomorrow" | "next_week" | "next_month" | "next_year"

type CollectionsEditorProps = {
  collections: EditableCollection[]
  availableTagNames: string[]
  onChange: (collections: EditableCollection[]) => void
}

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

const formatDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const createDateCollection = (name: string, template: DateTemplate): EditableCollection => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let start = addDays(today, 1)
  let end = start

  if (template === "next_week") {
    start = addDays(today, 7)
    end = addDays(start, 6)
  }

  if (template === "next_month") {
    start = addDays(today, 30)
    end = addDays(start, 29)
  }

  if (template === "next_year") {
    start = addDays(today, 365)
    end = addDays(start, 364)
  }

  return {
    id: `local-collection-${globalThis.crypto.randomUUID()}`,
    user_id: "local",
    name,
    type: "date-based",
    color: null,
    date_range_type: "fixed",
    dynamic_range: null,
    fixed_start_date: formatDateKey(start),
    fixed_end_date: formatDateKey(end),
    is_default: false,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  }
}

const createTagCollection = (name: string): EditableCollection => ({
  id: `local-collection-${globalThis.crypto.randomUUID()}`,
  user_id: "local",
  name,
  type: "tag-based",
  color: null,
  date_range_type: null,
  dynamic_range: null,
  fixed_start_date: null,
  fixed_end_date: null,
  is_default: false,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  tag: name,
})

export function CollectionsEditor({ collections, availableTagNames, onChange }: CollectionsEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [draftType, setDraftType] = useState<CollectionType>("tag-based")
  const [dateTemplate, setDateTemplate] = useState<DateTemplate>("tomorrow")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [isOpen])

  const suggestions = useMemo(
    () => availableTagNames.filter((name) => !collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase())).slice(0, 6),
    [availableTagNames, collections]
  )

  const applyCollections = (nextCollections: EditableCollection[]) => {
    onChange(
      nextCollections.map((collection, index) => ({
        ...collection,
        sort_order: index,
      }))
    )
  }

  const handleAdd = () => {
    const trimmed = draftName.trim()
    if (!trimmed) return

    const nextCollection =
      draftType === "date-based"
        ? createDateCollection(trimmed, dateTemplate)
        : createTagCollection(trimmed)

    applyCollections([...collections, nextCollection])
    setDraftName("")
  }

  const moveCollection = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= collections.length) return

    const nextCollections = [...collections]
    const [item] = nextCollections.splice(index, 1)
    nextCollections.splice(targetIndex, 0, item)
    applyCollections(nextCollections)
  }

  const moveCollectionById = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return

    const nextCollections = [...collections]
    const sourceIndex = nextCollections.findIndex((collection) => collection.id === sourceId)
    const targetIndex = nextCollections.findIndex((collection) => collection.id === targetId)

    if (sourceIndex < 0 || targetIndex < 0) return

    const [dragged] = nextCollections.splice(sourceIndex, 1)
    nextCollections.splice(targetIndex, 0, dragged)
    applyCollections(nextCollections)
  }

  const updateCollectionName = (id: string, name: string) => {
    applyCollections(
      collections.map((collection) =>
        collection.id === id
          ? {
              ...collection,
              name,
              ...(collection.type === "tag-based" ? { tag: name } : {}),
            }
          : collection
      )
    )
  }

  const removeCollection = (id: string) => {
    applyCollections(collections.filter((collection) => collection.id !== id))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-black/60 transition hover:border-black/20 hover:text-black"
      >
        Edit Collections
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-30 mt-3 w-[340px] rounded-[24px] border border-black/10 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] uppercase tracking-[0.16em] text-black/50">Right Column</h3>
            <button type="button" onClick={() => setIsOpen(false)} className="text-black/40 transition hover:text-black">
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {collections.map((collection, index) => (
              <div
                key={collection.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", collection.id)
                  setDraggedId(collection.id)
                  setDragOverId(collection.id)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (dragOverId !== collection.id) {
                    setDragOverId(collection.id)
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggedId) {
                    moveCollectionById(draggedId, collection.id)
                  }
                  setDraggedId(null)
                  setDragOverId(null)
                }}
                onDragEnd={() => {
                  setDraggedId(null)
                  setDragOverId(null)
                }}
                className={[
                  "rounded-2xl border bg-[#fbfaf7] px-3 py-3 transition",
                  draggedId === collection.id ? "cursor-grabbing opacity-55" : "cursor-grab",
                  dragOverId === collection.id ? "border-black/25 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" : "border-black/8",
                ].join(" ")}
              >
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="pt-1 text-[12px] tracking-[0.18em] text-black/25">:::</span>
                    <input
                      value={collection.name}
                      onChange={(event) => updateCollectionName(collection.id, event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-black outline-none"
                    />
                  </div>
                  <button type="button" onClick={() => moveCollection(index, -1)} className="text-black/35 transition hover:text-black">
                    <ChevronUp size={15} />
                  </button>
                  <button type="button" onClick={() => moveCollection(index, 1)} className="text-black/35 transition hover:text-black">
                    <ChevronDown size={15} />
                  </button>
                  <button type="button" onClick={() => removeCollection(collection.id)} className="text-black/35 transition hover:text-black">
                    <X size={15} />
                  </button>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-black/40">
                  {collection.type === "date-based" ? "Date Range" : "Tag Collection"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-black/8 pt-4">
            <div className="flex items-center gap-2">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="New collection name"
                className="h-10 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 text-[13px] text-black outline-none placeholder:text-black/35"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition hover:bg-[#222]"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDraftType("tag-based")}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                  draftType === "tag-based" ? "border-black bg-black text-white" : "border-black/10 text-black/55",
                ].join(" ")}
              >
                Tag
              </button>
              <button
                type="button"
                onClick={() => setDraftType("date-based")}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                  draftType === "date-based" ? "border-black bg-black text-white" : "border-black/10 text-black/55",
                ].join(" ")}
              >
                Date
              </button>
            </div>

            {draftType === "date-based" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["tomorrow", "Tomorrow"],
                  ["next_week", "Next Week"],
                  ["next_month", "Next Month"],
                  ["next_year", "Next Year"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDateTemplate(value as DateTemplate)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                      dateTemplate === value ? "border-black bg-black text-white" : "border-black/10 text-black/55",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setDraftName(suggestion)}
                    className="rounded-full border border-black/10 bg-[#eef4ff] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-black/65 transition hover:border-black/20 hover:text-black"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

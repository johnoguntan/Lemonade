"use client"

import { create } from "zustand"
import type { EditableCollection } from "@/components/collections/CollectionsEditor"

// Shared source of truth for the right-column collections. Both the
// CollectionsPanel (which renders + edits them) and the task-add PriorityDropdown
// (which can create a new collection on the fly) read/write this store so a
// collection created while adding a task shows up immediately in the panel.
export const LOCAL_COLLECTIONS_KEY = "allsenadro-right-column-collections-v1"

const persist = (collections: EditableCollection[]) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOCAL_COLLECTIONS_KEY, JSON.stringify(collections))
  } catch {
    // Ignore quota / serialization failures — the in-memory list still works.
  }
}

const normalizeName = (value: string) => value.trim().toLowerCase()

const createTagCollection = (name: string, sortOrder: number): EditableCollection => ({
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
  sort_order: sortOrder,
  created_at: "",
  updated_at: "",
  tag: name,
})

type RightColumnCollectionsState = {
  collections: EditableCollection[]
  hydrated: boolean
  // Seed the store once from the panel's migrated + date-computed defaults.
  hydrate: (initial: EditableCollection[]) => void
  // Replace the whole list (used by the editor) — persists to localStorage.
  setCollections: (next: EditableCollection[]) => void
  // Create a tag-based collection if one with this name doesn't already exist.
  // Returns the new or existing collection.
  addTagCollection: (name: string) => EditableCollection | null
}

export const useRightColumnCollections = create<RightColumnCollectionsState>((set, get) => ({
  collections: [],
  hydrated: false,
  hydrate: (initial) => {
    if (get().hydrated) return
    set({ collections: initial, hydrated: true })
  },
  setCollections: (next) => {
    set({ collections: next })
    persist(next)
  },
  addTagCollection: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return null

    const existing = get().collections.find(
      (collection) => normalizeName(collection.name) === normalizeName(trimmed)
    )
    if (existing) return existing

    const collection = createTagCollection(trimmed, get().collections.length)
    const next = [...get().collections, collection]
    set({ collections: next })
    persist(next)
    return collection
  },
}))

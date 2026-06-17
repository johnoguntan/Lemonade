"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRightColumnCollections = exports.LOCAL_COLLECTIONS_KEY = void 0;
const zustand_1 = require("zustand");
// Shared source of truth for the right-column collections. Both the
// CollectionsPanel (which renders + edits them) and the task-add PriorityDropdown
// (which can create a new collection on the fly) read/write this store so a
// collection created while adding a task shows up immediately in the panel.
exports.LOCAL_COLLECTIONS_KEY = "allsenadro-right-column-collections-v1";
const persist = (collections) => {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(exports.LOCAL_COLLECTIONS_KEY, JSON.stringify(collections));
    }
    catch {
        // Ignore quota / serialization failures — the in-memory list still works.
    }
};
const normalizeName = (value) => value.trim().toLowerCase();
const createTagCollection = (name, sortOrder) => ({
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
});
exports.useRightColumnCollections = (0, zustand_1.create)((set, get) => ({
    collections: [],
    hydrated: false,
    hydrate: (initial) => {
        if (get().hydrated)
            return;
        set({ collections: initial, hydrated: true });
    },
    setCollections: (next) => {
        set({ collections: next });
        persist(next);
    },
    addTagCollection: (name) => {
        const trimmed = name.trim();
        if (!trimmed)
            return null;
        const existing = get().collections.find((collection) => normalizeName(collection.name) === normalizeName(trimmed));
        if (existing)
            return existing;
        const collection = createTagCollection(trimmed, get().collections.length);
        const next = [...get().collections, collection];
        set({ collections: next });
        persist(next);
        return collection;
    },
}));

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlarmClock,
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle,
  Clock3,
  Flag,
  Grid2x2,
  Heart,
  Lock,
  Mail,
  MapPin,
  Music,
  Phone,
  ShoppingBag,
  Star,
  Tag,
  Zap,
} from "lucide-react"
import { useAllsenadroStore } from "@/lib/allsenadro-store"
import { useRightColumnCollections } from "@/lib/right-column-collections"
import { ColorPicker } from "@/components/task-creation/ColorPicker"
import type { TaskDraftState, TaskPriority } from "@/components/task-creation/QuickInputBar"

type PriorityDropdownProps = {
  value: TaskDraftState
  onChange: (updates: Partial<TaskDraftState>) => void
}

const defaultCollectionNames = ["Tomorrow", "Next Week", "Next Month", "Next Year", "Whenever"] as const

const priorityOptions: Array<{ key: TaskPriority; label: string; color: string }> = [
  { key: "none", label: "NONE", color: "#8B5CF6" },
  { key: "urgent", label: "URGENT", color: "#EF4444" },
  { key: "high", label: "HIGH", color: "#F97316" },
  { key: "medium", label: "MEDIUM", color: "#EAB308" },
  { key: "low", label: "LOW", color: "#22C55E" },
]

const presetColors = [
  "#f4c27b", "#ec4899", "#7c3aed", "#d946ef", "#3b82f6", "#a1a1aa",
  "#65a30d", "#dbeafe", "#fde047", "#3730a3", "#ea580c", "#39ff14",
]

const iconOptions = [
  AlarmClock, CheckCircle, Calendar, Lock, Clock3, Grid2x2, Star,
  Heart, Zap, Flag, Bookmark, Tag, Bell, MapPin, Phone, Mail,
  Camera, Music, ShoppingBag, Briefcase,
]

export function PriorityDropdown({ value, onChange }: PriorityDropdownProps) {
  const collections = useAllsenadroStore((state) => state.collections)
  const presets = useAllsenadroStore((state) => state.presets)
  const activePresetId = useAllsenadroStore((state) => state.activePresetId)
  const rightColumnCollections = useRightColumnCollections((state) => state.collections)
  const addTagCollection = useRightColumnCollections((state) => state.addTagCollection)
  const [query, setQuery] = useState("")
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerButtonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      // The color picker is portaled to <body>, so a click on the wheel is
      // technically outside this panel — don't treat that as "click away".
      if (target?.closest?.(".color-picker-panel")) return
      if (!panelRef.current?.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [])

  const existingNames = useMemo(() => {
    const names = new Set<string>()

    defaultCollectionNames.forEach((name) => {
      names.add(name)
    })

    collections.forEach((collection) => {
      if (collection.name.trim()) {
        names.add(collection.name.trim())
      }
    })

    // Collections saved to the right column (including ones created here) so they
    // surface as suggestions next time.
    rightColumnCollections.forEach((collection) => {
      if (collection.name.trim()) {
        names.add(collection.name.trim())
      }
    })

    const usablePresets = presets.filter((preset) => preset.collections.length > 0)
    const activePreset =
      usablePresets.find((preset) => preset.id === activePresetId) ??
      usablePresets[0] ??
      null

    if (activePreset?.name.trim()) {
      names.add(activePreset.name.trim())
    }

    if (activePreset) {
      activePreset.collections.forEach((collection) => {
        if (collection.name.trim()) {
          names.add(collection.name.trim())
        }
      })
    }

    return Array.from(names)
  }, [activePresetId, collections, presets, rightColumnCollections])
  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      return existingNames.slice(0, 8)
    }

    return [...existingNames]
      .sort((left, right) => {
        const leftStarts = left.toLowerCase().startsWith(trimmed) ? 0 : 1
        const rightStarts = right.toLowerCase().startsWith(trimmed) ? 0 : 1
        if (leftStarts !== rightStarts) return leftStarts - rightStarts
        return left.localeCompare(right)
      })
      .filter((name) => name.toLowerCase().includes(trimmed))
      .slice(0, 8)
  }, [existingNames, query])

  const addCollectionSelection = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    if (!value.collections.includes(trimmed)) {
      onChange({ collections: [...value.collections, trimmed] })
    }

    // Persist as a real, saved tag collection so it appears in the right-column
    // collections view. addTagCollection is a no-op when one already exists.
    addTagCollection(trimmed)

    setQuery("")
  }

  return (
    <div ref={panelRef} className="relative w-[380px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
      <div>
        <h3 className="mb-3 text-base text-gray-900">Priority</h3>
        <div className="grid grid-cols-2 gap-2">
          {priorityOptions.map((option) => {
            const active = value.priority === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onChange({ priority: option.key })}
                className="rounded-full px-4 py-1.5 text-xs font-bold transition"
                style={{
                  backgroundColor: active ? option.color : "transparent",
                  color: active ? "#fff" : option.color,
                  border: `2px solid ${option.color}`,
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="mb-2 flex items-center justify-between text-base text-gray-900">
          <span>Add to Collection</span>
          <span className="text-gray-300">+</span>
        </div>

        {value.collections.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {value.collections.map((collection, index) => (
              <button
                key={`${collection}-${index}`}
                type="button"
                onClick={() => onChange({ collections: value.collections.filter((item) => item !== collection) })}
                className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {collection} ×
              </button>
            ))}
          </div>
        ) : null}

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type collection name"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion}-${index}`}
              type="button"
              onClick={() => void addCollectionSelection(suggestion)}
              className="rounded-full bg-[#dfeafe] px-3 py-1 text-sm text-gray-800"
            >
              #{suggestion}
            </button>
          ))}
          {query.trim() && !existingNames.some((name) => name.toLowerCase() === query.trim().toLowerCase()) ? (
            <button
              type="button"
              onClick={() => void addCollectionSelection(query)}
              className="rounded-full bg-[#dfeafe] px-3 py-1 text-sm text-gray-800"
            >
              Create "{query.trim()}"
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <h3 className="mb-3 text-base text-gray-900">Color</h3>
        <div className="flex flex-wrap gap-3">
          {presetColors.map((color, index) => {
            const active = value.color === color
            return (
              <button
                key={`${color}-${index}`}
                type="button"
                onClick={() => onChange({ color })}
                className={["h-6 w-6 rounded-full transition", active ? "ring-2 ring-black ring-offset-2" : ""].join(" ")}
                style={{ backgroundColor: color }}
              />
            )
          })}
          <button
            type="button"
            ref={colorPickerButtonRef}
            onClick={() => setShowColorPicker((current) => !current)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#f43f5e,#f59e0b,#eab308,#22c55e,#3b82f6,#8b5cf6,#f43f5e)]"
          >
            <span className="h-3 w-3 rounded-full bg-white/75" />
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <h3 className="mb-3 text-base text-gray-900">Icon</h3>
        <div className="grid grid-cols-7 gap-2">
          {iconOptions.map((Icon, index) => {
            // lucide components are forwardRef objects whose `.name` is undefined;
            // `.displayName` ("Star", "AlarmClock", …) is the stable identifier.
            const iconName = Icon.displayName ?? ""
            const active = value.icon === iconName
            return (
              <button
                key={`${iconName || "icon"}-${index}`}
                type="button"
                onClick={() => onChange({ icon: iconName })}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full transition",
                  active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100",
                ].join(" ")}
              >
                <Icon size={17} />
              </button>
            )
          })}
        </div>
      </div>

      {showColorPicker ? (
        <ColorPicker
          value={value.color}
          onChange={(color) => onChange({ color })}
          onClose={() => setShowColorPicker(false)}
          anchorRef={colorPickerButtonRef}
        />
      ) : null}
    </div>
  )
}

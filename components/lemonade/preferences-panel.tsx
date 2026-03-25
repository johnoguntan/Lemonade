"use client"

import { useLemonadeStore, type BulletStyle } from "@/lib/store"
import { Switch } from "@/components/ui/switch"
import { Sun, Moon, Eye, EyeOff, Circle, Minus, ArrowRight, Ban, ChevronsLeft, Plus, Pencil, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

const THEME_COLORS = [
  { label: 'purple', hex: '#852CE6' },
  { label: 'red', hex: '#E63946' },
  { label: 'orange', hex: '#F47B20' },
  { label: 'yellow', hex: '#F4C430' },
  { label: 'green', hex: '#2D9B6F' },
  { label: 'teal', hex: '#0D9488' },
  { label: 'blue', hex: '#2563EB' },
  { label: 'pink', hex: '#EC4899' },
  { label: 'black', hex: '#1A1A1A' },
]

const TIMELINE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const suffix = hour >= 12 ? "PM" : "AM"
  const normalized = hour % 12 === 0 ? 12 : hour % 12
  return {
    label: `${normalized}:00 ${suffix}`,
    value: hour,
  }
})

export function PreferencesPanel() {
  const {
    preferences,
    setPreferences,
    setSidebarOpen,
    sidebarOpen,
    labels,
    addLabel,
    editLabel,
    deleteLabel,
    labelFilterIds,
    toggleLabelFilter,
    clearLabelFilters,
  } = useLemonadeStore()
  const { setTheme } = useTheme()
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#852CE6")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState("")
  const [editTagColor, setEditTagColor] = useState("")
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const newTagInputRef = useRef<HTMLInputElement>(null)

  const handleAddTag = () => {
    if (newTagName.trim()) {
      addLabel(newTagName.trim(), newTagColor)
      setNewTagName("")
      setIsCreatingTag(false)
    }
  }

  const handleEditTag = (id: string) => {
    if (editTagName.trim()) {
      editLabel(id, editTagName.trim(), editTagColor)
      setEditingTagId(null)
    }
  }

  const handleThemeChange = (theme: 'light' | 'dark') => {
    setPreferences({ theme })
    setTheme(theme)
  }

  const handleStartCreatingTag = (color: string) => {
    setNewTagColor(color)
    setIsCreatingTag(true)
    requestAnimationFrame(() => {
      newTagInputRef.current?.focus()
    })
  }

  return (
    <div className={cn(
      "lemonade-sidebar fixed inset-y-0 left-0 w-72 bg-[#1a1a1a] text-white z-50 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl",
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="lemonade-sidebar-content p-6 flex-1 overflow-y-auto">
          <h2 className="text-base font-normal text-gray-400 mb-8 mt-2">Preferences</h2>

          {/* 1. Accent color */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2.5">
              {THEME_COLORS.map(({ hex }) => (
                <button
                  key={hex}
                  onClick={() => setPreferences({ accentColor: hex })}
                  className={cn(
                    "size-6 rounded-full transition-all border-2 border-transparent hover:scale-110",
                    preferences.accentColor === hex && "ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]"
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          {/* 2. Days in view */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Days in view</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5">
              {([1, 3, 5, 7] as const).map((num) => (
                <button
                  key={num}
                  onClick={() => setPreferences({ columns: num })}
                  className={cn(
                    "px-3 py-1 text-xs rounded transition-colors",
                    preferences.columns === num ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  )}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Text size */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Text size</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5">
              {([
                { label: 'S', value: 'sm' as const },
                { label: 'M', value: 'md' as const },
                { label: 'L', value: 'lg' as const },
              ]).map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setPreferences({ textSize: value })}
                  className={cn(
                    "px-3 py-1 text-xs rounded transition-colors",
                    preferences.textSize === value ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Spacing */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Spacing</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5">
              {([
                { label: 'S', value: 'compact' as const },
                { label: 'M', value: 'normal' as const },
                { label: 'L', value: 'comfortable' as const },
              ]).map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setPreferences({ spacing: value })}
                  className={cn(
                    "px-3 py-1 text-xs rounded transition-colors",
                    preferences.spacing === value ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-normal text-gray-300">Timeline hours</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">Start</span>
                <select
                  value={preferences.timelineStartHour}
                  onChange={(event) => setPreferences({ timelineStartHour: Number(event.target.value) })}
                  className="h-9 w-full rounded border border-gray-700 bg-[#2a2a2a] px-3 text-xs text-gray-200 outline-none transition-colors focus:border-[var(--accent-color)]"
                >
                  {TIMELINE_HOUR_OPTIONS.map((option) => (
                    <option key={`timeline-start-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">End</span>
                <select
                  value={preferences.timelineEndHour}
                  onChange={(event) => setPreferences({ timelineEndHour: Number(event.target.value) })}
                  className="h-9 w-full rounded border border-gray-700 bg-[#2a2a2a] px-3 text-xs text-gray-200 outline-none transition-colors focus:border-[var(--accent-color)]"
                >
                  {TIMELINE_HOUR_OPTIONS.map((option) => (
                    <option key={`timeline-end-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* 5. Completed todos */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Completed todos</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5 gap-0.5">
              <button
                onClick={() => setPreferences({ showCompleted: true })}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  preferences.showCompleted ? "bg-white text-black" : "text-gray-400 hover:text-white"
                )}
              >
                <Eye className="size-4" />
              </button>
              <button
                onClick={() => setPreferences({ showCompleted: false })}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  !preferences.showCompleted ? "bg-white text-black" : "text-gray-400 hover:text-white"
                )}
              >
                <EyeOff className="size-4" />
              </button>
            </div>
          </div>

          {/* 6. Bullet style */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Bullet style</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5 gap-0.5">
              {[
                { style: 'none' as BulletStyle, icon: Ban },
                { style: 'dot' as BulletStyle, icon: Circle },
                { style: 'dash' as BulletStyle, icon: Minus },
                { style: 'arrow' as BulletStyle, icon: ArrowRight },
              ].map(({ style, icon: Icon }) => (
                <button
                  key={style}
                  onClick={() => setPreferences({ bulletStyle: style })}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    preferences.bulletStyle === style ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          {/* 7. Start on */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Start on</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5">
              <button
                onClick={() => setPreferences({ startOnYesterday: false })}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  !preferences.startOnYesterday ? "bg-white text-black" : "text-gray-400 hover:text-white"
                )}
              >
                Today
              </button>
              <button
                onClick={() => setPreferences({ startOnYesterday: true })}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  preferences.startOnYesterday ? "bg-white text-black" : "text-gray-400 hover:text-white"
                )}
              >
                Yesterday
              </button>
            </div>
          </div>

          {/* 8. Display */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Display</label>
            <div className="flex bg-[#2a2a2a] rounded p-0.5 gap-0.5">
              <button
                onClick={() => handleThemeChange('light')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors",
                  preferences.theme === 'light' ? "bg-white text-black" : "text-gray-400 hover:text-white"
                )}
              >
                <Sun className="size-3.5" /> Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors",
                  preferences.theme === 'dark' ? "bg-white text-black" : "text-gray-400 hover:text-white"
                )}
              >
                <Moon className="size-3.5" /> Dark
              </button>
            </div>
          </div>

          {/* 10. Celebrations */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Celebrations</label>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500 font-medium">OFF</span>
              <Switch
                checked={preferences.showCelebrations}
                onCheckedChange={(checked) => setPreferences({ showCelebrations: checked })}
                className="data-[state=checked]:bg-[var(--accent-color)] scale-75"
              />
              <span className="text-[10px] text-gray-500 font-medium">ON</span>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Dot grid background</label>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500 font-medium">OFF</span>
              <Switch
                checked={preferences.showDotGridBackground}
                onCheckedChange={(checked) => setPreferences({ showDotGridBackground: checked })}
                className="data-[state=checked]:bg-[var(--accent-color)] scale-75"
              />
              <span className="text-[10px] text-gray-500 font-medium">ON</span>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Auto-move undone tasks to today</label>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500 font-medium">OFF</span>
              <Switch
                checked={preferences.autoMoveUndoneToToday}
                onCheckedChange={(checked) => setPreferences({ autoMoveUndoneToToday: checked })}
                className="data-[state=checked]:bg-[var(--accent-color)] scale-75"
              />
              <span className="text-[10px] text-gray-500 font-medium">ON</span>
            </div>
          </div>

          <Separator className="bg-gray-800 my-6" />

          {/* Labels Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Labels</h3>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Default label</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setPreferences({ defaultLabelId: null })}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    preferences.defaultLabelId === null
                      ? "border-transparent bg-white text-black"
                      : "border-gray-700 text-gray-300 hover:text-white"
                  )}
                >
                  None
                </button>
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => setPreferences({ defaultLabelId: label.id })}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                      preferences.defaultLabelId === label.id
                        ? "border-transparent text-white"
                        : "border-gray-700 text-gray-300 hover:text-white"
                    )}
                    style={preferences.defaultLabelId === label.id ? { backgroundColor: label.color } : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                    <span>{label.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Filter labels</span>
                {labelFilterIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => clearLabelFilters()}
                    className="text-[10px] text-gray-500 hover:text-white"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabelFilter(label.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] transition-colors",
                      labelFilterIds.includes(label.id)
                        ? "border-transparent text-white"
                        : "border-gray-700 text-gray-300 hover:text-white"
                    )}
                    style={labelFilterIds.includes(label.id) ? { backgroundColor: label.color } : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                    <span>{label.name}</span>
                    {labelFilterIds.includes(label.id) ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleLabelFilter(label.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            event.stopPropagation()
                            toggleLabelFilter(label.id)
                          }
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-black/10 p-0.5 text-white/90"
                        aria-label={`Remove ${label.name} filter`}
                      >
                        <X className="size-2.5" />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Label List */}
            <div className="space-y-2 mb-4">
              {labels.map((label) => (
                <div key={label.id} className="flex items-center justify-between group/tag">
                  {editingTagId === label.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 flex items-center bg-[#2a2a2a] rounded px-2 gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="size-3 rounded-full shrink-0" style={{ backgroundColor: editTagColor }} />
                          </PopoverTrigger>
                          <PopoverContent className="w-40 bg-[#2a2a2a] border-gray-700 p-2">
                            <div className="grid grid-cols-4 gap-2">
                              {THEME_COLORS.map(c => (
                                <button
                                  key={c.hex}
                                  className="size-6 rounded-full"
                                  style={{ backgroundColor: c.hex }}
                                  onClick={() => setEditTagColor(c.hex)}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Input
                          value={editTagName}
                          onChange={(e) => setEditTagName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditTag(label.id)}
                          className="h-7 text-xs bg-transparent border-none focus-visible:ring-0 text-white p-0"
                          autoFocus
                        />
                      </div>
                      <button onClick={() => handleEditTag(label.id)} className="text-gray-400 hover:text-white">
                        <Plus className="size-4 rotate-45" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                        <span className="text-xs text-gray-300">{label.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/tag:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingTagId(label.id)
                            setEditTagName(label.name)
                            setEditTagColor(label.color)
                          }}
                          className="p-1 text-gray-500 hover:text-white"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button onClick={() => deleteLabel(label.id)} className="p-1 text-gray-500 hover:text-red-400">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add Label */}
            <div className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Create label</span>
                  {isCreatingTag ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingTag(false)
                        setNewTagName("")
                      }}
                      className="text-[10px] text-gray-500 hover:text-white"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => handleStartCreatingTag(color.hex)}
                      className={cn(
                        "size-6 rounded-full border transition-transform hover:scale-105",
                        isCreatingTag && newTagColor === color.hex ? "border-white ring-1 ring-white/50" : "border-white/10"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={`Create label with ${color.label}`}
                    />
                  ))}
                </div>
              </div>

              {isCreatingTag ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center bg-[#2a2a2a] rounded px-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingTag(false)}
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: newTagColor }}
                      aria-label="Selected label color"
                    />
                    <Input
                      ref={newTagInputRef}
                      placeholder="Type label name..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      className="h-8 text-xs bg-transparent border-none focus-visible:ring-0 text-white p-0"
                    />
                  </div>
                  {newTagName.trim() ? (
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="rounded bg-[#2a2a2a] px-2.5 py-2 text-[11px] font-medium text-gray-300 transition-colors hover:bg-[#3a3a3a] hover:text-white"
                    >
                      Save
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom footer close button */}
        <div className="p-4 mt-auto">
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <ChevronsLeft className="size-6" />
          </button>
        </div>
      </div>
  )
}

"use client"

import { useLemonadeStore, type ThemeColor, type BulletStyle } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Sun, Moon, Eye, EyeOff, Circle, Minus, ArrowRight, Ban, ChevronsLeft, Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useState, useRef } from "react"
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

export function PreferencesPanel() {
  const { preferences, setPreferences, setSidebarOpen, sidebarOpen, tags, addTag, editTag, deleteTag } = useLemonadeStore()
  const { setTheme } = useTheme()
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#852CE6")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState("")
  const [editTagColor, setEditTagColor] = useState("")

  const handleAddTag = () => {
    if (newTagName.trim()) {
      addTag(newTagName.trim(), newTagColor)
      setNewTagName("")
    }
  }

  const handleEditTag = (id: string) => {
    if (editTagName.trim()) {
      editTag(id, editTagName.trim(), editTagColor)
      setEditingTagId(null)
    }
  }

  const handleThemeChange = (theme: 'light' | 'dark') => {
    setPreferences({ theme })
    setTheme(theme)
  }

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 w-72 bg-[#1a1a1a] text-white z-50 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl",
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-6 flex-1 overflow-y-auto">
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

          {/* 2. Columns */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Columns</label>
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

          {/* 5. Completed todos */}
          <div className="mb-6 flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Completed todo's</label>
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

          <Separator className="bg-gray-800 my-6" />

          {/* Tags Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Tags</h3>
            
            {/* Tag List */}
            <div className="space-y-2 mb-4">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between group/tag">
                  {editingTagId === tag.id ? (
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
                          onKeyDown={(e) => e.key === 'Enter' && handleEditTag(tag.id)}
                          className="h-7 text-xs bg-transparent border-none focus-visible:ring-0 text-white p-0"
                          autoFocus
                        />
                      </div>
                      <button onClick={() => handleEditTag(tag.id)} className="text-gray-400 hover:text-white">
                        <Plus className="size-4 rotate-45" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="text-xs text-gray-300">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/tag:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingTagId(tag.id)
                            setEditTagName(tag.name)
                            setEditTagColor(tag.color)
                          }}
                          className="p-1 text-gray-500 hover:text-white"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button onClick={() => deleteTag(tag.id)} className="p-1 text-gray-500 hover:text-red-400">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add Tag */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[#2a2a2a] rounded px-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="size-3 rounded-full shrink-0" style={{ backgroundColor: newTagColor }} />
                  </PopoverTrigger>
                  <PopoverContent className="w-40 bg-[#2a2a2a] border-gray-700 p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {THEME_COLORS.map(c => (
                        <button
                          key={c.hex}
                          className="size-6 rounded-full"
                          style={{ backgroundColor: c.hex }}
                          onClick={() => setNewTagColor(c.hex)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  placeholder="New tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  className="h-8 text-xs bg-transparent border-none focus-visible:ring-0 text-white p-0"
                />
              </div>
              <button 
                onClick={handleAddTag}
                className="size-8 flex items-center justify-center bg-[#2a2a2a] rounded hover:bg-[#3a3a3a] text-gray-400 hover:text-white transition-colors"
              >
                <Plus className="size-4" />
              </button>
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

"use client"

import { useLemonadeStore } from "@/lib/store"
import { Switch } from "@/components/ui/switch"
import { Sun, Moon, X, Sparkles, Gift, Zap, Star, Smile, Radio, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ColorPickerPanel } from "./color-picker-panel"

const CELEBRATION_MODES = [
  { id: "burst",    label: "Burst",    Icon: Sparkles },
  { id: "confetti", label: "Confetti", Icon: Gift },
  { id: "firework", label: "Firework", Icon: Zap },
  { id: "stars",    label: "Stars",    Icon: Star },
  { id: "emoji",    label: "Emoji",    Icon: Smile },
  { id: "ripple",   label: "Ripple",   Icon: Radio },
  { id: "minimal",  label: "Minimal",  Icon: Minus },
  { id: "off",      label: "Off",      Icon: X },
] as const

const QUICK_EMOJIS = ["🎉", "🎊", "✨", "🌟", "💫", "🏆", "🎯", "🔥", "💎", "🌈", "🦄", "🚀", "❤️", "🎈", "👏"]

const THEME_COLORS = [
  { label: "purple", hex: "#852CE6" },
  { label: "red", hex: "#E63946" },
  { label: "orange", hex: "#F47B20" },
  { label: "yellow", hex: "#F4C430" },
  { label: "green", hex: "#2D9B6F" },
  { label: "teal", hex: "#0D9488" },
  { label: "blue", hex: "#2563EB" },
  { label: "pink", hex: "#EC4899" },
  { label: "black", hex: "#1A1A1A" },
]

export function PreferencesPanel() {
  const { preferences, setPreferences, setSidebarOpen, sidebarOpen } = useLemonadeStore()
  const { setTheme } = useTheme()
  const [openAccentPicker, setOpenAccentPicker] = useState(false)
  const emojiInputRef = useRef<HTMLInputElement>(null)

  const celebrationMode = preferences.celebrationMode ?? "burst"
  const celebrationEmoji = preferences.celebrationEmoji ?? "🎉"

  const handleThemeChange = (theme: "light" | "dark") => {
    setPreferences({ theme })
    setTheme(theme)
  }

  return (
    <div
      className={cn(
        "lemonade-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#1a1a1a] text-white transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full pointer-events-none shadow-none"
      )}
    >
      <div className="flex items-center justify-between px-6 pb-4 pt-8">
        <div>
          <h2 className="text-base font-normal text-gray-200">Preferences</h2>
          <p className="mt-1 text-xs text-gray-500">Notebook essentials only</p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Close preferences"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 pb-6">
        <section>
          <label className="mb-3 block text-sm font-normal text-gray-300">Accent</label>
          <div className="flex flex-wrap gap-2.5">
            {THEME_COLORS.map(({ hex }) => (
              <button
                key={hex}
                type="button"
                onClick={() => setPreferences({ accentColor: hex })}
                className={cn(
                  "size-6 rounded-full border-2 border-transparent transition-all hover:scale-110",
                  preferences.accentColor === hex && "ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]"
                )}
                style={{ backgroundColor: hex }}
                aria-label={`Use ${hex} as the accent color`}
              />
            ))}

            <Popover open={openAccentPicker} onOpenChange={setOpenAccentPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full border-white/15 bg-white/[0.03] px-3 text-[11px] text-gray-200 hover:bg-white/10"
                >
                  Custom…
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="right"
                sideOffset={10}
                className="z-50 max-h-[70vh] w-[360px] overflow-y-auto border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
              >
                <ColorPickerPanel
                  value={preferences.accentColor}
                  palette={preferences.colorPalette}
                  onChange={(color) => setPreferences({ accentColor: color })}
                  onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                  title="Accent color"
                  description="Pick a color from the wheel or choose a saved swatch."
                />
              </PopoverContent>
            </Popover>
          </div>
        </section>

        <section>
          <label className="mb-3 block text-sm font-normal text-gray-300">Theme</label>
          <div className="flex bg-[#2a2a2a] rounded p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs transition-colors",
                preferences.theme === "light" ? "bg-white text-black" : "text-gray-400 hover:text-white"
              )}
            >
              <Sun className="size-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs transition-colors",
                preferences.theme === "dark" ? "bg-white text-black" : "text-gray-400 hover:text-white"
              )}
            >
              <Moon className="size-3.5" />
              Dark
            </button>
          </div>
        </section>

        <section className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <label className="block text-sm font-normal text-gray-300">Dot grid</label>
            <p className="mt-1 text-[11px] text-gray-500">Show the notebook paper texture.</p>
          </div>
          <Switch
            checked={preferences.showDotGridBackground}
            onCheckedChange={(checked) => setPreferences({ showDotGridBackground: checked })}
          />
        </section>

        {/* Celebrations */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-normal text-gray-300">Celebrations</label>
            <Switch
              checked={preferences.showCelebrations}
              onCheckedChange={(checked) => setPreferences({ showCelebrations: checked })}
            />
          </div>

          {preferences.showCelebrations && (
            <div className="space-y-3">
              {/* Mode grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {CELEBRATION_MODES.map(({ id, label, Icon }) => {
                  const active = celebrationMode === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPreferences({ celebrationMode: id })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] transition-colors",
                        active
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/8 bg-white/[0.03] text-gray-400 hover:bg-white/[0.07] hover:text-gray-200"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Emoji picker — only when emoji mode is active */}
              {celebrationMode === "emoji" && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] text-gray-400">Choose your emoji</p>

                  {/* Quick-pick row */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setPreferences({ celebrationEmoji: emoji })}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg text-base transition-colors",
                          celebrationEmoji === emoji
                            ? "bg-white/20 ring-1 ring-white/40"
                            : "bg-white/5 hover:bg-white/10"
                        )}
                        aria-label={`Use ${emoji} as celebration emoji`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Custom emoji input */}
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl"
                      aria-hidden="true"
                    >
                      {celebrationEmoji}
                    </span>
                    <input
                      ref={emojiInputRef}
                      type="text"
                      value={celebrationEmoji}
                      onChange={(e) => {
                        // Extract the first emoji/character from whatever was typed/pasted
                        const raw = e.target.value
                        // Get grapheme clusters — use Intl.Segmenter when available, else slice
                        let first = raw
                        if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
                          const seg = new (Intl as unknown as { Segmenter: new (locale: string, opts: object) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter("en", { granularity: "grapheme" })
                          const segments = [...seg.segment(raw)]
                          first = segments[0]?.segment ?? raw.slice(0, 2)
                        } else {
                          // Fallback: grab up to 2 code units (covers most emoji)
                          first = [...raw][0] ?? raw
                        }
                        if (first) setPreferences({ celebrationEmoji: first })
                      }}
                      placeholder="Paste any emoji…"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-white/25 focus:outline-none"
                      maxLength={8}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

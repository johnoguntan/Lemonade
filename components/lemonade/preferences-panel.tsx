"use client"

import { useLemonadeStore } from "@/lib/store"
import { Switch } from "@/components/ui/switch"
import { Sun, Moon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

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
      </div>
    </div>
  )
}

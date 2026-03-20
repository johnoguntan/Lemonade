"use client"

import { useLemonadeStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CircleHelp, Moon, RefreshCw, SlidersHorizontal, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"

export function Footer() {
  const { preferences, setPreferences, sidebarOpen, setSidebarOpen } = useLemonadeStore()
  const { setTheme } = useTheme()

  const handleThemeToggle = () => {
    const newTheme = preferences.theme === 'light' ? 'dark' : 'light'
    setPreferences({ theme: newTheme })
    setTheme(newTheme)
  }

  return (
    <footer className="sticky bottom-0 z-30 mt-auto flex h-12 items-center border-t border-border bg-background/95 px-4 backdrop-blur-sm transition-all duration-300">
      <div className="flex min-w-0 flex-1 items-center justify-start gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Toggle sidebar"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          {[1, 3, 5, 7].map((num, index) => (
            <div key={num} className="flex items-center gap-1">
              <Button
                variant={preferences.columns === num ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreferences({ columns: num as 1 | 3 | 5 | 7 })}
                className="h-8 min-w-8 px-2 text-[12px] font-semibold"
              >
                {num}
              </Button>
              {index < 3 && <span className="text-border">|</span>}
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleThemeToggle}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Toggle dark mode"
        >
          {preferences.theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <div className="rounded-md bg-[#2c2c2c] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-white">
          Free Trial 5 Days Left
        </div>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Settings"
        >
          <Link href="/settings">
            <User className="size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Help"
        >
          <CircleHelp className="size-4" />
        </Button>
      </div>
    </footer>
  )
}

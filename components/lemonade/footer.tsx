"use client"

import { useState } from "react"
import { formatLocalDateKey, parseLocalDateKey, useLemonadeStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CircleHelp, Minus, Moon, RefreshCw, SlidersHorizontal, Sun, User, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FooterProps {
  onNavigate?: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
}

export function Footer({ onNavigate }: FooterProps) {
  const {
    preferences,
    setPreferences,
    sidebarOpen,
    setSidebarOpen,
    weekCount,
    incrementWeekCount,
    decrementWeekCount,
    selectedCalendarDate,
    setSelectedCalendarDate,
  } = useLemonadeStore()
  const { setTheme } = useTheme()
  const [showHelp, setShowHelp] = useState(false)
  const currentStartDate = parseLocalDateKey(selectedCalendarDate)

  const handleThemeToggle = () => {
    const newTheme = preferences.theme === 'light' ? 'dark' : 'light'
    setPreferences({ theme: newTheme })
    setTheme(newTheme)
  }

  const handleNavigate = (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => {
    if (onNavigate) {
      onNavigate(direction)
      return
    }

    const newDate = new Date(currentStartDate)
    const dynamicWeekStep = weekCount * 7

    switch (direction) {
      case 'prev-week':
        newDate.setDate(newDate.getDate() - dynamicWeekStep)
        break
      case 'next-week':
        newDate.setDate(newDate.getDate() + dynamicWeekStep)
        break
      case 'prev-day':
        newDate.setDate(newDate.getDate() - 1)
        break
      case 'next-day':
        newDate.setDate(newDate.getDate() + 1)
        break
      case 'today':
        setSelectedCalendarDate(formatLocalDateKey(new Date()))
        return
    }

    setSelectedCalendarDate(formatLocalDateKey(newDate))
  }

  return (
    <footer className="lemonade-footer sticky bottom-0 z-30 mt-auto flex h-12 items-center border-t border-border bg-background/95 px-4 backdrop-blur-sm transition-all duration-300">
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
          onClick={() => window.location.reload()}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate('prev-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Previous range"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={decrementWeekCount}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Show fewer weeks"
          >
            <Minus className="size-4" />
          </Button>
          <span className="min-w-8 text-center text-[12px] font-semibold text-foreground">
            {weekCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={incrementWeekCount}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Show more weeks"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate('next-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Next range"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
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
        <div className="lemonade-footer-badge rounded-md bg-[#2c2c2c] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-white">
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
          onClick={() => setShowHelp(true)}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Help"
        >
          <CircleHelp className="size-4" />
        </Button>
      </div>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-2 font-medium">Keyboard shortcuts</div>
              <ul className="space-y-1 text-muted-foreground">
                <li><span className="font-medium text-foreground">/</span> Open quick add</li>
                <li><span className="font-medium text-foreground">Enter</span> Save a task</li>
                <li><span className="font-medium text-foreground">Esc</span> Cancel task entry</li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-medium">Natural language tips</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>Dates: <span className="text-foreground">today</span>, <span className="text-foreground">tomorrow</span>, <span className="text-foreground">friday</span>, <span className="text-foreground">next friday</span>, <span className="text-foreground">june 5</span></li>
                <li>Priority: <span className="text-foreground">!high</span>, <span className="text-foreground">!medium</span>, <span className="text-foreground">!low</span></li>
                <li>Tags: <span className="text-foreground">#work</span>, <span className="text-foreground">#home</span></li>
                <li>Time: <span className="text-foreground">3pm</span>, <span className="text-foreground">9am</span>, <span className="text-foreground">morning</span>, <span className="text-foreground">evening</span></li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-medium">Recurring syntax</div>
              <ul className="space-y-1 text-muted-foreground">
                <li><span className="text-foreground">every day</span></li>
                <li><span className="text-foreground">every weekday</span></li>
                <li><span className="text-foreground">every monday</span></li>
              </ul>
            </div>

            <div>
              <div className="mb-2 font-medium">Usage tips</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>Drag tasks between day columns to reschedule them.</li>
                <li>Use the color dot in the header to filter highlighted tasks.</li>
                <li>Use the bottom tabs to organize lists and planning pages.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  )
}

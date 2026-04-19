"use client"

import { useEffect, useState } from "react"
import { formatLocalDateKey, parseLocalDateKey, useLemonadeStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarPicker, CircleHelp, ChevronLeft, ChevronRight, Music2, Rows3, Smile, Sun, Moon, User, RotateCcw } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { PrintPreviewDialog } from "./print-preview-dialog"

interface FooterProps {
  onNavigate?: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
  viewMode?: "calendar" | "today"
  onViewModeChange?: (mode: "calendar" | "today") => void
}

export function Footer({ onNavigate, viewMode = "calendar", onViewModeChange }: FooterProps) {
  const {
    preferences,
    setPreferences,
    setSidebarOpen,
    selectedCalendarDate,
    setSelectedCalendarDate,
    calendarTodos,
    canUndoTaskAction,
    canRedoTaskAction,
    undoTaskAction,
    redoTaskAction,
  } = useLemonadeStore()
  useTheme()
  const [showHelp, setShowHelp] = useState(false)
  const [showDatePopover, setShowDatePopover] = useState(false)
  const currentStartDate = parseLocalDateKey(selectedCalendarDate)
  const [pickerMonth, setPickerMonth] = useState(currentStartDate)
  const completedTodayCount = calendarTodos.filter((todo) => todo.date === formatLocalDateKey(new Date()) && todo.completed).length

  const handleNavigate = (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => {
    if (onNavigate) {
      onNavigate(direction)
      return
    }

    const newDate = new Date(currentStartDate)
    const dynamicWeekStep = 7

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return
      }

      const isModifierPressed = event.metaKey || event.ctrlKey
      if (!isModifierPressed || event.key.toLowerCase() !== "z") {
        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        const label = redoTaskAction()
        if (label) {
          toast(`Redid ${label}.`, { duration: 2000 })
        }
        return
      }

      const label = undoTaskAction()
      if (label) {
        toast(`Undid ${label}.`, { duration: 2000 })
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [redoTaskAction, undoTaskAction])

  return (
    <footer className="lemonade-footer sticky bottom-0 z-30 mt-auto flex h-11 items-center rounded-xl border border-border/35 bg-background/45 px-4 backdrop-blur-[14px] transition-all duration-300 dark:bg-[rgba(19,19,19,0.34)]">
      <div className="flex min-w-0 flex-1 items-center justify-start">
        <div className="flex w-full max-w-[17rem] items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const nextValue = !preferences.showCelebrations
              setPreferences({ showCelebrations: nextValue })
              toast(nextValue ? "Celebrations on" : "Celebrations off", { duration: 2000 })
            }}
            className={cn(
              "size-8 text-muted-foreground hover:text-foreground",
              preferences.showCelebrations && "text-foreground"
            )}
            title="Toggle celebrations"
          >
            <Music2 className="size-4" />
          </Button>
          <span className="h-5 w-px bg-border/70" aria-hidden="true" />

          <Popover
            open={showDatePopover}
            onOpenChange={(open) => {
              setShowDatePopover(open)
              if (open) {
                setPickerMonth(currentStartDate)
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Choose date"
              >
                <CalendarPicker className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={10}
              collisionPadding={12}
              className="z-50 w-auto max-w-[calc(100vw-24px)] rounded-2xl border-0 p-0 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
            >
              <Calendar
                mode="single"
                selected={currentStartDate}
                month={pickerMonth}
                onMonthChange={setPickerMonth}
                onSelect={(date) => {
                  if (!date) {
                    return
                  }
                  setSelectedCalendarDate(formatLocalDateKey(date))
                  setShowDatePopover(false)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="h-5 w-px bg-border/70" aria-hidden="true" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewModeChange?.("calendar")}
            className={cn(
              "size-8 text-muted-foreground hover:text-foreground",
              viewMode === "calendar" && "text-foreground"
            )}
            title="List view"
          >
            <Rows3 className="size-4" />
          </Button>
          <span className="h-5 w-px bg-border/70" aria-hidden="true" />

          <button
            type="button"
            onClick={() => onViewModeChange?.("today")}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#111111] px-2 text-[12px] font-extrabold tracking-[0.01em] text-white transition-transform duration-200 hover:-translate-y-px"
            title="Show today view"
          >
            {completedTodayCount}!
          </button>
          <span className="h-5 w-px bg-border/70" aria-hidden="true" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Personalization"
          >
            <Smile className="size-4" />
          </Button>
        </div>
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
            onClick={() => handleNavigate('next-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Next range"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="h-5 w-px bg-border/70" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          disabled
          className="size-8 text-muted-foreground/40 hover:text-muted-foreground/40"
          title="Dark mode coming soon"
        >
          {preferences.theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
        <span className="h-5 w-px bg-border/70" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const label = undoTaskAction()
            if (label) {
              toast(`Undid ${label}.`, { duration: 2000 })
            }
          }}
          disabled={!canUndoTaskAction}
          className="size-8 text-muted-foreground hover:text-foreground disabled:text-muted-foreground/40"
          title="Undo"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const label = redoTaskAction()
            if (label) {
              toast(`Redid ${label}.`, { duration: 2000 })
            }
          }}
          disabled={!canRedoTaskAction}
          className="size-8 text-muted-foreground hover:text-foreground disabled:text-muted-foreground/40"
          title="Redo"
        >
          <RotateCcw className="size-4 rotate-180" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <PrintPreviewDialog selectedDate={selectedCalendarDate} />
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
                <li>Priority: <span className="text-foreground">urgent</span>, <span className="text-foreground">important</span>, <span className="text-foreground">normal</span>, <span className="text-foreground">p1</span>, <span className="text-foreground">p2</span>, <span className="text-foreground">p3</span></li>
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

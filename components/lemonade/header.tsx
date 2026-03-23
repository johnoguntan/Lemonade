"use client"

import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar as CalendarIcon, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  formatLocalDateKey,
  parseLocalDateKey,
  parseNaturalLanguageTaskInput,
  useLemonadeStore,
  type NaturalLanguagePreviewToken,
} from "@/lib/store"
import { useEffect, useState } from "react"

interface HeaderProps {
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
}

export function Header({ onNavigate }: HeaderProps) {
  const {
    searchQuery,
    setSearchQuery,
    addCalendarTodo,
    ensureTagIds,
    tags,
    calendarTodos,
    preferences,
    activeFilterColor,
    setActiveFilterColor,
    setPreferences,
    selectedCalendarDate,
    setSelectedCalendarDate,
  } = useLemonadeStore()
  const [showSearch, setShowSearch] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddText, setQuickAddText] = useState("")
  const [showColorPopover, setShowColorPopover] = useState(false)
  const [showDatePopover, setShowDatePopover] = useState(false)
  const [newPaletteColor, setNewPaletteColor] = useState("#fef08a")
  const currentDate = parseLocalDateKey(selectedCalendarDate)
  const [pickerMonth, setPickerMonth] = useState(currentDate)

  const parsedQuickAdd = parseNaturalLanguageTaskInput(quickAddText, { tags })
  const palette = preferences.colorPalette ?? []

  const visibleDates = Array.from({ length: preferences.columns }, (_, index) => {
    const date = new Date(currentDate)
    date.setDate(currentDate.getDate() + index)
    return formatLocalDateKey(date)
  })

  const visibleTodos = calendarTodos.filter((todo) => visibleDates.includes(todo.date))
  const colorUsage = visibleTodos.reduce<Record<string, number>>((usage, todo) => {
    if (!todo.color) {
      return usage
    }

    usage[todo.color] = (usage[todo.color] ?? 0) + 1
    return usage
  }, {})
  const usedColors = Object.entries(colorUsage)

  const getColorLabel = (hex: string) => {
    const knownNames: Record<string, string> = {
      "#fef08a": "Yellow",
      "#bbf7d0": "Green",
      "#bfdbfe": "Blue",
      "#fbcfe8": "Pink",
      "#fed7aa": "Orange",
    }

    return knownNames[hex.toLowerCase()] ?? hex.toUpperCase()
  }

  const isTodayVisible = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const startDate = new Date(currentDate)
    startDate.setHours(0, 0, 0, 0)
    
    return today.getTime() === startDate.getTime()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      event.preventDefault()
      setShowSearch(false)
      setShowQuickAdd(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    setPickerMonth(currentDate)
  }, [selectedCalendarDate])

  const handleQuickAddSubmit = () => {
    const parsed = parseNaturalLanguageTaskInput(quickAddText, { tags })
    const tagIds = [...parsed.tagIds, ...ensureTagIds(parsed.newTagNames)]

    if (!parsed.cleanText) {
      setQuickAddText("")
      return
    }

    const today = formatLocalDateKey(new Date())
    const isHeading = parsed.cleanText === parsed.cleanText.toUpperCase() && parsed.cleanText.length > 2

    addCalendarTodo({
      text: parsed.cleanText,
      completed: false,
      date: parsed.scheduledDate ?? today,
      isHeading,
      isRecurring: parsed.recurrence?.isRecurring,
      recurringFrequency: parsed.recurrence?.recurringFrequency,
      recurringDays: parsed.recurrence?.recurringDays,
      priority: parsed.priority,
      tags: tagIds.length > 0 ? tagIds : undefined,
      time: parsed.time,
    })

    setQuickAddText("")
    setShowQuickAdd(false)
  }

  return (
    <header
      className="flex items-center justify-between border-t-2 bg-background px-4 py-3 dark:bg-[#131313]"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div className="flex flex-1 items-center gap-2">
        {showQuickAdd ? (
          <div className="flex w-full flex-col bg-[#f7f8fa] px-4 py-2 text-muted-foreground dark:bg-[#131313]">
            <div className="flex h-10 items-center gap-3">
              <Plus className="size-[15px] shrink-0" />
              <Input
                placeholder="Add a task"
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleQuickAddSubmit()
                  } else if (event.key === "Escape") {
                    setShowQuickAdd(false)
                    setQuickAddText("")
                  }
                }}
                className="h-auto border-0 bg-transparent px-0 py-0 text-[12px] text-foreground shadow-none focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowQuickAdd(false)
                  setQuickAddText("")
                }}
                className="ml-auto size-7 text-muted-foreground hover:text-foreground"
              >
                <span className="text-[18px] leading-none">×</span>
              </Button>
            </div>
            <TokenPreviewBar tokens={parsedQuickAdd.previewTokens} />
          </div>
        ) : showSearch ? (
          <div className="flex h-10 w-full items-center gap-3 bg-[#f7f8fa] px-4 text-muted-foreground">
            <Search className="size-[15px] shrink-0" />
            <Input
              placeholder="Search for a to-do"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 text-[12px] text-foreground shadow-none focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(false)}
              className="ml-auto size-7 text-muted-foreground hover:text-foreground"
            >
              <span className="text-[18px] leading-none">×</span>
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowQuickAdd(false)
                setShowSearch(true)
              }}
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <Search className="size-[15px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowSearch(false)
                setShowQuickAdd(true)
              }}
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-[15px]" />
            </Button>
            {!isTodayVisible() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('today')}
                className="h-8 px-3 text-[12px] font-medium bg-[#f5f5f5] border-transparent text-black transition-colors hover:bg-black hover:text-white dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white"
              >
                TODAY
              </Button>
            )}
          </>
        )}
      </div>

      {!showSearch && !showQuickAdd ? (
        <div 
          style={{ 
            fontFamily: '"Alternate Gothic No2 D", "Arial Narrow", "Roboto Condensed", sans-serif',
            fontStyle: 'normal',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '16px',
            color: 'var(--accent-color)'
          }}
          className="font-logo uppercase"
        >
          LEMONADE<span style={{ color: 'var(--accent-color)' }}>*</span>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {!showSearch && !showQuickAdd ? (
        <div className="flex flex-1 items-center justify-end gap-1">
          <Popover open={showColorPopover} onOpenChange={setShowColorPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 size-8 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Open task color filter"
              >
                <span
                  className="size-3 rounded-full border border-black/5 dark:border-white/10"
                  style={{ backgroundColor: activeFilterColor ?? preferences.accentColor }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={10}
              className="w-[260px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
            >
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Current Usage
                  </div>
                  {usedColors.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground">No colors used yet</div>
                  ) : (
                    <div className="space-y-1">
                      {usedColors.map(([hex, count]) => {
                        const isActive = activeFilterColor === hex

                        return (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => {
                              setActiveFilterColor(isActive ? null : hex)
                              setShowColorPopover(false)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-muted"
                          >
                            <span
                              className="size-3 rounded-full border border-black/5 dark:border-white/10"
                              style={{ backgroundColor: hex }}
                            />
                            <span className="flex-1">
                              {getColorLabel(hex)} ({count})
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Palette Expansion
                  </div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {palette.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          setActiveFilterColor(activeFilterColor === hex ? null : hex)
                          setShowColorPopover(false)
                        }}
                        className="size-5 rounded-full border border-black/5 dark:border-white/10"
                        style={{ backgroundColor: hex }}
                        title={hex.toUpperCase()}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newPaletteColor}
                      onChange={(event) => setNewPaletteColor(event.target.value)}
                      className="h-9 w-11 cursor-pointer rounded border border-border bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const normalized = newPaletteColor.toLowerCase()
                        if (palette.includes(normalized)) {
                          return
                        }

                        setPreferences({
                          colorPalette: [...palette, normalized],
                        })
                      }}
                      className="h-9 text-[12px]"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('prev-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronsLeft className="size-4" strokeWidth={2.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('prev-day')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" strokeWidth={2.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('next-day')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" strokeWidth={2.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('next-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronsRight className="size-4" strokeWidth={2.75} />
          </Button>
          <Popover
            open={showDatePopover}
            onOpenChange={(open) => {
              setShowDatePopover(open)
              if (open) {
                setPickerMonth(currentDate)
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 size-8 text-muted-foreground hover:text-foreground"
              >
                <CalendarIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={8}
              collisionPadding={12}
              className="z-50 w-auto max-w-[calc(100vw-24px)] rounded-2xl border-0 p-0 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
            >
              <Calendar
                mode="single"
                selected={currentDate}
                month={pickerMonth}
                onMonthChange={setPickerMonth}
                onSelect={(date) => {
                  if (date) {
                    setSelectedCalendarDate(formatLocalDateKey(date))
                    setShowDatePopover(false)
                  }
                }}
                className="rounded-2xl border-b-[4px] border-b-[var(--accent-color)] bg-white p-4"
                classNames={{
                  month_caption: "relative flex h-10 w-full items-center justify-center px-10",
                  caption_label: "text-center text-[14px] leading-none font-semibold uppercase tracking-[0.14em]",
                  nav: "absolute inset-x-0 top-4 z-10 flex items-center justify-between px-3",
                  button_previous: "flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted [&_svg]:size-4 [&_svg]:text-foreground",
                  button_next: "flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted [&_svg]:size-4 [&_svg]:text-foreground",
                  weekdays: "mb-2 mt-3 grid grid-cols-7",
                  weekday: "text-center text-[12px] font-semibold uppercase text-foreground",
                  week: "mt-0 grid grid-cols-7",
                  day: "aspect-square p-0",
                  day_button: "h-12 w-12 rounded-none text-base font-semibold text-foreground hover:bg-muted/50",
                  today: "bg-transparent text-foreground",
                  selected: "bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color)]",
                  outside: "text-muted-foreground/40",
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </header>
  )
}

function TokenPreviewBar({ tokens }: { tokens: NaturalLanguagePreviewToken[] }) {
  if (tokens.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      {tokens.map((token) => (
        <span
          key={token.key}
          className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          {token.label}
        </span>
      ))}
    </div>
  )
}

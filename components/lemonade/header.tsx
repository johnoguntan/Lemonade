"use client"

import { Search, Calendar as CalendarIcon, Plus, Rows3, Clock3, SunMedium, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PrintPreviewDialog } from "./print-preview-dialog"
import { cn } from "@/lib/utils"
import {
  createOptimisticTodoId,
  formatLocalDateKey,
  localTaskParser,
  normalizeCalendarDateKey,
  parseNaturalLanguageTaskEntries,
  parseLocalDateKey,
  reconcileOptimisticTaskOrder,
  useLemonadeStore,
  type NaturalLanguagePreviewToken,
  type Todo,
} from "@/lib/store"
import { format, isValid, parseISO } from "date-fns"
import { useEffect, useState } from "react"
import { getTodayViewBuckets } from "./today-view"
import { toast } from "sonner"

interface HeaderProps {
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
  viewMode: "calendar" | "timeline" | "today"
  onViewModeChange: (mode: "calendar" | "timeline" | "today") => void
}

const AI_PARSE_TIMEOUT_MS = 15000

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const getDateArray = (startDate: Date, count: number): Date[] =>
  Array.from({ length: count }, (_, index) => addDays(startDate, index))

const getVisibleDateKeys = (startDate: Date) =>
  getDateArray(startDate, 7).map((date) => formatLocalDateKey(date))

const splitNaturalTitleFallback = (input: string, index: number) =>
  input
    .split(/\s*(?:,|and then|after that|also|plus|then)\s*/i)
    .map((fragment) => fragment.trim())
    .filter(Boolean)[index] ?? input.trim()

export function Header({ onNavigate, viewMode, onViewModeChange }: HeaderProps) {
  const {
    searchQuery,
    setSearchQuery,
    addCalendarTodo,
    updateCalendarTodo,
    ensureLabelIds,
    labels,
    calendarTodos,
    preferences,
    labelFilterIds,
    toggleLabelFilter,
    clearLabelFilters,
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

  const parsedQuickAdd = localTaskParser(quickAddText, { labels })
  const palette = preferences.colorPalette ?? []
  const todayKey = formatLocalDateKey(new Date())
  const todayFilteredTodos = calendarTodos.filter((todo) => {
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
    if (activeFilterColor && todo.color !== activeFilterColor) return false
    return true
  })
  const todayBuckets = getTodayViewBuckets(todayFilteredTodos, preferences.showCompleted, todayKey)
  const todayCount = todayBuckets.overdue.length + todayBuckets.today.length

  const visibleDates = getVisibleDateKeys(currentDate)
  const currentlyVisibleDateKeys =
    viewMode === "today"
      ? [todayKey]
      : viewMode === "timeline"
        ? [selectedCalendarDate]
        : visibleDates

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

  const isSelectedDateToday = selectedCalendarDate === todayKey

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

  const handleQuickAddSubmit = async () => {
    const rawInputString = quickAddText

    if (!rawInputString.trim()) {
      setQuickAddText("")
      return
    }

    const today = formatLocalDateKey(new Date())
    const parsedTasks = parseNaturalLanguageTaskEntries(rawInputString, { labels })
    const optimisticTasks = parsedTasks
      .map((parsedTask, index) => {
        const title = parsedTask.cleanText.trim() || splitNaturalTitleFallback(rawInputString, index)
        if (!title) {
          return null
        }

        const labelIds = [
          ...parsedTask.labelIds,
          ...ensureLabelIds(parsedTask.newLabelNames),
        ]
        const tempId = createOptimisticTodoId("header")
        const optimisticDate = parsedTask.scheduledDate ?? today

        addCalendarTodo({
          id: tempId,
          text: title,
          completed: false,
          date: optimisticDate,
          isHeading: title === title.toUpperCase() && title.length > 2,
          priority: parsedTask.priority,
          labelIds,
          subtasks: parsedTask.subtaskTitles.map((subtaskTitle) => ({ title: subtaskTitle })),
          isSyncing: true,
          syncStatus: undefined,
        })

        return { tempId, parsedTask, labelIds, optimisticDate }
      })
      .filter((task): task is NonNullable<typeof task> => task !== null)

    if (optimisticTasks.length === 0) {
      setQuickAddText("")
      setShowQuickAdd(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), AI_PARSE_TIMEOUT_MS)

    void fetch("/api/parse-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: rawInputString }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Task parse failed")
        }

        const tasks = await response.json()
        const aiTasks = Array.isArray(tasks) ? (tasks as Array<Record<string, unknown>>) : []
        const matchedAiTasks = reconcileOptimisticTaskOrder(
          optimisticTasks.map(({ parsedTask, optimisticDate }) => ({
            text: parsedTask.cleanText.trim(),
            optimisticDate,
          })),
          aiTasks
        )

        optimisticTasks.forEach(({ tempId, parsedTask, labelIds, optimisticDate }, index) => {
          const primaryTask = matchedAiTasks[index]

          if (!primaryTask) {
            updateCalendarTodo(tempId, { isSyncing: false, syncStatus: "local" })
            return
          }

          const normalizedDate = normalizeCalendarDateKey(
            typeof primaryTask.date === "string" ? primaryTask.date : undefined
          )
          const resolvedDate = parsedTask.scheduledDate ?? normalizedDate ?? optimisticDate
          const aiTitle =
            typeof primaryTask.title === "string" && primaryTask.title.trim()
              ? primaryTask.title.trim()
              : splitNaturalTitleFallback(rawInputString, index)
          const aiLabelIds = ensureLabelIds(
            Array.isArray(primaryTask.labels)
              ? primaryTask.labels.filter((label): label is string => typeof label === "string")
              : []
          )
          const aiPriority: Todo["priority"] =
            primaryTask.priority === "high" || primaryTask.priority === "medium" || primaryTask.priority === "low"
              ? primaryTask.priority
              : parsedTask.priority
          const aiRecurringFrequency =
            primaryTask.recurringFrequency === "daily" ||
            primaryTask.recurringFrequency === "weekday" ||
            primaryTask.recurringFrequency === "weekly" ||
            primaryTask.recurringFrequency === "monthly"
              ? primaryTask.recurringFrequency
              : undefined
          const aiRecurringInterval =
            typeof primaryTask.recurringInterval === "number" && Number.isFinite(primaryTask.recurringInterval) && primaryTask.recurringInterval > 1
              ? Math.floor(primaryTask.recurringInterval)
              : undefined

          updateCalendarTodo(tempId, {
            text: aiTitle,
            date: resolvedDate,
            time: typeof primaryTask.time === "string" && primaryTask.time ? primaryTask.time : undefined,
            priority: aiPriority,
            labelIds: aiLabelIds.length > 0 ? aiLabelIds : labelIds,
            isRecurring: primaryTask.isRecurring === true,
            recurringFrequency: aiRecurringFrequency,
            recurringDays: Array.isArray(primaryTask.recurringDays)
              ? primaryTask.recurringDays.filter((day): day is number => typeof day === "number")
              : undefined,
            recurringInterval: aiRecurringInterval,
            recurringCustomText:
              typeof primaryTask.recurringCustomText === "string" && primaryTask.recurringCustomText.trim()
                ? primaryTask.recurringCustomText.trim()
                : undefined,
            isHeading: aiTitle === aiTitle.toUpperCase() && aiTitle.length > 2,
            isSyncing: false,
            syncStatus: undefined,
          })

          if (resolvedDate && resolvedDate !== optimisticDate && !currentlyVisibleDateKeys.includes(resolvedDate)) {
            const parsedMovedDate = parseISO(resolvedDate)
            const movedLabel = isValid(parsedMovedDate) ? format(parsedMovedDate, "MMMM d") : resolvedDate
            toast(`Task moved to ${movedLabel}`, { duration: 3000 })
          }
        })
      })
      .catch(() => {
        optimisticTasks.forEach(({ tempId }) => {
          updateCalendarTodo(tempId, { isSyncing: false, syncStatus: "local" })
        })
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
      })

    setQuickAddText("")
    setShowQuickAdd(false)
  }

  return (
    <header
      className="lemonade-header flex items-center justify-between rounded-2xl border border-border/45 border-t-2 bg-background/55 px-4 py-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.42)]"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div className="flex flex-1 items-center gap-2">
        {showQuickAdd ? (
          <div className="flex w-full flex-col rounded-xl border border-border/35 bg-[rgba(255,255,255,0.34)] px-4 py-2 text-muted-foreground backdrop-blur-[12px] dark:bg-[rgba(19,19,19,0.36)]">
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
          <div className="flex h-10 w-full items-center gap-3 rounded-xl border border-border/35 bg-[rgba(255,255,255,0.34)] px-4 text-muted-foreground backdrop-blur-[12px] dark:bg-[rgba(19,19,19,0.36)]">
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
            {!isSelectedDateToday && viewMode !== "today" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('today')}
                className="ml-[4px] mr-3 h-6 shrink-0 self-center rounded-md border border-border/35 bg-background/45 px-2 text-[9px] font-semibold tracking-[0.05em] text-foreground backdrop-blur-[10px] transition-colors hover:bg-black hover:text-white dark:bg-[rgba(29,35,48,0.55)] dark:text-foreground dark:hover:bg-black dark:hover:text-white"
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
            fontSize: '14px',
            lineHeight: '14px',
            color: 'var(--accent-color)'
          }}
          className="font-logo rounded-full border border-border/35 bg-[rgba(255,255,255,0.3)] px-3 py-1.5 uppercase backdrop-blur-[12px] dark:bg-[rgba(19,19,19,0.3)]"
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
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Current Usage</span>
                    {activeFilterColor ? (
                      <button
                        type="button"
                        onClick={() => setActiveFilterColor(null)}
                        className="text-[10px] font-medium normal-case tracking-normal text-foreground/70 hover:text-foreground"
                      >
                        Clear filter
                      </button>
                    ) : null}
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
                            {isActive ? (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setActiveFilterColor(null)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setActiveFilterColor(null)
                                  }
                                }}
                                className="inline-flex items-center justify-center rounded-full border border-border/70 p-0.5 text-muted-foreground hover:text-foreground"
                                aria-label={`Clear ${getColorLabel(hex)} filter`}
                              >
                                <X className="size-3" />
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Labels</span>
                    {labelFilterIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => clearLabelFilters()}
                        className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {labels.length === 0 ? (
                    <div className="mb-4 text-[12px] text-muted-foreground">No labels created yet</div>
                  ) : (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {labels.map((label) => {
                        const isActive = labelFilterIds.includes(label.id)

                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => toggleLabelFilter(label.id)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] transition-colors",
                              isActive
                                ? "border-transparent bg-foreground text-background"
                                : "border-border bg-transparent text-foreground hover:bg-muted"
                            )}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                            <span>{label.name}</span>
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
          <PrintPreviewDialog selectedDate={selectedCalendarDate} />
          <div className="ml-2 flex items-center rounded-full border border-border/70 bg-background/80 p-0.5">
            <Button
              variant="ghost"
              onClick={() => onViewModeChange("today")}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium",
                viewMode === "today" ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground hover:text-foreground"
              )}
              title="Today view"
            >
              <SunMedium className="mr-1.5 size-4" />
              Today
              <span className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                viewMode === "today" ? "bg-background/15 text-background" : "bg-muted text-foreground"
              )}>
                {todayCount}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewModeChange("calendar")}
              className={cn(
                "size-8 rounded-full",
                viewMode === "calendar" ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground hover:text-foreground"
              )}
              title="Calendar view"
            >
              <Rows3 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewModeChange("timeline")}
              className={cn(
                "size-8 rounded-full",
                viewMode === "timeline" ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground hover:text-foreground"
              )}
              title="Timeline view"
            >
              <Clock3 className="size-4" />
            </Button>
          </div>
          {viewMode !== "today" ? (
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
                  className="rounded-2xl border border-border/35 border-b-[4px] border-b-[var(--accent-color)] bg-popover/85 p-4 backdrop-blur-[16px]"
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
          ) : null}
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

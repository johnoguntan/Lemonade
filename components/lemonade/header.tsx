"use client"

import { Search, Plus, Rows3, SunMedium, X, ChevronDown, Bell, Link2, Paperclip, ListChecks, Palette, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { PrintPreviewDialog } from "./print-preview-dialog"
import { cn } from "@/lib/utils"
import { aiParseTasks } from "@/lib/ai-task-parser"
import { ReminderTimeWheel } from "./reminder-time-wheel"
import { IconPicker } from "./icon-picker"
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
} from "@/lib/store"
import { format, isValid, parseISO } from "date-fns"
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { getTodayViewBuckets } from "./today-view"
import { toast } from "sonner"

interface HeaderProps {
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
  viewMode: "calendar" | "today"
  onViewModeChange: (mode: "calendar" | "today") => void
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
    setCalendarTimeframe,
    setCalendarFilterMode,
    setRightPageViewMode,
    aiMode,
    setAiMode,
    setMainViewMode,
    setDualViewRange,
  } = useLemonadeStore()
  const [showSearch, setShowSearch] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddText, setQuickAddText] = useState("")
  const [quickAddExpanded, setQuickAddExpanded] = useState(false)
  const [showReminderPopover, setShowReminderPopover] = useState(false)
  const [draftReminderTime, setDraftReminderTime] = useState<string | undefined>(undefined)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [draftLink, setDraftLink] = useState("")
  const [draftAttachments, setDraftAttachments] = useState<Array<{ name: string; type: string; size: number; lastModified: number }>>([])
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([])
  const [draftSubtaskText, setDraftSubtaskText] = useState("")
  const [showDraftColorPopover, setShowDraftColorPopover] = useState(false)
  const [draftColor, setDraftColor] = useState<string | undefined>(undefined)
  const [draftIcon, setDraftIcon] = useState<string | undefined>(undefined)
  const [showShortcutDatePopover, setShowShortcutDatePopover] = useState(false)
  const [showColorPopover, setShowColorPopover] = useState(false)
  const [newPaletteColor, setNewPaletteColor] = useState("#fef08a")
  const currentDate = parseLocalDateKey(selectedCalendarDate)
  const [shortcutPickerMonth, setShortcutPickerMonth] = useState<Date>(currentDate)

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

  const openStandardWeekAt = (dateKey: string) => {
    setMainViewMode("standard")
    setDualViewRange(null)
    setCalendarFilterMode("all")
    setCalendarTimeframe("week")
    setSelectedCalendarDate(dateKey)
    setRightPageViewMode("project")
    onViewModeChange("calendar")
  }

  const openDualRange = (range: "NEXT_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "PPL") => {
    setMainViewMode("dual")
    setDualViewRange(range)
    setCalendarFilterMode("all")
    if (range === "NEXT_WEEK") {
      setCalendarTimeframe("next-week")
    } else if (range === "THIS_MONTH") {
      setCalendarTimeframe("this-month")
    } else if (range === "THIS_YEAR") {
      setCalendarTimeframe("this-year")
    } else {
      setCalendarTimeframe("week")
      setSelectedCalendarDate(todayKey)
    }
    onViewModeChange("calendar")
  }

  const goToDefaultView = () => {
    openStandardWeekAt(todayKey)
  }

  const draftNotes = useMemo(() => {
    const lines: string[] = []
    const trimmedLink = draftLink.trim()
    if (trimmedLink) {
      lines.push(trimmedLink)
    }
    draftAttachments.forEach((file) => {
      lines.push(`Attachment: ${file.name}`)
    })
    const joined = lines.join("\n").trim()
    return joined ? joined : undefined
  }, [draftAttachments, draftLink])

  const resetQuickAddDraft = () => {
    setQuickAddExpanded(false)
    setShowReminderPopover(false)
    setDraftReminderTime(undefined)
    setShowLinkInput(false)
    setDraftLink("")
    setDraftAttachments([])
    setShowSubtaskInput(false)
    setDraftSubtasks([])
    setDraftSubtaskText("")
    setShowDraftColorPopover(false)
    setDraftColor(undefined)
    setDraftIcon(undefined)
  }

  const closeQuickAdd = () => {
    setShowQuickAdd(false)
    setQuickAddText("")
    resetQuickAddDraft()
  }

  const handleAttachmentPick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setDraftAttachments((current) => current.concat(
      files.map((file) => ({ name: file.name, type: file.type, size: file.size, lastModified: file.lastModified }))
    ))
    event.target.value = ""
  }

  const addDraftSubtask = () => {
    const trimmed = draftSubtaskText.trim()
    if (!trimmed) return
    setDraftSubtasks((current) => [...current, trimmed])
    setDraftSubtaskText("")
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
      resetQuickAddDraft()
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

    // Manual mode: save input exactly as typed, no parsing.
    if (!aiMode) {
      const title = rawInputString.trim()
      addCalendarTodo({
        id: createOptimisticTodoId("header"),
        text: title,
        completed: false,
        date: selectedCalendarDate,
        isHeading: title === title.toUpperCase() && title.length > 2,
        labelIds: [],
        subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
        color: draftColor,
        icon: draftIcon,
        notes: draftNotes,
        reminderTime: draftReminderTime,
        isSyncing: false,
        syncStatus: undefined,
      })

      closeQuickAdd()
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

        const labelIds = Array.from(new Set([
          ...parsedTask.labelIds,
          ...ensureLabelIds(parsedTask.newLabelNames),
        ]))
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
          subtasks: [...parsedTask.subtaskTitles, ...draftSubtasks].map((subtaskTitle) => ({ title: subtaskTitle })),
          color: draftColor,
          icon: draftIcon,
          notes: draftNotes,
          reminderTime: draftReminderTime,
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

    void aiParseTasks(rawInputString, controller.signal)
      .then((aiTasks) => {
        const matchedAiTasks = reconcileOptimisticTaskOrder(
          optimisticTasks.map(({ parsedTask, optimisticDate }) => ({
            text: parsedTask.cleanText.trim(),
            optimisticDate,
          })),
          aiTasks
        )

        optimisticTasks.forEach(({ tempId, parsedTask, labelIds: _labelIds, optimisticDate }, index) => {
          const primaryTask = matchedAiTasks[index]

          if (!primaryTask) {
            updateCalendarTodo(tempId, { isSyncing: false, syncStatus: "local" })
            return
          }

          const normalizedDate = normalizeCalendarDateKey(
            typeof primaryTask.date === "string" ? primaryTask.date : undefined
          )
          const resolvedDate = normalizedDate ?? parsedTask.scheduledDate ?? optimisticDate
          const aiTitle =
            typeof primaryTask.title === "string" && primaryTask.title.trim()
              ? primaryTask.title.trim()
              : splitNaturalTitleFallback(rawInputString, index)

          updateCalendarTodo(tempId, {
            text: aiTitle,
            date: resolvedDate,
            time: typeof primaryTask.time === "string" && primaryTask.time ? primaryTask.time : undefined,
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

    closeQuickAdd()
  }

  return (
    <header
      className="lemonade-header flex w-[calc(100%+20px)] -mx-[10px] items-center justify-between rounded-2xl border border-border/45 border-t-2 bg-background/55 px-4 py-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.42)]"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div className="flex flex-1 items-center gap-2">
        {showQuickAdd ? (
          <div className="flex w-full min-w-0 flex-1 items-stretch gap-3">
            {/* Left: input + icons */}
            <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border/35 bg-[rgba(255,255,255,0.34)] px-4 py-2 text-muted-foreground backdrop-blur-[12px] dark:bg-[rgba(19,19,19,0.36)]">
              <div className="flex h-10 items-center gap-3">
                <Plus className="size-[15px] shrink-0" />
                <Input
                  placeholder={aiMode ? 'AI Mode: try “Call John tomorrow 2pm”' : "Manual: add a task"}
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleQuickAddSubmit()
                    } else if (event.key === "Escape") {
                      closeQuickAdd()
                    }
                  }}
                  className="h-auto w-full min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[12px] text-foreground shadow-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAiMode(!aiMode)}
                  className={cn(
                    "h-7 shrink-0 rounded-full px-2 text-[11px] font-semibold",
                    aiMode
                      ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={aiMode ? "AI Mode (on)" : "Manual mode (off)"}
                >
                  {aiMode ? "AI Mode" : "Manual"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuickAddExpanded((expanded) => !expanded)}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label={quickAddExpanded ? "Collapse quick add options" : "Expand quick add options"}
                >
                  <ChevronDown className={cn("size-4 transition-transform", quickAddExpanded && "rotate-180")} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    closeQuickAdd()
                  }}
                  className="ml-auto size-7 text-muted-foreground hover:text-foreground"
                >
                  <span className="text-[18px] leading-none">×</span>
                </Button>
              </div>

              <TokenPreviewBar tokens={parsedQuickAdd.previewTokens} />

              {quickAddExpanded ? (
                <div className="pt-2">
                  <div className="flex flex-wrap items-center gap-1">
                  {/* Reminder */}
                  <Popover open={showReminderPopover} onOpenChange={setShowReminderPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-8 text-muted-foreground hover:text-foreground",
                          draftReminderTime && "text-foreground"
                        )}
                        aria-label="Add reminder"
                      >
                        <Bell className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="bottom"
                      sideOffset={10}
                      className="z-50 w-[320px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Reminder
                          </div>
                          {draftReminderTime ? (
                            <button
                              type="button"
                              onClick={() => setDraftReminderTime(undefined)}
                              className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                        <ReminderTimeWheel value={draftReminderTime} onChange={setDraftReminderTime} />
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Icon */}
                  <IconPicker value={draftIcon} onChange={setDraftIcon} />

                  {/* Link */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowLinkInput((open) => !open)}
                    className={cn(
                      "size-8 text-muted-foreground hover:text-foreground",
                      draftLink.trim() && "text-foreground"
                    )}
                    aria-label="Add link or phone number"
                  >
                    <Link2 className="size-4" />
                  </Button>

                  {/* Attachments */}
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttachmentPick}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => attachmentInputRef.current?.click()}
                    className={cn(
                      "size-8 text-muted-foreground hover:text-foreground",
                      draftAttachments.length > 0 && "text-foreground"
                    )}
                    aria-label="Attach files"
                  >
                    <Paperclip className="size-4" />
                  </Button>

                  {/* Subtasks */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSubtaskInput((open) => !open)}
                    className={cn(
                      "size-8 text-muted-foreground hover:text-foreground",
                      draftSubtasks.length > 0 && "text-foreground"
                    )}
                    aria-label="Add subtasks"
                  >
                    <ListChecks className="size-4" />
                  </Button>

                  {/* Colors */}
                  <Popover open={showDraftColorPopover} onOpenChange={setShowDraftColorPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-8 text-muted-foreground hover:text-foreground",
                          draftColor && "text-foreground"
                        )}
                        aria-label="Pick a color"
                      >
                        <Palette className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="bottom"
                      sideOffset={10}
                      className="z-50 w-[240px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Color
                          </div>
                          {draftColor ? (
                            <button
                              type="button"
                              onClick={() => setDraftColor(undefined)}
                              className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from(new Set([preferences.accentColor, ...palette])).map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => {
                                setDraftColor(hex)
                                setShowDraftColorPopover(false)
                              }}
                              className={cn(
                                "size-6 rounded-full border border-black/5 dark:border-white/10",
                                draftColor === hex && "ring-2 ring-[var(--accent-color)] ring-offset-2 ring-offset-background"
                              )}
                              style={{ backgroundColor: hex }}
                              title={hex.toUpperCase()}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {showLinkInput ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Paste a URL or phone number"
                      value={draftLink}
                      onChange={(event) => setDraftLink(event.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDraftLink("")}
                      className="size-9 text-muted-foreground hover:text-foreground"
                      aria-label="Clear link"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : null}

                {showSubtaskInput ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Add a subtask"
                        value={draftSubtaskText}
                        onChange={(event) => setDraftSubtaskText(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && addDraftSubtask()}
                        className="h-9"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={addDraftSubtask} className="h-9">
                        Add
                      </Button>
                    </div>
                    {draftSubtasks.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {draftSubtasks.map((subtask, index) => (
                          <button
                            key={`${subtask}-${index}`}
                            type="button"
                            onClick={() => setDraftSubtasks((current) => current.filter((_, i) => i !== index))}
                            className="rounded-full bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-muted/70"
                            title="Remove subtask"
                          >
                            {subtask}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </div>
              ) : null}
            </div>

            {/* Right: shortcuts (vertical) */}
            {quickAddExpanded ? (
              <div className="w-[100px] shrink-0 rounded-xl border border-border/35 bg-[rgba(255,255,255,0.34)] px-2 py-2 text-foreground backdrop-blur-[12px] dark:bg-[rgba(19,19,19,0.36)]">
                <div className="mb-1 flex items-center justify-end">
                  <Popover
                    open={showShortcutDatePopover}
                    onOpenChange={(open) => {
                      setShowShortcutDatePopover(open)
                      if (open) {
                        setShortcutPickerMonth(parseLocalDateKey(selectedCalendarDate))
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        aria-label="Pick a date"
                        title="Pick a date"
                      >
                        <CalendarIcon className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      side="bottom"
                      sideOffset={10}
                      collisionPadding={12}
                      className="z-50 w-auto max-w-[calc(100vw-24px)] rounded-2xl border-0 p-0 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                    >
                      <Calendar
                        mode="single"
                        selected={parseLocalDateKey(selectedCalendarDate)}
                        month={shortcutPickerMonth}
                        onMonthChange={setShortcutPickerMonth}
                        onSelect={(date) => {
                          if (!date) return
                          setShowShortcutDatePopover(false)
                          openStandardWeekAt(formatLocalDateKey(date))
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {(() => {
                  const base = new Date()
                  base.setHours(0, 0, 0, 0)
                  const nextDays = [1, 2, 3].map((offset) => addDays(base, offset))

                  const itemClass =
                    "inline-flex w-auto items-center justify-end whitespace-nowrap rounded-lg px-2 py-1.5 text-right text-[12px] transition-colors hover:bg-muted"

                  return (
                    <div className="flex flex-col items-end gap-1">
                      {nextDays.map((date) => (
                        <button
                          key={formatLocalDateKey(date)}
                          type="button"
                          className={cn(itemClass, "self-end")}
                          onClick={() => openStandardWeekAt(formatLocalDateKey(date))}
                        >
                          <span>{date.toLocaleDateString("en-US", { weekday: "long" })}</span>
                        </button>
                      ))}

                      <div className="my-1 h-px w-full bg-border/50" />

                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => openStandardWeekAt(todayKey)}>
                        <span>This week</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => openDualRange("NEXT_WEEK")}>
                        <span>Next week</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => openDualRange("THIS_MONTH")}>
                        <span>This month</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => openDualRange("THIS_YEAR")}>
                        <span>This year</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => openDualRange("PPL")}>
                        <span>Playground</span>
                      </button>
                    </div>
                  )
                })()}
              </div>
            ) : null}
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
                resetQuickAddDraft()
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
      ) : null}

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
              onClick={goToDefaultView}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium",
                viewMode === "today" ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground hover:text-foreground"
              )}
              title="Today"
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
          </div>
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

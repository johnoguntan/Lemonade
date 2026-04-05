"use client"

import {
  X,
  ChevronDown,
  Bell,
  Link2,
  Paperclip,
  ListChecks,
  Palette,
  Calendar as CalendarIcon,
  Tag,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { aiParseTasks } from "@/lib/ai-task-parser"
import { IconPicker } from "./icon-picker"
import {
  createOptimisticTodoId,
  formatLocalDateKey,
  normalizeCalendarDateKey,
  parseNaturalLanguageTaskEntries,
  parseLocalDateKey,
  reconcileOptimisticTaskOrder,
  useLemonadeStore,
} from "@/lib/store"
import { format, isValid, parseISO } from "date-fns"
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
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

export function Header({ onNavigate: _onNavigate, viewMode, onViewModeChange: _onViewModeChange }: HeaderProps) {
  const {
    addCalendarTodo,
    updateCalendarTodo,
    ensureLabelIds,
    labels,
    calendarTodos,
    selectedCalendarDate,
    aiMode,
    quickAddSessionTodoIds,
    startQuickAddSession,
    endQuickAddSession,
  } = useLemonadeStore()
  const [quickAddText, setQuickAddText] = useState("")
  const [quickAddExpanded, setQuickAddExpanded] = useState(false)
  const [draftDateKey, setDraftDateKey] = useState<string | null>(selectedCalendarDate)
  const [draftTime, setDraftTime] = useState<string>("")
  const [showReminderPopover, setShowReminderPopover] = useState(false)
  const [draftReminderOffsetMinutes, setDraftReminderOffsetMinutes] = useState<number | null>(null)
  const [draftReminderCustomMinutes, setDraftReminderCustomMinutes] = useState<string>("")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [draftLink, setDraftLink] = useState("")
  const [draftAttachments, setDraftAttachments] = useState<Array<{ name: string; type: string; size: number; lastModified: number }>>([])
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([])
  const [draftSubtaskText, setDraftSubtaskText] = useState("")
  const [showPriorityPopover, setShowPriorityPopover] = useState(false)
  const [draftPriority, setDraftPriority] = useState<"high" | "medium" | "low" | "none">("none")
  const [showLabelPopover, setShowLabelPopover] = useState(false)
  const [draftLabelIds, setDraftLabelIds] = useState<string[]>([])
  const [showDraftColorPopover, setShowDraftColorPopover] = useState(false)
  const [draftColor, setDraftColor] = useState<string | undefined>(undefined)
  const [draftIcon, setDraftIcon] = useState<string | undefined>(undefined)
  const [showShortcutDatePopover, setShowShortcutDatePopover] = useState(false)
  const currentDate = parseLocalDateKey(selectedCalendarDate)
  const [shortcutPickerMonth, setShortcutPickerMonth] = useState<Date>(currentDate)

  const todayKey = formatLocalDateKey(new Date())

  const currentlyVisibleDateKeys =
    viewMode === "today"
      ? [todayKey]
      : getVisibleDateKeys(currentDate)

  // Note: shortcuts in this header are for setting the *new task's* date (draftDateKey),
  // not for navigating the calendar.

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

  const sessionTodos = useMemo(() => {
    if (quickAddSessionTodoIds.length === 0) return []
    const map = new Map(calendarTodos.map((todo) => [todo.id, todo] as const))
    return quickAddSessionTodoIds.map((id) => map.get(id)).filter(Boolean)
  }, [calendarTodos, quickAddSessionTodoIds])

  const resetPerTaskDraft = () => {
    setShowReminderPopover(false)
    setDraftReminderOffsetMinutes(null)
    setDraftReminderCustomMinutes("")
    setDraftTime("")
    setShowLinkInput(false)
    setDraftLink("")
    setDraftAttachments([])
    setShowSubtaskInput(false)
    setDraftSubtasks([])
    setDraftSubtaskText("")
    setShowPriorityPopover(false)
    setDraftPriority("none")
    setShowLabelPopover(false)
    setDraftLabelIds([])
    setShowDraftColorPopover(false)
    setDraftColor(undefined)
    setDraftIcon(undefined)
  }

  const closeQuickAdd = () => {
    setQuickAddExpanded(false)
    setQuickAddText("")
    resetPerTaskDraft()
  }

  const wasExpandedRef = useRef(false)
  useEffect(() => {
    if (quickAddExpanded) {
      startQuickAddSession()
      setDraftDateKey(selectedCalendarDate)
      setDraftTime("")
    } else if (wasExpandedRef.current) {
      endQuickAddSession()
      resetPerTaskDraft()
      setDraftDateKey(selectedCalendarDate)
    }
    wasExpandedRef.current = quickAddExpanded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAddExpanded])
  
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

  const toggleDraftLabelId = (labelId: string) => {
    setDraftLabelIds((current) => (
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    ))
  }

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
        date: draftDateKey,
        time: draftTime.trim() ? draftTime.trim() : undefined,
        isHeading: title === title.toUpperCase() && title.length > 2,
        priority: draftPriority,
        labelIds: draftLabelIds,
        subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
        color: draftColor,
        icon: draftIcon,
        notes: draftNotes,
        reminderOffsetMinutes: draftReminderOffsetMinutes,
        isSyncing: false,
        syncStatus: undefined,
      })

      setQuickAddText("")
      resetPerTaskDraft()
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
          ...draftLabelIds,
        ]))
        const tempId = createOptimisticTodoId("header")
        const optimisticDate = parsedTask.scheduledDate ?? draftDateKey ?? today
        const optimisticTime = parsedTask.time ?? (draftTime.trim() ? draftTime.trim() : undefined)

        addCalendarTodo({
          id: tempId,
          text: title,
          completed: false,
          date: optimisticDate,
          time: optimisticTime,
          isHeading: title === title.toUpperCase() && title.length > 2,
          priority: draftPriority !== "none" ? draftPriority : parsedTask.priority,
          labelIds,
          subtasks: [...parsedTask.subtaskTitles, ...draftSubtasks].map((subtaskTitle) => ({ title: subtaskTitle })),
          color: draftColor,
          icon: draftIcon,
          notes: draftNotes,
          reminderOffsetMinutes: draftReminderOffsetMinutes,
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
            time:
              typeof primaryTask.time === "string" && primaryTask.time.trim()
                ? primaryTask.time.trim()
                : parsedTask.time
                  ? parsedTask.time
                  : draftTime.trim()
                    ? draftTime.trim()
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
    resetPerTaskDraft()
  }

  return (
    <header
      className="lemonade-header flex w-full items-center"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div className="relative w-full">
        {/* Input pill */}
        <div
          className="flex w-full items-center gap-2 rounded-full border border-border/45 bg-background/55 px-6 py-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.42)]"
          onMouseDown={(event) => {
            const target = event.target as HTMLElement
            // Don't auto-expand when interacting with the buttons (chevron/calendar).
            if (target.closest("button")) return
            setQuickAddExpanded(true)
          }}
        >
          <Input
            placeholder="Add tasks here in natural language"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            onFocus={() => setQuickAddExpanded(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleQuickAddSubmit()
              } else if (event.key === "Escape") {
                closeQuickAdd()
              }
            }}
            className="h-auto w-full min-w-0 flex-1 rounded-full border-0 bg-transparent px-0 py-0 text-[14px] text-foreground shadow-none focus-visible:ring-0"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuickAddExpanded((expanded) => !expanded)}
            className="size-9 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={quickAddExpanded ? "Collapse" : "Expand"}
            title={quickAddExpanded ? "Collapse" : "Expand"}
          >
            <ChevronDown className={cn("size-4 transition-transform", quickAddExpanded && "rotate-180")} />
          </Button>

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
                className="size-9 rounded-full text-muted-foreground hover:text-foreground"
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
              <div className="p-3">
                <Calendar
                  mode="single"
                  selected={draftDateKey ? parseLocalDateKey(draftDateKey) : undefined}
                  month={shortcutPickerMonth}
                  onMonthChange={setShortcutPickerMonth}
                  onSelect={(date) => {
                    if (!date) return
                    setDraftDateKey(formatLocalDateKey(date))
                  }}
                  initialFocus
                />

                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="time"
                    value={draftTime}
                    onChange={(event) => setDraftTime(event.target.value)}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-foreground"
                    aria-label="Clear time"
                    title="Clear time"
                    onClick={() => setDraftTime("")}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setDraftDateKey(null)}
                  >
                    No date
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowShortcutDatePopover(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Expanded panel */}
        {quickAddExpanded ? (
          <div
            className={cn(
              "absolute left-0 right-0 top-full z-50 mt-2",
              "rounded-2xl border border-border/35 bg-[rgba(255,255,255,0.34)] px-4 py-4 text-foreground backdrop-blur-[12px] shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
              "dark:bg-[rgba(19,19,19,0.36)]"
            )}
            style={{ maxHeight: "min(520px, calc(100vh - 220px))", overflowY: "auto" }}
          >
            {/* Top: Saved + shortcuts in ONE container */}
            <div className="flex w-full min-w-0 items-start gap-6">
              {/* Saved */}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Saved
                </div>
                <div className="mt-2 space-y-1 text-[13px] text-foreground">
                  {sessionTodos.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground">No tasks saved yet.</div>
                  ) : (
                    sessionTodos.map((todo) => {
                      const dateLabel =
                        todo.date && typeof todo.date === "string"
                          ? format(parseISO(todo.date), "EEE MMM d")
                          : "No date"
                      const timeLabel = todo.time ? ` ${todo.time}` : ""
                      return (
                        <div key={todo.id} className="flex items-start gap-2">
                          <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-foreground/70" />
                          <div className="min-w-0">
                            <div className="truncate">
                              <span className="text-muted-foreground">{dateLabel}{timeLabel}: </span>
                              <span>{todo.text}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Shortcuts */}
              <div className="w-[120px] shrink-0">
                {(() => {
                  const base = new Date()
                  base.setHours(0, 0, 0, 0)
                  const tomorrow = addDays(base, 1)
                  const dayAfterTomorrow = addDays(base, 2)
                  const twoDaysAfter = addDays(base, 3)

                  const nextWeekStart = (() => {
                    const day = base.getDay()
                    const daysUntilNextMonday = ((8 - day) % 7) || 7
                    return addDays(base, daysUntilNextMonday)
                  })()

                  const nextMonthStart = new Date(base.getFullYear(), base.getMonth() + 1, 1)

                  const itemClass =
                    "inline-flex w-auto items-center justify-end whitespace-nowrap rounded-lg px-2 py-1.5 text-right text-[12px] transition-colors hover:bg-muted"

                  return (
                    <div className="flex flex-col items-end gap-1 text-muted-foreground">
                      <button
                        type="button"
                        className={cn(itemClass, "self-end")}
                        onClick={() => setDraftDateKey(formatLocalDateKey(tomorrow))}
                      >
                        <span className="text-foreground">Tomorrow</span>
                      </button>
                      <button
                        type="button"
                        className={cn(itemClass, "self-end")}
                        onClick={() => setDraftDateKey(formatLocalDateKey(dayAfterTomorrow))}
                      >
                        <span className="text-foreground">Day After Tomorrow</span>
                      </button>
                      <button
                        type="button"
                        className={cn(itemClass, "self-end")}
                        onClick={() => setDraftDateKey(formatLocalDateKey(twoDaysAfter))}
                      >
                        <span className="text-foreground">2 Days After</span>
                      </button>

                      <div className="my-1 h-px w-full bg-border/50" />

                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => setDraftDateKey(selectedCalendarDate)}>
                        <span className="text-foreground">This Week</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => setDraftDateKey(formatLocalDateKey(nextWeekStart))}>
                        <span className="text-foreground">Next Week</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => setDraftDateKey(formatLocalDateKey(nextMonthStart))}>
                        <span className="text-foreground">Next Month</span>
                      </button>
                      <button type="button" className={cn(itemClass, "self-end")} onClick={() => setDraftDateKey(null)}>
                        <span className="text-foreground">No Date</span>
                      </button>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="my-4 h-px w-full bg-border/50" />

            {/* Bottom: action icons (functional) */}
            <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
              {/* 1) Alert/Reminder */}
              <Popover open={showReminderPopover} onOpenChange={setShowReminderPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftReminderOffsetMinutes !== null && "text-foreground")}
                    aria-label="Add reminder"
                  >
                    <Bell className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  className="z-50 w-[260px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                >
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Alert
                    </div>

                    {[
                      { label: "None", value: null },
                      { label: "At time of event", value: 0 },
                      { label: "5 minutes before", value: 5 },
                      { label: "10 minutes before", value: 10 },
                      { label: "15 minutes before", value: 15 },
                      { label: "30 minutes before", value: 30 },
                      { label: "1 hour before", value: 60 },
                      { label: "2 hours before", value: 120 },
                      { label: "1 day before", value: 1440 },
                      { label: "2 days before", value: 2880 },
                    ].map((option) => {
                      const active = draftReminderOffsetMinutes === option.value
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            setDraftReminderOffsetMinutes(option.value)
                            setDraftReminderCustomMinutes("")
                            setShowReminderPopover(false)
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                            active && "bg-[#e54848] text-white hover:bg-[#e54848]"
                          )}
                        >
                          <span className="font-medium">{option.label}</span>
                          {active ? <span className="text-[12px]">✓</span> : null}
                        </button>
                      )
                    })}

                    <div className="my-2 h-px bg-border/50" />

                    <div className="text-[12px] text-muted-foreground">Custom…</div>
                    <div className="flex items-center gap-2">
                      <Input
                        inputMode="numeric"
                        placeholder="Minutes before"
                        value={draftReminderCustomMinutes}
                        onChange={(event) => setDraftReminderCustomMinutes(event.target.value.replace(/[^\d]/g, ""))}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={() => {
                          const minutes = Number(draftReminderCustomMinutes)
                          if (!Number.isFinite(minutes) || minutes < 0) return
                          setDraftReminderOffsetMinutes(minutes)
                          setShowReminderPopover(false)
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 2) Subtask */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowSubtaskInput((open) => !open)}
                className={cn("size-8 hover:text-foreground", draftSubtasks.length > 0 && "text-foreground")}
                aria-label="Add subtasks"
              >
                <ListChecks className="size-4" />
              </Button>

              {/* 3) URL / Phone */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowLinkInput((open) => !open)}
                className={cn("size-8 hover:text-foreground", draftLink.trim() && "text-foreground")}
                aria-label="Add link or phone number"
              >
                <Link2 className="size-4" />
              </Button>

              {/* 4) Urgency */}
              <Popover open={showPriorityPopover} onOpenChange={setShowPriorityPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftPriority !== "none" && "text-foreground")}
                    aria-label="Set urgency"
                  >
                    <AlertTriangle className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  className="z-50 w-[220px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                >
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Urgency
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["high", "medium", "low", "none"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setDraftPriority(p)
                          setShowPriorityPopover(false)
                        }}
                        className={cn(
                          "rounded-lg border border-border/70 px-2 py-2 text-[12px] capitalize transition-colors hover:bg-muted",
                          draftPriority === p && "border-transparent bg-foreground text-background hover:bg-foreground"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 5) Icon */}
              <IconPicker value={draftIcon} onChange={setDraftIcon} />

              {/* 6) Label */}
              <Popover open={showLabelPopover} onOpenChange={setShowLabelPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftLabelIds.length > 0 && "text-foreground")}
                    aria-label="Select labels"
                  >
                    <Tag className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  className="z-50 w-[260px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Labels
                    </div>
                    {draftLabelIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setDraftLabelIds([])}
                        className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {labels.length === 0 ? (
                      <div className="text-[12px] text-muted-foreground">No labels created yet</div>
                    ) : (
                      labels.map((label) => {
                        const active = draftLabelIds.includes(label.id)
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => toggleDraftLabelId(label.id)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] transition-colors",
                              active
                                ? "border-transparent bg-foreground text-background"
                                : "border-border bg-transparent text-foreground hover:bg-muted"
                            )}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                            <span>{label.name}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 7) Color */}
              <Popover open={showDraftColorPopover} onOpenChange={setShowDraftColorPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftColor && "text-foreground")}
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
                      {[
                        "#fef08a",
                        "#bbf7d0",
                        "#bfdbfe",
                        "#fbcfe8",
                        "#fed7aa",
                        "#e5e7eb",
                      ].map((hex) => (
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

              {/* Attachments (kept, even though not in the 7 list) */}
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
                className={cn("size-8 hover:text-foreground", draftAttachments.length > 0 && "text-foreground")}
                aria-label="Attach files"
              >
                <Paperclip className="size-4" />
              </Button>
            </div>

            {showLinkInput ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  placeholder="Paste a URL or phone number"
                  value={draftLink}
                  onChange={(event) => setDraftLink(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setShowLinkInput(false)
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDraftLink("")
                    setShowLinkInput(false)
                  }}
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="Close link input"
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addDraftSubtask()
                      } else if (event.key === "Escape") {
                        setShowSubtaskInput(false)
                        setDraftSubtaskText("")
                      }
                    }}
                    className="h-9"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addDraftSubtask} className="h-9">
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowSubtaskInput(false)
                      setDraftSubtaskText("")
                    }}
                    className="size-9 text-muted-foreground hover:text-foreground"
                    aria-label="Close subtasks"
                    title="Close"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {draftSubtasks.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        Subtasks
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraftSubtasks([])}
                        className="text-[10px] font-medium text-foreground/70 hover:text-foreground"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draftSubtasks.map((subtask, index) => (
                        <button
                          key={`${subtask}-${index}`}
                          type="button"
                          onClick={() => setDraftSubtasks((current) => current.filter((_, i) => i !== index))}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-muted/70"
                          title="Remove subtask"
                        >
                          <span>{subtask}</span>
                          <span className="text-muted-foreground">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}

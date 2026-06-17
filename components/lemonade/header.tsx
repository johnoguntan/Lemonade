"use client"

import {
  X,
  ChevronDown,
  Bell,
  Check,
  Link2,
  Paperclip,
  ListChecks,
  NotebookPen,
  Palette,
  Calendar as CalendarIcon,
  Tag,
  AlertTriangle,
  Search,
  Timer,
  Clock3,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { aiParseSingleTask, type AiParsedTask } from "@/lib/ai-task-parser"
import { ColorPickerPanel } from "./color-picker-panel"
import { buildHeuristicParsedTask, detectRecurringPattern, extractExplicitSignals, resolveParsedRecurringTodoFields } from "@/lib/task-shortcuts"
import {
  DEFAULT_TASK_SEARCH_FILTERS,
  createOptimisticTodoId,
  formatLocalDateKey,
  parseLocalDateKey,
  type TaskAttachment,
  useLemonadeStore,
} from "@/lib/store"
import { addMonths, format, isValid, parseISO } from "date-fns"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { TASK_ICON_LIBRARY } from "@/lib/task-icons"
import { useIsMobile } from "@/hooks/use-mobile"

interface HeaderProps {
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
  viewMode: "calendar" | "today"
  onViewModeChange: (mode: "calendar" | "today") => void
}

const AI_PARSE_TIMEOUT_MS = 15000
const QUICK_ADD_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const
const QUICK_ADD_TIME_OPTIONS = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"] as const
const WEEKDAY_NAME_BY_INDEX = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
const QUICK_ADD_RECURRING_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekday", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const
const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const addDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("Unable to read file"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"))
    reader.readAsDataURL(file)
  })

const fileToTaskAttachment = async (file: File): Promise<TaskAttachment> => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${file.name}-${file.lastModified}-${file.size}`,
  name: file.name,
  type: file.type,
  size: file.size,
  dataUrl: await readFileAsDataUrl(file),
  createdAt: Date.now(),
})

const formatAttachmentSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const mergeAttachmentsById = (attachments: TaskAttachment[]) => {
  const seen = new Set<string>()
  return attachments.filter((attachment) => {
    if (seen.has(attachment.id)) return false
    seen.add(attachment.id)
    return true
  })
}

const optionRowClass = (active: boolean) =>
  cn(
    "flex w-full items-center justify-center rounded-lg px-3 py-2 text-center text-[12px] transition-colors",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  )

const formatDurationLabel = (minutes: number | null) => {
  if (!minutes || minutes <= 0) {
    return ""
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} hr${hours === 1 ? "" : "s"}`
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return `${hours} hr ${remainder} min`
  }

  return `${minutes} min`
}

const formatDurationBadgeLabel = (minutes: number | null) => {
  if (!minutes || minutes <= 0) {
    return ""
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours}HR`
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return `${hours}HR ${remainder}MIN`
  }

  return `${minutes}MIN`
}

const parseDurationInput = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const clockMatch = normalized.match(/^(\d{1,2})\s*:\s*(\d{2})$/)
  if (clockMatch) {
    const hours = Number.parseInt(clockMatch[1], 10)
    const minutes = Number.parseInt(clockMatch[2], 10)
    const total = hours * 60 + minutes
    return Number.isFinite(total) && total > 0 ? total : null
  }

  const mixedMatch = normalized.match(
    /^(?:(\d+(?:\.\d+)?)\s*h(?:r|rs|ours)?\s*)?(?:(\d+)\s*m(?:in|ins|inutes)?\s*)?$/
  )
  if (mixedMatch && (mixedMatch[1] || mixedMatch[2])) {
    const hoursPart = mixedMatch[1] ? Number.parseFloat(mixedMatch[1]) : 0
    const minutesPart = mixedMatch[2] ? Number.parseInt(mixedMatch[2], 10) : 0
    const total = Math.round(hoursPart * 60) + minutesPart
    return Number.isFinite(total) && total > 0 ? total : null
  }

  const hoursMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs)?$/)
  if (hoursMatch) {
    return Math.max(1, Math.round(Number.parseFloat(hoursMatch[1]) * 60))
  }

  const minutesMatch = normalized.match(/^(\d+)\s*m(?:in|ins)?$/)
  if (minutesMatch) {
    return Math.max(1, Number.parseInt(minutesMatch[1], 10))
  }

  const plainNumber = Number.parseInt(normalized, 10)
  return Number.isFinite(plainNumber) && plainNumber > 0 ? plainNumber : null
}

const formatTimeDisplayLabel = (value: string) => {
  const normalized = value.trim()
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return normalized
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return normalized
  }

  const suffix = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 || 12
  return minutes === 0 ? `${displayHours}${suffix}` : `${displayHours}:${match[2]}${suffix}`
}

const resolveRecurringTodoFields = (task: AiParsedTask) => {
  return resolveParsedRecurringTodoFields(task as unknown as Record<string, unknown>)
}

const buildRecurringSeriesPreview = (task: AiParsedTask, dateKey: string | null) => {
  if (!task.recurring || !dateKey) {
    return null
  }

  const start = parseISO(dateKey)
  if (!isValid(start)) {
    return null
  }

  const dates: Date[] = [start]

  if (task.recurring === "daily") {
    dates.push(addDays(start, 1), addDays(start, 2))
  } else if (task.recurring === "weekday") {
    let cursor = start
    while (dates.length < 3) {
      cursor = addDays(cursor, 1)
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
        dates.push(cursor)
      }
    }
  } else if (task.recurring === "weekly") {
    const recurringDays = Array.isArray(task.recurringDays) && task.recurringDays.length > 0
      ? new Set(task.recurringDays)
      : null

    if (recurringDays) {
      let cursor = start
      while (dates.length < 3) {
        cursor = addDays(cursor, 1)
        if (recurringDays.has(cursor.getDay())) {
          dates.push(cursor)
        }
      }
    } else {
      dates.push(addDays(start, 7), addDays(start, 14))
    }
  } else if (task.recurring === "monthly") {
    dates.push(addMonths(start, 1), addMonths(start, 2))
  } else if (task.recurring === "yearly") {
    const nextYear = new Date(start)
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const yearAfter = new Date(start)
    yearAfter.setFullYear(yearAfter.getFullYear() + 2)
    dates.push(nextYear, yearAfter)
  }

  const scheduleLabel =
    task.recurring === "weekday"
      ? "Repeats every weekday"
      : task.recurring === "weekly" && Array.isArray(task.recurringDays) && task.recurringDays.length > 1
        ? `Repeats every ${task.recurringDays.map((day) => WEEKDAY_NAME_BY_INDEX[day]?.toLowerCase()).filter(Boolean).join(" and ")}`
      : task.recurring === "weekly" && typeof task.recurringDay === "number" && task.recurringDay >= 0 && task.recurringDay <= 6
        ? `Repeats every ${WEEKDAY_NAME_BY_INDEX[task.recurringDay].toLowerCase()}`
        : task.recurring === "monthly" && typeof task.recurringDay === "number"
          ? `Repeats every month on day ${task.recurringDay}`
        : `Repeats ${task.recurring}`

  const previewDates = dates.map((date) => format(date, "MMM d"))
  return `${scheduleLabel}. Upcoming: ${previewDates.join(", ")}`
}

export function Header({ onNavigate: _onNavigate, viewMode: _viewMode, onViewModeChange: _onViewModeChange }: HeaderProps) {
  const {
    addCalendarTodo,
    updateCalendarTodo,
    ensureLabelIds,
    labels,
    calendarTodos,
    lists,
    selectedCalendarDate,
    setSelectedCalendarDate,
    aiMode,
    preferences,
    setPreferences,
    quickAddSessionTodoIds,
    startQuickAddSession,
    endQuickAddSession,
    searchQuery,
    setSearchQuery,
    searchModeActive,
    setSearchModeActive,
    taskSearchFilters,
    setTaskSearchFilters,
    resetTaskSearchFilters,
    labelFilterIds,
    setLabelFilterIds,
    clearLabelFilters,
    activeFilterColor,
    setActiveFilterColor,
  } = useLemonadeStore()
  const isMobile = useIsMobile()
  const [quickAddText, setQuickAddText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [quickAddExpanded, setQuickAddExpanded] = useState(false)
  const [draftDateKey, setDraftDateKey] = useState<string | null>(() => formatLocalDateKey(new Date()))
  const [draftListTarget, setDraftListTarget] = useState<
    "this-week" | "next-week" | "this-month" | "next-month" | "this-year" | "next-year" | "someday" | "goals" | null
  >(null)
  const [draftDateTouched, setDraftDateTouched] = useState(false)
  const [draftTime, setDraftTime] = useState<string>("")
  const [showTimePopover, setShowTimePopover] = useState(false)
  const [showReminderPopover, setShowReminderPopover] = useState(false)
  const [draftReminderOffsetMinutes, setDraftReminderOffsetMinutes] = useState<number | null>(null)
  const [draftReminderCustomMinutes, setDraftReminderCustomMinutes] = useState<string>("")
  const [showDurationPopover, setShowDurationPopover] = useState(false)
  const [draftDurationMinutes, setDraftDurationMinutes] = useState<number | null>(null)
  const [draftDurationCustomValue, setDraftDurationCustomValue] = useState("")
  const [showRecurringPopover, setShowRecurringPopover] = useState(false)
  const [draftRecurring, setDraftRecurring] = useState<AiParsedTask["recurring"]>(null)
  const [draftRecurringDays, setDraftRecurringDays] = useState<number[] | undefined>(undefined)
  const [draftRecurringInterval, setDraftRecurringInterval] = useState<number | undefined>(undefined)
  const [draftRecurringCustomText, setDraftRecurringCustomText] = useState<string | undefined>(undefined)
  const [draftRecurringCustomValue, setDraftRecurringCustomValue] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [draftLink, setDraftLink] = useState("")
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [draftNoteText, setDraftNoteText] = useState("")
  const [draftAttachments, setDraftAttachments] = useState<TaskAttachment[]>([])
  const [isReadingAttachments, setIsReadingAttachments] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const pendingAttachmentReadRef = useRef<Promise<TaskAttachment[]> | null>(null)
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([])
  const [draftSubtaskText, setDraftSubtaskText] = useState("")
  const [showPriorityPopover, setShowPriorityPopover] = useState(false)
  const [draftPriority, setDraftPriority] = useState<"urgent" | "important" | "normal">("normal")
  const [showLabelPopover, setShowLabelPopover] = useState(false)
  const [draftLabelIds, setDraftLabelIds] = useState<string[]>([])
  const [draftNewLabelName, setDraftNewLabelName] = useState("")
  const [showDraftColorPopover, setShowDraftColorPopover] = useState(false)
  const [draftColor, setDraftColor] = useState<string | undefined>(undefined)
  const [showShortcutDatePopover, setShowShortcutDatePopover] = useState(false)
  const [parsedPreview, setParsedPreview] = useState<AiParsedTask | null>(null)
  const [editingParsedTask, setEditingParsedTask] = useState<AiParsedTask | null>(null)
  const [searchFiltersExpanded, setSearchFiltersExpanded] = useState(false)
  const quickAddInputRef = useRef<HTMLInputElement>(null)
  const quickAddBoundaryRef = useRef<HTMLDivElement>(null)
  const parseRequestIdRef = useRef(0)
  const currentDate = parseLocalDateKey(selectedCalendarDate)
  const [shortcutPickerMonth, setShortcutPickerMonth] = useState<Date>(currentDate)

  const selectDraftDate = useCallback((dateKey: string | null) => {
    setDraftDateKey(dateKey)
    setDraftDateTouched(true)
  }, [])

  const focusQuickAddInput = useCallback(() => {
    window.requestAnimationFrame(() => quickAddInputRef.current?.focus())
  }, [])

  const applyDraftDateSelection = useCallback((
    dateKey: string | null,
    listTarget: "this-week" | "next-week" | "this-month" | "next-month" | "this-year" | "next-year" | "someday" | "goals" | null = null,
    options?: { closeDatePopover?: boolean }
  ) => {
    selectDraftDate(dateKey)
    setDraftListTarget(listTarget)
    if (options?.closeDatePopover) {
      setShowShortcutDatePopover(false)
    }
    focusQuickAddInput()
  }, [focusQuickAddInput, selectDraftDate])

  const todayKey = formatLocalDateKey(new Date())
  const draftDateShortcutOptions = useMemo(() => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const nextWeekStart = (() => {
      const day = base.getDay()
      const daysUntilNextMonday = ((8 - day) % 7) || 7
      return addDays(base, daysUntilNextMonday)
    })()

    return [
      { label: "Today", dateKey: formatLocalDateKey(base) },
      { label: "Tomorrow", dateKey: formatLocalDateKey(addDays(base, 1)) },
      { label: "This Week", dateKey: formatLocalDateKey(base), listTarget: "this-week" as const },
      { label: "Next Week", dateKey: formatLocalDateKey(nextWeekStart), listTarget: "next-week" as const },
      { label: "This Month", dateKey: formatLocalDateKey(base), listTarget: "this-month" as const },
      { label: "Next Month", dateKey: formatLocalDateKey(new Date(base.getFullYear(), base.getMonth() + 1, 1)), listTarget: "next-month" as const },
      { label: "This Year", dateKey: formatLocalDateKey(base), listTarget: "this-year" as const },
      { label: "Next Year", dateKey: formatLocalDateKey(addDays(base, 365)), listTarget: "next-year" as const },
      { label: "Someday", dateKey: null, listTarget: "someday" as const },
      { label: "Goals", dateKey: null, listTarget: "goals" as const },
    ]
  }, [])

  // Note: shortcuts in this header are for setting the *new task's* date (draftDateKey),
  // not for navigating the calendar.

  const draftNotes = useMemo(() => {
    const lines: string[] = []
    const trimmedNote = draftNoteText.trim()
    if (trimmedNote) {
      lines.push(trimmedNote)
    }
    const trimmedLink = draftLink.trim()
    if (trimmedLink) {
      lines.push(trimmedLink)
    }
    const joined = lines.join("\n").trim()
    return joined ? joined : undefined
  }, [draftLink, draftNoteText])

  const sessionTodos = useMemo(() => {
    if (quickAddSessionTodoIds.length === 0) return []
    const map = new Map(calendarTodos.map((todo) => [todo.id, todo] as const))
    return quickAddSessionTodoIds
      .map((id) => map.get(id))
      .filter((todo): todo is (typeof calendarTodos)[number] => Boolean(todo))
  }, [calendarTodos, quickAddSessionTodoIds])

  const allTaskColors = useMemo(() => {
    const usedColors = new Set<string>()

    calendarTodos.forEach((todo) => {
      if (todo.color) usedColors.add(todo.color)
    })

    lists.forEach((list) => {
      list.todos.forEach((todo) => {
        if (todo.color) usedColors.add(todo.color)
      })
    })

    return usedColors.size > 0 ? Array.from(usedColors) : preferences.colorPalette
  }, [calendarTodos, lists, preferences.colorPalette])

  const searchStatusChecks = useMemo(
    () => ({
      done: taskSearchFilters.status !== "todo",
      todo: taskSearchFilters.status !== "done",
    }),
    [taskSearchFilters.status]
  )

  const hasActiveSearchFilters =
    searchQuery.trim().length > 0 ||
    taskSearchFilters.status !== DEFAULT_TASK_SEARCH_FILTERS.status ||
    taskSearchFilters.when !== DEFAULT_TASK_SEARCH_FILTERS.when ||
    taskSearchFilters.priority !== DEFAULT_TASK_SEARCH_FILTERS.priority ||
    taskSearchFilters.recurring !== DEFAULT_TASK_SEARCH_FILTERS.recurring ||
    taskSearchFilters.icon !== DEFAULT_TASK_SEARCH_FILTERS.icon ||
    taskSearchFilters.attachment !== DEFAULT_TASK_SEARCH_FILTERS.attachment ||
    taskSearchFilters.url !== DEFAULT_TASK_SEARCH_FILTERS.url ||
    taskSearchFilters.phone !== DEFAULT_TASK_SEARCH_FILTERS.phone ||
    taskSearchFilters.alert !== DEFAULT_TASK_SEARCH_FILTERS.alert ||
    taskSearchFilters.dateAdded !== DEFAULT_TASK_SEARCH_FILTERS.dateAdded ||
    labelFilterIds.length > 0 ||
    activeFilterColor !== null

  const resetPerTaskDraft = useCallback(() => {
    setDraftListTarget(null)
    setDraftDateKey(formatLocalDateKey(new Date()))
    setDraftDateTouched(false)
    setShowReminderPopover(false)
    setDraftReminderOffsetMinutes(null)
    setDraftReminderCustomMinutes("")
    setShowDurationPopover(false)
    setDraftDurationMinutes(null)
    setDraftDurationCustomValue("")
    setShowRecurringPopover(false)
    setDraftRecurring(null)
    setDraftRecurringDays(undefined)
    setDraftRecurringInterval(undefined)
    setDraftRecurringCustomText(undefined)
    setDraftRecurringCustomValue("")
    setDraftTime("")
    setShowTimePopover(false)
    setShowLinkInput(false)
    setDraftLink("")
    setShowNoteInput(false)
    setDraftNoteText("")
    setDraftAttachments([])
    setIsReadingAttachments(false)
    pendingAttachmentReadRef.current = null
    setShowSubtaskInput(false)
    setDraftSubtasks([])
    setDraftSubtaskText("")
    setShowPriorityPopover(false)
    setDraftPriority("normal")
    setShowLabelPopover(false)
    setDraftLabelIds([])
    setDraftNewLabelName("")
    setShowDraftColorPopover(false)
    setDraftColor(undefined)
    setParsedPreview(null)
    setEditingParsedTask(null)
  }, [])

  const activeDestinationLabel = useMemo(() => {
    if (draftListTarget) {
      const labels: Record<string, string> = {
        "this-week": "THIS WEEK",
        "next-week": "NEXT WEEK",
        "this-month": "THIS MONTH",
        "next-month": "NEXT MONTH",
        "this-year": "THIS YEAR",
        "next-year": "NEXT YEAR",
        someday: "SOMEDAY",
        goals: "GOALS",
      }
      return labels[draftListTarget] ?? null
    }

    if (!draftDateTouched) return null
    if (!draftDateKey) return null
    const now = new Date()
    const nowKey = formatLocalDateKey(now)
    const tomorrowKey = formatLocalDateKey(addDays(now, 1))
    if (draftDateKey === nowKey) return "TODAY"
    if (draftDateKey === tomorrowKey) return "TOMORROW"
    return "DATE"
  }, [draftDateKey, draftDateTouched, draftListTarget])

  const clearDraftDestination = useCallback(() => {
    setDraftListTarget(null)
    setDraftDateKey(formatLocalDateKey(new Date()))
    setDraftDateTouched(false)
    focusQuickAddInput()
  }, [focusQuickAddInput])

  const resolveListTargetFromPrefix = (raw: string) => {
    const trimmed = raw.trim()
    if (/^this\s*week:\s+/i.test(trimmed)) return "this-week" as const
    if (/^next\s*week:\s+/i.test(trimmed)) return "next-week" as const
    if (/^this\s*month:\s+/i.test(trimmed)) return "this-month" as const
    if (/^next\s*month:\s+/i.test(trimmed)) return "next-month" as const
    if (/^this\s*year:\s+/i.test(trimmed)) return "this-year" as const
    if (/^next\s*year:\s+/i.test(trimmed)) return "next-year" as const
    if (/^someday:\s+/i.test(trimmed)) return "someday" as const
    if (/^goals?:\s+/i.test(trimmed)) return "goals" as const
    return null
  }

  const resolveListTargetFromText = (raw: string) => {
    const trimmed = raw.trim()
    if (/\bthis\s+week\b/i.test(trimmed)) return "this-week" as const
    if (/\bnext\s+week\b/i.test(trimmed)) return "next-week" as const
    if (/\bthis\s+month\b/i.test(trimmed)) return "this-month" as const
    if (/\bnext\s+month\b/i.test(trimmed)) return "next-month" as const
    if (/\bthis\s+year\b/i.test(trimmed)) return "this-year" as const
    if (/\bnext\s+year\b/i.test(trimmed)) return "next-year" as const
    if (/\bsomeday\b/i.test(trimmed)) return "someday" as const
    if (/\bgoals?\b/i.test(trimmed)) return "goals" as const
    return null
  }

  const stripBucketPrefix = (raw: string) => {
    return raw
      .replace(/^this\s*week:\s+/i, "")
      .replace(/^next\s*week:\s+/i, "")
      .replace(/^this\s*month:\s+/i, "")
      .replace(/^next\s*month:\s+/i, "")
      .replace(/^this\s*year:\s+/i, "")
      .replace(/^next\s*year:\s+/i, "")
      .replace(/^someday:\s+/i, "")
      .replace(/^goals?:\s+/i, "")
      .trim()
  }

  const stripBucketWords = (raw: string) => {
    return raw
      .replace(/\bthis\s+week\b/gi, "")
      .replace(/\bnext\s+week\b/gi, "")
      .replace(/\bthis\s+month\b/gi, "")
      .replace(/\bnext\s+month\b/gi, "")
      .replace(/\bthis\s+year\b/gi, "")
      .replace(/\bnext\s+year\b/gi, "")
      .replace(/\bsomeday\b/gi, "")
      .replace(/\bgoals?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  }

  const clearSearchMode = useCallback(() => {
    setSearchQuery("")
    resetTaskSearchFilters()
    clearLabelFilters()
    setActiveFilterColor(null)
    setSearchModeActive(false)
    setSearchFiltersExpanded(false)
  }, [clearLabelFilters, resetTaskSearchFilters, setActiveFilterColor, setSearchModeActive, setSearchQuery])

  const updateSearchStatus = useCallback((nextDone: boolean, nextTodo: boolean) => {
    const nextStatus =
      nextDone && nextTodo ? "all" :
      nextDone ? "done" :
      nextTodo ? "todo" :
      "all"
    setTaskSearchFilters({ status: nextStatus })
  }, [setTaskSearchFilters])

  const closeQuickAdd = useCallback(() => {
    setQuickAddExpanded(false)
    setQuickAddText("")
    resetPerTaskDraft()
    setDraftDateKey(formatLocalDateKey(new Date()))
    setDraftDateTouched(false)
    setDraftTime("")
    setShowShortcutDatePopover(false)
  }, [resetPerTaskDraft])

  const openQuickAdd = useCallback(() => {
    setQuickAddExpanded(true)
  }, [])

  const openSearchMode = useCallback(() => {
    closeQuickAdd()
    setSearchModeActive(true)
    setSearchFiltersExpanded(true)
  }, [closeQuickAdd, setSearchModeActive])

  const wasExpandedRef = useRef(false)
  useEffect(() => {
    if (quickAddExpanded) {
      startQuickAddSession()
    } else if (wasExpandedRef.current) {
      endQuickAddSession()
    }
    wasExpandedRef.current = quickAddExpanded
  }, [endQuickAddSession, quickAddExpanded, startQuickAddSession])

  useEffect(() => {
    if (!quickAddExpanded) {
      return
    }

    const handlePointerDownOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      if (target.closest("[data-quick-add-surface='true']")) {
        return
      }

      closeQuickAdd()
    }

    document.addEventListener("mousedown", handlePointerDownOutside)
    return () => document.removeEventListener("mousedown", handlePointerDownOutside)
  }, [closeQuickAdd, quickAddExpanded])
  
  const handleAttachmentPick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const readPromise = Promise.all(files.map(fileToTaskAttachment))
    pendingAttachmentReadRef.current = readPromise
    setIsReadingAttachments(true)

    void readPromise
      .then((attachments) => {
        setDraftAttachments((current) => current.concat(attachments))
        toast(`${attachments.length === 1 ? "Attachment" : "Attachments"} added`, { duration: 1800 })
      })
      .catch(() => toast("Could not attach one or more files", { duration: 2500 }))
      .finally(() => {
        if (pendingAttachmentReadRef.current === readPromise) {
          pendingAttachmentReadRef.current = null
          setIsReadingAttachments(false)
        }
      })

    event.target.value = ""
  }

  const getSettledDraftAttachments = useCallback(async () => {
    const pendingRead = pendingAttachmentReadRef.current
    if (!pendingRead) {
      return draftAttachments
    }

    try {
      const pendingAttachments = await pendingRead
      return mergeAttachmentsById(draftAttachments.concat(pendingAttachments))
    } catch {
      return draftAttachments
    }
  }, [draftAttachments])

  const removeDraftAttachment = (attachmentId: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
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

  const handleCreateDraftLabel = () => {
    const trimmed = draftNewLabelName.trim()
    if (!trimmed) return
    const [labelId] = ensureLabelIds([trimmed])
    if (labelId) {
      setDraftLabelIds((current) => (current.includes(labelId) ? current : [...current, labelId]))
    }
    setDraftNewLabelName("")
  }

  const getResolvedParsedDate = (task: AiParsedTask) =>
    draftDateTouched ? draftDateKey : task.date ?? todayKey

  const getPreviewDateLabel = (dateKey: string | null) => {
    if (!dateKey) return "Someday"
    if (dateKey === todayKey) return "Today"

    const tomorrowKey = formatLocalDateKey(addDays(new Date(), 1))
    if (dateKey === tomorrowKey) return "Tomorrow"

    const parsed = parseISO(dateKey)
    return isValid(parsed) ? format(parsed, "EEE MMM d") : dateKey
  }

  const parsedPreviewDateLabel = parsedPreview
    ? getPreviewDateLabel(getResolvedParsedDate(parsedPreview))
    : ""

  const parsedPreviewReminderLabel = parsedPreview?.reminder != null
    ? parsedPreview.reminder === 0
      ? "At time of event"
      : `${parsedPreview.reminder} min before`
    : null

  const parsedPreviewDurationLabel = parsedPreview
    ? formatDurationLabel(draftDurationMinutes ?? parsedPreview.duration)
    : null
  const activeDurationLabel = formatDurationBadgeLabel(draftDurationMinutes)
  const activeTimeLabel = draftTime.trim() ? formatTimeDisplayLabel(draftTime) : ""
  const activeRecurringLabel = draftRecurringCustomText
    ? draftRecurringCustomText
    : draftRecurring === "daily"
      ? "Daily"
      : draftRecurring === "weekday"
        ? "Weekdays"
        : draftRecurring === "weekly"
          ? "Weekly"
          : draftRecurring === "monthly"
            ? "Monthly"
            : ""

  const buildDraftRecurringTask = useCallback((
    task: AiParsedTask,
    recurring: AiParsedTask["recurring"],
    dateKey: string | null,
    config?: {
      recurringDays?: number[]
      recurringInterval?: number
      recurringCustomText?: string
    }
  ) => {
    if (!recurring) {
      return task
    }

    const parsedDate = dateKey ? parseLocalDateKey(dateKey) : null
    const recurringDay =
      recurring === "weekly" && parsedDate
        ? parsedDate.getDay()
        : recurring === "monthly" && parsedDate
          ? parsedDate.getDate()
          : null

    return {
      ...task,
      recurring,
      recurringDay,
      recurringDays:
        config?.recurringDays ??
        draftRecurringDays ??
        (recurring === "weekday"
          ? [1, 2, 3, 4, 5]
          : recurring === "weekly" && recurringDay !== null
            ? [recurringDay]
            : undefined),
      recurringInterval: config?.recurringInterval ?? draftRecurringInterval,
      recurringCustomText: config?.recurringCustomText ?? draftRecurringCustomText,
    }
  }, [draftRecurringCustomText, draftRecurringDays, draftRecurringInterval])

  const clearDraftRecurring = useCallback(() => {
    setDraftRecurring(null)
    setDraftRecurringDays(undefined)
    setDraftRecurringInterval(undefined)
    setDraftRecurringCustomText(undefined)
    setDraftRecurringCustomValue("")
  }, [])

  const applyDraftRecurringPreset = useCallback((recurring: Exclude<AiParsedTask["recurring"], null>) => {
    setDraftRecurring(recurring)
    setDraftRecurringDays(recurring === "weekday" ? [1, 2, 3, 4, 5] : undefined)
    setDraftRecurringInterval(undefined)
    setDraftRecurringCustomText(undefined)
    setDraftRecurringCustomValue("")
    setShowRecurringPopover(false)
  }, [])

  const getNextMonthlyDateKey = useCallback((dayOfMonth: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const buildCandidate = (monthOffset: number) => {
      const candidate = new Date(today.getFullYear(), today.getMonth() + monthOffset, dayOfMonth)
      return candidate.getMonth() === (today.getMonth() + monthOffset) % 12 ? candidate : null
    }

    const thisMonth = buildCandidate(0)
    if (thisMonth && thisMonth >= today) {
      return formatLocalDateKey(thisMonth)
    }

    const nextMonth = buildCandidate(1)
    return formatLocalDateKey(nextMonth ?? addMonths(today, 1))
  }, [])

  const applyDraftCustomRecurrence = useCallback(() => {
    const trimmed = draftRecurringCustomValue.trim()

    if (!trimmed) {
      clearDraftRecurring()
      setShowRecurringPopover(false)
      return
    }

    const normalized = trimmed.toLowerCase()
    const recurringDays = Array.from(
      new Set(
        [...normalized.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)]
          .map((match) => WEEKDAY_INDEX_BY_NAME[match[1]])
          .filter((day): day is number => typeof day === "number")
      )
    )
    const intervalMatch = normalized.match(/\bevery\s+(\d+)\s+(day|days|week|weeks|month|months)\b/)
    const recurringInterval = intervalMatch ? Math.max(1, Number.parseInt(intervalMatch[1], 10) || 1) : 1
    const monthlyDayMatch = normalized.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/)
    const monthlyDay = monthlyDayMatch ? Number.parseInt(monthlyDayMatch[1], 10) : null

    let recurring: AiParsedTask["recurring"] = "weekly"
    if (/\bweekdays?\b/.test(normalized)) {
      recurring = "weekday"
    } else if (/\bmonth|months|monthly\b/.test(normalized)) {
      recurring = "monthly"
    } else if (/\bday|days|daily|everyday\b/.test(normalized) && recurringDays.length === 0) {
      recurring = "daily"
    }

    setDraftRecurring(recurring)
    setDraftRecurringDays(
      recurring === "weekday"
        ? [1, 2, 3, 4, 5]
        : recurringDays.length > 0
          ? recurringDays
          : undefined
    )
    setDraftRecurringInterval(recurringInterval > 1 ? recurringInterval : undefined)
    setDraftRecurringCustomText(trimmed)

    if (recurring === "monthly" && monthlyDay !== null && monthlyDay >= 1 && monthlyDay <= 31) {
      selectDraftDate(getNextMonthlyDateKey(monthlyDay))
    }

    setShowRecurringPopover(false)
  }, [clearDraftRecurring, draftRecurringCustomValue, getNextMonthlyDateKey, selectDraftDate])

  const buildDeterministicQuickAddTask = useCallback((rawInput: string) => {
    const trimmed = rawInput.trim()
    if (!trimmed) {
      return null
    }

    const extracted = extractExplicitSignals(trimmed)
    const heuristicTask = buildHeuristicParsedTask(
      extracted.inputForModel || trimmed,
      todayKey,
      extracted.explicit
    )

    if (!heuristicTask) {
      return null
    }

    const hasRecurringIntent = detectRecurringPattern(trimmed).recurring !== null
    const hasDeterministicTime = Boolean(heuristicTask.time)
    const hasDeterministicDate = Boolean(heuristicTask.date && heuristicTask.date !== todayKey)
    const hasExplicitDuration = heuristicTask.duration !== null
    const hasImplicitPriority = heuristicTask.priority !== "normal"

    return hasRecurringIntent || hasDeterministicTime || hasDeterministicDate || hasExplicitDuration || hasImplicitPriority
      ? heuristicTask
      : null
  }, [todayKey])

  const createTaskFromParsedPreview = (task: AiParsedTask, attachments: TaskAttachment[] = draftAttachments) => {
    const title = task.title.trim()
    if (!title) return

    const routedBucket = draftListTarget ?? resolveListTargetFromPrefix(title)
    if (routedBucket) {
      const cleaned = stripBucketPrefix(title)
      if (cleaned) {
        const store = useLemonadeStore.getState()
        store.addListTodo(routedBucket, cleaned)
        const createdTodo = useLemonadeStore.getState().lists.find((list) => list.id === routedBucket)?.todos.at(-1)
        if (createdTodo && (draftNotes || attachments.length > 0)) {
          useLemonadeStore.getState().updateListTodo(routedBucket, createdTodo.id, {
            notes: draftNotes,
            attachments,
          })
        }
      }
      setQuickAddText("")
      resetPerTaskDraft()
      setDraftDateTouched(false)
      parseRequestIdRef.current += 1
      return
    }

    const parsedLabelIds = ensureLabelIds(task.labels)
    const labelIds = Array.from(new Set([...parsedLabelIds, ...draftLabelIds]))
    const notes = [task.notes, task.attachment ? `Attachment: ${task.attachment}` : null, draftNotes].filter(Boolean).join("\n").trim()
    const resolvedDate = getResolvedParsedDate(task)
    const taskWithDraftRecurring = buildDraftRecurringTask(task, draftRecurring, resolvedDate)
    const recurringFields = resolveRecurringTodoFields(taskWithDraftRecurring)

    addCalendarTodo({
      id: createOptimisticTodoId("header"),
      text: title,
      completed: false,
      date: resolvedDate,
      time: task.time ?? (draftTime.trim() ? draftTime.trim() : undefined),
      isHeading: title === title.toUpperCase() && title.length > 2,
      priority: draftPriority !== "normal" ? draftPriority : task.priority,
      labelIds,
      subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
      color: draftColor,
      notes: notes || undefined,
      attachments,
      url: task.url ?? (task.phone ? `tel:${task.phone}` : undefined),
      location: task.location ?? undefined,
      durationMinutes: draftDurationMinutes ?? task.duration ?? undefined,
      reminderOffsetMinutes: task.reminder ?? draftReminderOffsetMinutes,
      ...recurringFields,
      isSyncing: false,
      syncStatus: undefined,
    })

    const recurringPreview = buildRecurringSeriesPreview(taskWithDraftRecurring, resolvedDate)
    if (recurringPreview) {
      toast(recurringPreview, { duration: 4000 })
    }

    setQuickAddText("")
    resetPerTaskDraft()
    setDraftDateTouched(false)
    parseRequestIdRef.current += 1

    if (resolvedDate && resolvedDate !== selectedCalendarDate) {
      setSelectedCalendarDate(resolvedDate)
      toast(`Task added to ${getPreviewDateLabel(resolvedDate)}`, { duration: 2500 })
    }
  }

  const createTaskFromEditedParsedDraft = (task: AiParsedTask, attachments: TaskAttachment[] = draftAttachments) => {
    const title = quickAddText.trim()
    if (!title) return

    const routedBucket = draftListTarget ?? resolveListTargetFromPrefix(title)
    if (routedBucket) {
      const cleaned = stripBucketPrefix(title)
      if (cleaned) {
        const store = useLemonadeStore.getState()
        store.addListTodo(routedBucket, cleaned)
        const createdTodo = useLemonadeStore.getState().lists.find((list) => list.id === routedBucket)?.todos.at(-1)
        if (createdTodo && (draftNotes || attachments.length > 0)) {
          useLemonadeStore.getState().updateListTodo(routedBucket, createdTodo.id, {
            notes: draftNotes,
            attachments,
          })
        }
      }
      setQuickAddText("")
      resetPerTaskDraft()
      setDraftDateTouched(false)
      parseRequestIdRef.current += 1
      return
    }

    const parsedLabelIds = ensureLabelIds(task.labels)
    const labelIds = Array.from(new Set([...parsedLabelIds, ...draftLabelIds]))
    const notes = [task.notes, task.attachment ? `Attachment: ${task.attachment}` : null, draftNotes].filter(Boolean).join("\n").trim()
    const trimmedLink = draftLink.trim()
    const resolvedDate = draftDateKey
    const taskWithDraftRecurring = buildDraftRecurringTask(task, draftRecurring, resolvedDate)
    const recurringFields = resolveRecurringTodoFields(taskWithDraftRecurring)

    addCalendarTodo({
      id: createOptimisticTodoId("header"),
      text: title,
      completed: false,
      date: resolvedDate,
      time: draftTime.trim() ? draftTime.trim() : undefined,
      isHeading: title === title.toUpperCase() && title.length > 2,
      priority: draftPriority,
      labelIds,
      subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
      color: draftColor,
      notes: notes || undefined,
      attachments,
      url: trimmedLink || task.url || (task.phone ? `tel:${task.phone}` : undefined),
      location: task.location ?? undefined,
      durationMinutes: draftDurationMinutes ?? task.duration ?? undefined,
      reminderOffsetMinutes: draftReminderOffsetMinutes,
      ...recurringFields,
      isSyncing: false,
      syncStatus: undefined,
    })

    const recurringPreview = buildRecurringSeriesPreview(taskWithDraftRecurring, resolvedDate)
    if (recurringPreview) {
      toast(recurringPreview, { duration: 4000 })
    }

    setQuickAddText("")
    resetPerTaskDraft()
    setDraftDateTouched(false)
    parseRequestIdRef.current += 1

    if (resolvedDate && resolvedDate !== selectedCalendarDate) {
      setSelectedCalendarDate(resolvedDate)
      toast(`Task added to ${getPreviewDateLabel(resolvedDate)}`, { duration: 2500 })
    }
  }

  const handleEditParsedPreview = () => {
    if (!parsedPreview) return

    setQuickAddText(parsedPreview.title)
    setDraftDateKey(getResolvedParsedDate(parsedPreview))
    setDraftTime(parsedPreview.time ?? "")
    setDraftPriority(parsedPreview.priority)
    setDraftReminderOffsetMinutes(parsedPreview.reminder)
    setDraftDurationMinutes(parsedPreview.duration)
    setDraftDurationCustomValue(parsedPreview.duration ? String(parsedPreview.duration) : "")
    setDraftRecurring(parsedPreview.recurring)
    setDraftRecurringDays(parsedPreview.recurringDays)
    setDraftRecurringInterval(undefined)
    setDraftRecurringCustomText(undefined)
    setDraftRecurringCustomValue("")
    setDraftLink(parsedPreview.url ?? "")
    setShowLinkInput(Boolean(parsedPreview.url))
    setDraftLabelIds(ensureLabelIds(parsedPreview.labels))
    setDraftDateTouched(true)
    setEditingParsedTask(parsedPreview)
    setQuickAddExpanded(true)
    setParsedPreview(null)
  }

  const handleQuickAddSubmit = async () => {
    const rawInputString = quickAddText

    if (!rawInputString.trim()) {
      setQuickAddText("")
      return
    }

    const settledDraftAttachments = await getSettledDraftAttachments()

    // Fast path: if user selected a bucket shortcut OR typed bucket language,
    // route immediately to the planning list (skip AI parsing to keep input snappy).
    const routedBucket =
      draftListTarget ??
      resolveListTargetFromPrefix(rawInputString) ??
      resolveListTargetFromText(rawInputString)
    if (routedBucket) {
      const cleaned = stripBucketWords(stripBucketPrefix(rawInputString))
      if (cleaned) {
        const store = useLemonadeStore.getState()
        store.addListTodo(routedBucket, cleaned)
        const createdTodo = useLemonadeStore.getState().lists.find((list) => list.id === routedBucket)?.todos.at(-1)
        if (createdTodo && (draftNotes || settledDraftAttachments.length > 0)) {
          useLemonadeStore.getState().updateListTodo(routedBucket, createdTodo.id, {
            notes: draftNotes,
            attachments: settledDraftAttachments,
          })
        }
      }
      setQuickAddText("")
      resetPerTaskDraft()
      setDraftDateTouched(false)
      parseRequestIdRef.current += 1
      return
    }

    if (parsedPreview) {
      createTaskFromParsedPreview(parsedPreview, settledDraftAttachments)
      return
    }

    if (editingParsedTask) {
      createTaskFromEditedParsedDraft(editingParsedTask, settledDraftAttachments)
      return
    }

    const deterministicTask = buildDeterministicQuickAddTask(rawInputString)
    if (deterministicTask) {
      createTaskFromParsedPreview(deterministicTask, settledDraftAttachments)
      return
    }

    // Manual mode: save input exactly as typed, no parsing.
    if (!aiMode) {
      const title = rawInputString.trim()
      addCalendarTodo({
        id: createOptimisticTodoId("header"),
        text: title,
        completed: false,
        date: draftDateTouched ? draftDateKey : todayKey,
        time: draftTime.trim() ? draftTime.trim() : undefined,
        isHeading: title === title.toUpperCase() && title.length > 2,
        priority: draftPriority,
        labelIds: draftLabelIds,
        subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
        color: draftColor,
        notes: draftNotes,
        attachments: settledDraftAttachments,
        durationMinutes: draftDurationMinutes ?? undefined,
        reminderOffsetMinutes: draftReminderOffsetMinutes,
        ...resolveRecurringTodoFields(buildDraftRecurringTask({
          title,
          date: draftDateTouched ? draftDateKey : todayKey,
          time: draftTime.trim() ? draftTime.trim() : null,
          priority: draftPriority,
          location: null,
          duration: draftDurationMinutes,
          reminder: draftReminderOffsetMinutes,
          recurring: null,
          recurringDay: null,
          notes: draftNotes ?? null,
          url: null,
          phone: null,
          attachment: null,
          labels: [],
        }, draftRecurring, draftDateTouched ? draftDateKey : todayKey)),
        isSyncing: false,
        syncStatus: undefined,
      })

      setQuickAddText("")
      resetPerTaskDraft()
      if ((draftDateTouched ? draftDateKey : todayKey) && (draftDateTouched ? draftDateKey : todayKey) !== selectedCalendarDate) {
        setSelectedCalendarDate((draftDateTouched ? draftDateKey : todayKey) as string)
        toast(`Task added to ${getPreviewDateLabel(draftDateTouched ? draftDateKey : todayKey)}`, { duration: 2500 })
      }

      // Keep the input ready for rapid entry.
      focusQuickAddInput()
      return
    }

    // AI mode (fast): save immediately, then refine in the background.
    // This avoids the noticeable lag before the user can add the next task.
    const optimisticId = createOptimisticTodoId("header")
    const optimisticTitle = rawInputString.trim()
    const draftSnapshot = {
      dateKey: draftDateKey,
      dateTouched: draftDateTouched,
      time: draftTime,
      priority: draftPriority,
      labelIds: [...draftLabelIds],
      subtasks: [...draftSubtasks],
      color: draftColor,
      notes: draftNotes,
      attachments: [...settledDraftAttachments],
      durationMinutes: draftDurationMinutes,
      reminderOffsetMinutes: draftReminderOffsetMinutes,
      recurring: draftRecurring,
      recurringDays: draftRecurringDays,
      recurringInterval: draftRecurringInterval,
      recurringCustomText: draftRecurringCustomText,
    }
    const optimisticDateKey = draftSnapshot.dateTouched ? draftSnapshot.dateKey : todayKey
    const optimisticRecurringTask = buildDraftRecurringTask({
      title: optimisticTitle,
      date: optimisticDateKey,
      time: draftSnapshot.time.trim() ? draftSnapshot.time.trim() : null,
      priority: draftSnapshot.priority,
      location: null,
      duration: draftSnapshot.durationMinutes,
      reminder: draftSnapshot.reminderOffsetMinutes,
      recurring: null,
      recurringDay: null,
      notes: draftSnapshot.notes ?? null,
      url: null,
      phone: null,
      attachment: null,
      labels: [],
    }, draftSnapshot.recurring, optimisticDateKey, {
      recurringDays: draftSnapshot.recurringDays,
      recurringInterval: draftSnapshot.recurringInterval,
      recurringCustomText: draftSnapshot.recurringCustomText,
    })
    addCalendarTodo({
      id: optimisticId,
      text: optimisticTitle,
      completed: false,
      date: optimisticDateKey,
      time: draftSnapshot.time.trim() ? draftSnapshot.time.trim() : undefined,
      isHeading: optimisticTitle === optimisticTitle.toUpperCase() && optimisticTitle.length > 2,
      priority: draftSnapshot.priority,
      labelIds: draftSnapshot.labelIds,
      subtasks: draftSnapshot.subtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
      color: draftSnapshot.color,
      notes: draftSnapshot.notes,
      attachments: draftSnapshot.attachments,
      durationMinutes: draftSnapshot.durationMinutes ?? undefined,
      reminderOffsetMinutes: draftSnapshot.reminderOffsetMinutes,
      ...resolveRecurringTodoFields(optimisticRecurringTask),
      isSyncing: false,
      syncStatus: undefined,
    })

    // Keep session UI open for rapid multi-add.
    setQuickAddExpanded(true)
    setQuickAddText("")
    resetPerTaskDraft()
    setDraftDateTouched(false)
    focusQuickAddInput()

    if (optimisticDateKey && optimisticDateKey !== selectedCalendarDate) {
      setSelectedCalendarDate(optimisticDateKey)
      toast(`Task added to ${getPreviewDateLabel(optimisticDateKey)}`, { duration: 2500 })
    }

    // Background parse + refine.
    setSubmitting(true)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), AI_PARSE_TIMEOUT_MS)

    void aiParseSingleTask(rawInputString, controller.signal)
      .then((task) => {
        const title = task.title.trim()
        if (!title) return

        const parsedLabelIds = ensureLabelIds(task.labels)
        const labelIds = Array.from(new Set([...parsedLabelIds, ...draftSnapshot.labelIds]))
        const notes = [task.notes, task.attachment ? `Attachment: ${task.attachment}` : null, draftSnapshot.notes].filter(Boolean).join("\n").trim()
        const resolvedDate = draftSnapshot.dateTouched ? draftSnapshot.dateKey : task.date ?? todayKey
        const taskWithDraftRecurring = buildDraftRecurringTask(task, draftSnapshot.recurring, resolvedDate, {
          recurringDays: draftSnapshot.recurringDays,
          recurringInterval: draftSnapshot.recurringInterval,
          recurringCustomText: draftSnapshot.recurringCustomText,
        })
        const recurringFields = resolveRecurringTodoFields(taskWithDraftRecurring)

        updateCalendarTodo(optimisticId, {
          text: title,
          date: resolvedDate,
          time: task.time ?? (draftSnapshot.time.trim() ? draftSnapshot.time.trim() : undefined),
          priority: draftSnapshot.priority !== "normal" ? draftSnapshot.priority : task.priority,
          labelIds,
          notes: notes || undefined,
          url: task.url ?? (task.phone ? `tel:${task.phone}` : undefined),
          location: task.location ?? undefined,
          durationMinutes: draftSnapshot.durationMinutes ?? task.duration ?? undefined,
          reminderOffsetMinutes: task.reminder ?? draftSnapshot.reminderOffsetMinutes,
          ...recurringFields,
        })

        const recurringPreview = buildRecurringSeriesPreview(taskWithDraftRecurring, resolvedDate)
        if (recurringPreview) {
          toast(recurringPreview, { duration: 4000 })
        }

        if (resolvedDate && resolvedDate !== optimisticDateKey && resolvedDate !== selectedCalendarDate) {
          setSelectedCalendarDate(resolvedDate)
          toast(`Task added to ${getPreviewDateLabel(resolvedDate)}`, { duration: 2500 })
        }
      })
      .catch(() => {
        // Keep the optimistic task as-is if parsing fails.
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        setSubmitting(false)
        parseRequestIdRef.current += 1
      })
  }

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = []

    if (searchQuery.trim()) {
      chips.push({
        key: "query",
        label: `Search: ${searchQuery.trim()}`,
        clear: () => setSearchQuery(""),
      })
    }

    if (taskSearchFilters.status === "done") {
      chips.push({ key: "status-done", label: "Done", clear: () => setTaskSearchFilters({ status: "all" }) })
    } else if (taskSearchFilters.status === "todo") {
      chips.push({ key: "status-todo", label: "To Do", clear: () => setTaskSearchFilters({ status: "all" }) })
    }

    if (taskSearchFilters.when !== "all") {
      const labels: Record<string, string> = {
        today: "When: Today",
        tomorrow: "When: Tomorrow",
        "this-week": "When: This Week",
        "next-week": "When: Next Week",
        "this-month": "When: This Month",
        "next-month": "When: Next Month",
        "this-year": "When: This Year",
        someday: "When: Someday",
      }
      chips.push({ key: "when", label: labels[taskSearchFilters.when], clear: () => setTaskSearchFilters({ when: "all" }) })
    }

    if (taskSearchFilters.priority !== "all") {
      const labels: Record<string, string> = { high: "Priority: High", med: "Priority: Med", low: "Priority: Low", none: "Priority: None" }
      chips.push({ key: "priority", label: labels[taskSearchFilters.priority], clear: () => setTaskSearchFilters({ priority: "all" }) })
    }

    if (labelFilterIds.length > 0) {
      labelFilterIds.forEach((labelId) => {
        const label = labels.find((entry) => entry.id === labelId)
        if (!label) return
        chips.push({
          key: `label-${label.id}`,
          label: `Label: ${label.name}`,
          clear: () => setLabelFilterIds(labelFilterIds.filter((id) => id !== label.id)),
        })
      })
    }

    if (taskSearchFilters.recurring !== "all") {
      chips.push({
        key: "recurring",
        label: `Recurring: ${
          taskSearchFilters.recurring === "yes"
            ? "Yes"
            : taskSearchFilters.recurring === "no"
              ? "No"
              : "Both"
        }`,
        clear: () => setTaskSearchFilters({ recurring: "all" }),
      })
    }

    if (activeFilterColor) {
      chips.push({ key: "color", label: "Color", clear: () => setActiveFilterColor(null) })
    }

    if (taskSearchFilters.icon) {
      const iconLabel = TASK_ICON_LIBRARY.find((icon) => icon.key === taskSearchFilters.icon)?.label ?? "Icon"
      chips.push({ key: "icon", label: `Icon: ${iconLabel}`, clear: () => setTaskSearchFilters({ icon: null }) })
    }

    ;(["attachment", "url", "phone"] as const).forEach((key) => {
      if (taskSearchFilters[key] === "all") return
      const title = key === "attachment" ? "Attachment" : key.toUpperCase()
      chips.push({
        key,
        label: `${title}: ${
          taskSearchFilters[key] === "yes"
            ? "Yes"
            : taskSearchFilters[key] === "no"
              ? "No"
              : "Both"
        }`,
        clear: () => setTaskSearchFilters({ [key]: "all" }),
      })
    })

    if (taskSearchFilters.alert !== "all") {
      const alertLabel = {
        none: "Alert: None",
        "5min": "Alert: 5min",
        "10min": "Alert: 10min",
        "15min": "Alert: 15min",
        "30min": "Alert: 30min",
        "1hr": "Alert: 1hr",
      }[taskSearchFilters.alert]

      chips.push({ key: "alert", label: alertLabel, clear: () => setTaskSearchFilters({ alert: "all" }) })
    }

    if (taskSearchFilters.dateAdded !== "all") {
      const labelsByValue: Record<string, string> = {
        today: "Date Added: Today",
        yesterday: "Date Added: Yesterday",
        "this-week": "Date Added: This Week",
      }
      chips.push({ key: "date-added", label: labelsByValue[taskSearchFilters.dateAdded], clear: () => setTaskSearchFilters({ dateAdded: "all" }) })
    }

    return chips
  }, [activeFilterColor, labelFilterIds, labels, searchQuery, setActiveFilterColor, setLabelFilterIds, setSearchQuery, setTaskSearchFilters, taskSearchFilters])

  const quickAddSettingChipClass =
    "flex shrink-0 items-center gap-1 rounded-full border border-border/55 bg-background/75 px-1.5 py-0.5 text-[9px] font-extrabold leading-none tracking-[0.09em] text-foreground"
  const quickAddSettingChipClearClass =
    "ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"

  return (
    <header
      className="lemonade-header flex w-full items-center"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div ref={quickAddBoundaryRef} data-quick-add-surface="true" className="relative w-full">
        <div
          className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-full border border-border/45 bg-background/55 px-3 py-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.42)]"
          onMouseDown={(event) => {
            if (searchModeActive) return
            const target = event.target as HTMLElement
            if (target.closest("button")) return
            openQuickAdd()
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (searchModeActive) {
                clearSearchMode()
              } else {
                openSearchMode()
              }
            }}
            className={cn(
              isMobile ? "size-10 rounded-full text-muted-foreground hover:text-foreground" : "size-8 rounded-full text-muted-foreground hover:text-foreground",
              searchModeActive && "text-foreground"
            )}
            aria-label={searchModeActive ? "Exit search" : "Search tasks"}
            title={searchModeActive ? "Exit search" : "Search tasks"}
          >
            <Search className="size-4" />
          </Button>

          <Input
            ref={quickAddInputRef}
            placeholder={searchModeActive ? "Search tasks..." : "Add tasks here in natural language"}
            value={searchModeActive ? searchQuery : quickAddText}
            onChange={(event) => {
              if (searchModeActive) {
                setSearchQuery(event.target.value)
              } else {
                setQuickAddText(event.target.value)
                setParsedPreview(null)
                parseRequestIdRef.current += 1
              }
            }}
            onFocus={() => {
              if (!searchModeActive) {
                openQuickAdd()
              }
            }}
            onKeyDown={(event) => {
              if (searchModeActive) {
                if (event.key === "Enter") {
                  event.preventDefault()
                } else if (event.key === "Escape") {
                  clearSearchMode()
                }
                return
              }

              if (event.key === "Enter") {
                event.preventDefault()
                handleQuickAddSubmit()
              } else if (event.key === "Escape") {
                closeQuickAdd()
              }
            }}
            className={cn(
              "h-auto min-w-[96px] flex-[0_1_210px] rounded-full border-0 bg-transparent py-0 pl-1 pr-0 text-[14px] text-foreground shadow-none focus-visible:ring-0 sm:min-w-[130px] sm:max-w-[260px]",
              isMobile && "text-[15px]"
            )}
          />

          {!searchModeActive && (activeDestinationLabel || activeDurationLabel || activeTimeLabel || activeRecurringLabel) ? (
            <div
              tabIndex={0}
              aria-label="Selected task settings"
              className="flex max-w-[min(28vw,220px)] flex-none items-center gap-1 overflow-x-auto overscroll-x-contain pr-1 outline-none [scrollbar-width:none] focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[min(32vw,260px)] [&::-webkit-scrollbar]:hidden"
            >
              {activeDestinationLabel ? (
                <div className={cn(quickAddSettingChipClass, "bg-muted/80")}>
                  <span>→</span>
                  <span>{activeDestinationLabel}</span>
                  <button
                    type="button"
                    className={quickAddSettingChipClearClass}
                    onClick={clearDraftDestination}
                    aria-label="Clear destination"
                    title="Clear destination"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ) : null}

              {activeDurationLabel ? (
                <div className={quickAddSettingChipClass}>
                  <Timer className="size-2.5" />
                  <span>{activeDurationLabel}</span>
                  <button
                    type="button"
                    className={quickAddSettingChipClearClass}
                    onClick={() => {
                      setDraftDurationMinutes(null)
                      setDraftDurationCustomValue("")
                    }}
                    aria-label="Clear duration"
                    title="Clear duration"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ) : null}

              {activeTimeLabel ? (
                <div className={quickAddSettingChipClass}>
                  <Clock3 className="size-2.5" />
                  <span>{activeTimeLabel}</span>
                  <button
                    type="button"
                    className={quickAddSettingChipClearClass}
                    onClick={() => setDraftTime("")}
                    aria-label="Clear time"
                    title="Clear time"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ) : null}

              {activeRecurringLabel ? (
                <div className={quickAddSettingChipClass}>
                  <RotateCcw className="size-2.5" />
                  <span className="max-w-[110px] truncate">{activeRecurringLabel}</span>
                  <button
                    type="button"
                    className={quickAddSettingChipClearClass}
                    onClick={clearDraftRecurring}
                    aria-label="Clear recurring"
                    title="Clear recurring"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex max-w-[126px] flex-none items-center gap-1 overflow-x-auto overscroll-x-contain pl-1 [scrollbar-width:none] sm:max-w-[138px] [&::-webkit-scrollbar]:hidden">
              {!searchModeActive && quickAddText.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void handleQuickAddSubmit()
                  }}
                  disabled={submitting}
                  className={cn(
                    isMobile ? "size-10 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50" : "size-9 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
                  )}
                  aria-label="Add task"
                  title="Add task"
                >
                  <Check className="size-4" />
                </Button>
              ) : null}
          </div>

          <div className="ml-auto flex-none flex items-center gap-0.5">
            {searchModeActive ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchFiltersExpanded((current) => !current)}
                  className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={searchFiltersExpanded ? "Collapse filters" : "Expand filters"}
                  title={searchFiltersExpanded ? "Collapse filters" : "Expand filters"}
                >
                  <ChevronDown className={cn("size-4 transition-transform", searchFiltersExpanded && "rotate-180")} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearSearchMode}
                  className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Exit search mode"
                  title="Exit search mode"
                >
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (quickAddExpanded) {
                    closeQuickAdd()
                  } else {
                    openQuickAdd()
                  }
                }}
                className={cn(
                  isMobile ? "size-10 rounded-full text-muted-foreground hover:text-foreground" : "size-9 rounded-full text-muted-foreground hover:text-foreground"
                )}
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
                    setShortcutPickerMonth(parseLocalDateKey(draftDateKey ?? formatLocalDateKey(new Date())))
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      isMobile ? "size-10 rounded-full text-muted-foreground hover:text-foreground" : "size-9 rounded-full text-muted-foreground hover:text-foreground",
                      (draftDateTouched || draftListTarget !== null) && "text-foreground"
                    )}
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
                  data-quick-add-surface="true"
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
                        applyDraftDateSelection(formatLocalDateKey(date), null, { closeDatePopover: true })
                      }}
                      initialFocus
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {draftDateShortcutOptions.map((option) => {
                        const active = draftDateKey === option.dateKey
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => {
                              applyDraftDateSelection(option.dateKey, option.listTarget ?? null, { closeDatePopover: true })
                            }}
                            className={cn(
                              "rounded-lg border border-border/70 px-2 py-2 text-[12px] transition-colors hover:bg-muted",
                              active && "border-transparent bg-foreground text-background hover:bg-foreground"
                            )}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>

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
                        onClick={() => applyDraftDateSelection(null, "someday", { closeDatePopover: true })}
                      >
                        Someday
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setShowShortcutDatePopover(false)
                          focusQuickAddInput()
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              </>
            )}
          </div>
        </div>

        {parsedPreview && !searchModeActive ? (
          <div
            data-quick-add-surface="true"
            className={cn(
              "absolute left-0 right-0 top-full z-50 mt-2",
              "rounded-2xl border border-border/45 bg-background/95 p-4 text-foreground shadow-[0_14px_40px_rgba(0,0,0,0.14)] backdrop-blur-[14px]",
              "dark:bg-[rgba(19,19,19,0.92)]"
            )}
          >
            <div className="space-y-1 text-[13px] leading-5">
              <div className="font-medium">📋 {parsedPreview.title}</div>
              {parsedPreview.phone ? (
                <div className="text-muted-foreground">📞 {parsedPreview.phone}</div>
              ) : null}
              {parsedPreview.url ? (
                <div className="text-muted-foreground">🔗 {parsedPreview.url}</div>
              ) : null}
              {parsedPreview.location ? (
                <div className="text-muted-foreground">📍 {parsedPreview.location}</div>
              ) : null}
              <div className="text-muted-foreground">📅 {parsedPreviewDateLabel}</div>
              {parsedPreview.time ? (
                <div className="text-muted-foreground">🕒 {parsedPreview.time}</div>
              ) : null}
              {parsedPreviewDurationLabel ? (
                <div className="text-muted-foreground">⏱ {parsedPreviewDurationLabel}</div>
              ) : null}
              {parsedPreviewReminderLabel ? (
                <div className="text-muted-foreground">🔔 {parsedPreviewReminderLabel}</div>
              ) : null}
              {parsedPreview.notes ? (
                <div className="text-muted-foreground">📝 {parsedPreview.notes}</div>
              ) : null}
              {parsedPreview.attachment ? (
                <div className="text-muted-foreground">📎 {parsedPreview.attachment}</div>
              ) : null}
              <div className="text-muted-foreground">
                ⚡ {parsedPreview.priority.charAt(0).toUpperCase() + parsedPreview.priority.slice(1)} priority
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full px-3 text-[12px]"
                onClick={() => createTaskFromParsedPreview(parsedPreview)}
              >
                ✓ Add task
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-[12px]"
                onClick={handleEditParsedPreview}
              >
                ✗ Edit
              </Button>
            </div>
          </div>
        ) : null}

        {searchModeActive ? (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-[12px] text-foreground">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={searchStatusChecks.done}
                    onChange={(event) => updateSearchStatus(event.target.checked, searchStatusChecks.todo)}
                    className="size-3.5 rounded border-border"
                  />
                  <span>Done</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={searchStatusChecks.todo}
                    onChange={(event) => updateSearchStatus(searchStatusChecks.done, event.target.checked)}
                    className="size-3.5 rounded border-border"
                  />
                  <span>To Do</span>
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchFiltersExpanded((current) => !current)}
                className="h-8 rounded-full px-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                Filters
                <ChevronDown className={cn("ml-1 size-3.5 transition-transform", searchFiltersExpanded && "rotate-180")} />
              </Button>
            </div>

            {searchFiltersExpanded ? (
              <div
                className="mt-2 space-y-3 rounded-[24px] border border-border/35 bg-background/50 px-4 py-4 backdrop-blur-[8px] dark:bg-[rgba(19,19,19,0.34)]"
                style={{ maxHeight: "min(360px, calc(100vh - 220px))", overflowY: "auto", scrollbarWidth: "thin" }}
              >
                {hasActiveSearchFilters ? (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("")
                        resetTaskSearchFilters()
                        setLabelFilterIds([])
                        setActiveFilterColor(null)
                      }}
                      className="rounded-full border border-border/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="max-h-[220px] space-y-4 overflow-y-auto rounded-[22px] border border-border/55 bg-[rgba(255,255,255,0.56)] p-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.34)]" style={{ scrollbarWidth: "thin" }}>
                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">When?</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["today", "Today"],
                          ["tomorrow", "Tomorrow (Next Day)"],
                          ["this-week", "This Week"],
                          ["next-week", "Next Week"],
                          ["this-month", "This Month"],
                          ["next-month", "Next Month"],
                          ["this-year", "This Year"],
                          ["someday", "Someday"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ when: value as typeof taskSearchFilters.when })} className={optionRowClass(taskSearchFilters.when === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Recurring?</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["yes", "Yes"],
                          ["no", "No"],
                          ["both", "Both"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ recurring: value as typeof taskSearchFilters.recurring })} className={optionRowClass(taskSearchFilters.recurring === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Date Added</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["today", "Today"],
                          ["yesterday", "Yesterday"],
                          ["this-week", "This Week"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ dateAdded: value as typeof taskSearchFilters.dateAdded })} className={optionRowClass(taskSearchFilters.dateAdded === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="max-h-[220px] space-y-4 overflow-y-auto rounded-[22px] border border-border/55 bg-[rgba(255,255,255,0.56)] p-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.34)]" style={{ scrollbarWidth: "thin" }}>
                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Priority?</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["high", "High"],
                          ["med", "Med"],
                          ["low", "Low"],
                          ["none", "None"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ priority: value as typeof taskSearchFilters.priority })} className={optionRowClass(taskSearchFilters.priority === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Label</div>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        <button type="button" onClick={() => setLabelFilterIds([])} className={optionRowClass(labelFilterIds.length === 0)}>
                          <span>All</span>
                        </button>
                        {labels.map((label) => (
                          <button key={label.id} type="button" onClick={() => setLabelFilterIds([label.id])} className={optionRowClass(labelFilterIds.includes(label.id))}>
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
                              <span>{label.name}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Color</div>
                      <div className="space-y-2">
                        <button type="button" onClick={() => setActiveFilterColor(null)} className={optionRowClass(activeFilterColor === null)}>
                          <span>All</span>
                        </button>
                        <div className="flex flex-wrap gap-2 px-1">
                          {allTaskColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setActiveFilterColor(color)}
                              className={cn("size-7 rounded-full border-2 transition-transform hover:scale-105", activeFilterColor === color ? "border-foreground" : "border-transparent")}
                              style={{ backgroundColor: color }}
                              aria-label={`Filter by ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Icon?</div>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        <button type="button" onClick={() => setTaskSearchFilters({ icon: null })} className={optionRowClass(taskSearchFilters.icon === null)}>
                          <span>All</span>
                        </button>
                        {TASK_ICON_LIBRARY.map((icon) => (
                          <button key={icon.key} type="button" onClick={() => setTaskSearchFilters({ icon: icon.key })} className={optionRowClass(taskSearchFilters.icon === icon.key)}>
                            <span>{icon.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="max-h-[220px] space-y-4 overflow-y-auto rounded-[22px] border border-border/55 bg-[rgba(255,255,255,0.56)] p-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.34)]" style={{ scrollbarWidth: "thin" }}>
                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Phone?</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["yes", "Yes"],
                          ["no", "No"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ phone: value as typeof taskSearchFilters.phone })} className={optionRowClass(taskSearchFilters.phone === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">URL?</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["yes", "Yes"],
                          ["no", "No"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ url: value as typeof taskSearchFilters.url })} className={optionRowClass(taskSearchFilters.url === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Attachment?</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["yes", "Yes"],
                          ["no", "No"],
                          ["both", "Both"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ attachment: value as typeof taskSearchFilters.attachment })} className={optionRowClass(taskSearchFilters.attachment === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground">Alert</div>
                      <div className="space-y-1">
                        {[
                          ["all", "All"],
                          ["none", "None"],
                          ["5min", "5min"],
                          ["10min", "10min"],
                          ["15min", "15min"],
                          ["30min", "30min"],
                          ["1hr", "1hr"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTaskSearchFilters({ alert: value as typeof taskSearchFilters.alert })} className={optionRowClass(taskSearchFilters.alert === value)}>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                {hasActiveSearchFilters ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFilterChips.map((chip) => (
                      <button key={chip.key} type="button" onClick={chip.clear} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground hover:bg-muted/80">
                        <span>{chip.label}</span>
                        <X className="size-3" />
                      </button>
                    ))}
                    <button type="button" onClick={() => {
                      setSearchQuery("")
                      resetTaskSearchFilters()
                      setLabelFilterIds([])
                      setActiveFilterColor(null)
                    }} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
                      Clear all
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Expanded panel */}
        {!searchModeActive && quickAddExpanded && !parsedPreview ? (
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
                <div className="flex flex-col items-end gap-1 text-muted-foreground">
                  {draftDateShortcutOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      className={cn(
                        "inline-flex w-auto items-center justify-end whitespace-nowrap rounded-lg px-2 py-1.5 text-right text-[12px] transition-colors hover:bg-muted",
                        draftDateKey === option.dateKey && "bg-muted"
	                      )}
	                      onClick={() => {
	                        applyDraftDateSelection(option.dateKey, option.listTarget ?? null)
	                      }}
                    >
                      <span className="text-foreground">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="my-4 h-px w-full bg-border/50" />

            {/* Bottom: action icons (functional) */}
            <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
              {/* 1) Time */}
              <Popover open={showTimePopover} onOpenChange={setShowTimePopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftTime.trim() && "text-foreground")}
                    aria-label="Set time"
                  >
                    <Clock3 className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  data-quick-add-surface="true"
                  className="z-50 w-[240px] rounded-2xl border border-border/60 bg-background/96 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.10)]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Time
                      </div>
                      {draftTime.trim() ? (
                        <button
                          type="button"
                          onClick={() => setDraftTime("")}
                          className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {QUICK_ADD_TIME_OPTIONS.map((timeValue) => {
                        const active = draftTime === timeValue
                        return (
                          <button
                            key={timeValue}
                            type="button"
                            onClick={() => {
                              setDraftTime(timeValue)
                              setShowTimePopover(false)
                            }}
                            className={cn(
                              "rounded-full px-2 py-2 text-[11px] font-medium transition-colors",
                              active
                                ? "bg-foreground text-background"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {formatTimeDisplayLabel(timeValue)}
                          </button>
                        )
                      })}
                    </div>

                    <div className="space-y-2 rounded-2xl bg-muted/35 p-2.5">
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Custom
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={draftTime}
                          onChange={(event) => setDraftTime(event.target.value)}
                          className="h-8 border-0 bg-background/80 text-[12px] shadow-none focus-visible:ring-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-3 text-[11px] font-medium text-foreground hover:bg-background"
                          onClick={() => setShowTimePopover(false)}
                        >
                          Done
                        </Button>
                      </div>
                      {draftTime.trim() ? (
                        <div className="text-[11px] text-muted-foreground">
                          Selected: {formatTimeDisplayLabel(draftTime)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 2) Alert/Reminder */}
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
                  data-quick-add-surface="true"
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

              {/* 3) Duration */}
              <Popover open={showDurationPopover} onOpenChange={setShowDurationPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftDurationMinutes !== null && "text-foreground")}
                    aria-label="Set duration"
                  >
                    <Timer className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  data-quick-add-surface="true"
                  className="z-50 w-[240px] rounded-2xl border border-border/60 bg-background/96 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.10)]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Duration
                      </div>
                      {draftDurationMinutes !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftDurationMinutes(null)
                            setDraftDurationCustomValue("")
                          }}
                          className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {QUICK_ADD_DURATION_OPTIONS.map((minutes) => {
                        const active = draftDurationMinutes === minutes
                        return (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => {
                              setDraftDurationMinutes(minutes)
                              setDraftDurationCustomValue(String(minutes))
                              setShowDurationPopover(false)
                            }}
                            className={cn(
                              "rounded-full px-2 py-2 text-[11px] font-medium transition-colors",
                              active
                                ? "bg-foreground text-background"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {formatDurationBadgeLabel(minutes)}
                          </button>
                        )
                      })}
                    </div>

                    <div className="space-y-2 rounded-2xl bg-muted/35 p-2.5">
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Custom
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="15min, 1hr, 1:30"
                          value={draftDurationCustomValue}
                          onChange={(event) => setDraftDurationCustomValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              const minutes = parseDurationInput(draftDurationCustomValue)
                              if (minutes === null) {
                                toast("Invalid duration", { duration: 2000 })
                                return
                              }
                              setDraftDurationMinutes(minutes)
                              setDraftDurationCustomValue(formatDurationLabel(minutes))
                              setShowDurationPopover(false)
                            }
                          }}
                          className="h-8 border-0 bg-background/80 text-[12px] shadow-none focus-visible:ring-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-3 text-[11px] font-medium text-foreground hover:bg-background"
                          onClick={() => {
                            const minutes = parseDurationInput(draftDurationCustomValue)
                            if (minutes === null) {
                              toast("Invalid duration", { duration: 2000 })
                              return
                            }
                            setDraftDurationMinutes(minutes)
                            setDraftDurationCustomValue(formatDurationLabel(minutes))
                            setShowDurationPopover(false)
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                      {draftDurationMinutes !== null ? (
                        <div className="text-[11px] text-muted-foreground">
                          Selected: {formatDurationLabel(draftDurationMinutes)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 4) Recurring */}
              <Popover open={showRecurringPopover} onOpenChange={setShowRecurringPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftRecurring && "text-foreground")}
                    aria-label="Set recurring"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  data-quick-add-surface="true"
                  className="z-50 w-[240px] rounded-2xl border border-border/60 bg-background/96 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.10)]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Recurring
                      </div>
                      {draftRecurring ? (
                        <button
                          type="button"
                          onClick={() => {
                            clearDraftRecurring()
                            setShowRecurringPopover(false)
                          }}
                          className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {QUICK_ADD_RECURRING_OPTIONS.map((option) => {
                        const active = draftRecurring === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => applyDraftRecurringPreset(option.value)}
                            className={cn(
                              "rounded-full px-2 py-2 text-[11px] font-medium transition-colors",
                              active
                                ? "bg-foreground text-background"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="rounded-2xl bg-muted/35 p-2.5 text-[11px] leading-5 text-muted-foreground">
                      Weekly and monthly repeats use the selected task date as the anchor.
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-2.5 shadow-inner">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                        Custom
                      </div>
                      <Input
                        placeholder="Every Tue and Thu, every 2 weeks, monthly on 15th"
                        value={draftRecurringCustomValue}
                        onChange={(event) => setDraftRecurringCustomValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            applyDraftCustomRecurrence()
                          }
                        }}
                        className="h-10 rounded-xl border border-border/80 bg-background px-3 text-[12px] text-foreground shadow-sm placeholder:text-muted-foreground/80 focus-visible:border-foreground/50 focus-visible:ring-2 focus-visible:ring-ring/30"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-full rounded-full px-3 text-[11px] font-medium text-foreground hover:bg-background"
                        onClick={applyDraftCustomRecurrence}
                      >
                        Apply custom repeat
                      </Button>
                      {draftRecurringCustomText ? (
                        <div className="text-[11px] text-muted-foreground">
                          Selected: {draftRecurringCustomText}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 5) Subtask */}
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

              {/* 6) URL / Phone */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNoteInput((open) => !open)}
                className={cn(
                  "h-8 rounded-full px-2.5 text-muted-foreground hover:text-foreground",
                  draftNoteText.trim() && "text-foreground"
                )}
                aria-label="Add note"
                title="Note"
              >
                <NotebookPen className="mr-1.5 size-4" />
                <span className="text-[11px] font-medium">Note</span>
              </Button>

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

              {/* 7) Urgency */}
              <Popover open={showPriorityPopover} onOpenChange={setShowPriorityPopover}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 hover:text-foreground", draftPriority !== "normal" && "text-foreground")}
                    aria-label="Set urgency"
                  >
                    <AlertTriangle className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  data-quick-add-surface="true"
                  className="z-50 w-[220px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                >
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Urgency
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["urgent", "important", "normal"] as const).map((p) => (
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

              {/* 8) Label */}
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
                  data-quick-add-surface="true"
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
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      placeholder="New label"
                      value={draftNewLabelName}
                      onChange={(event) => setDraftNewLabelName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          handleCreateDraftLabel()
                        }
                      }}
                      className="h-8 text-[12px]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-[11px]"
                      onClick={handleCreateDraftLabel}
                      disabled={!draftNewLabelName.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 9) Color */}
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
                  data-quick-add-surface="true"
                  className="z-50 max-h-[70vh] w-[320px] overflow-y-auto border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                >
                  <ColorPickerPanel
                    value={draftColor}
                    palette={preferences.colorPalette}
                    onChange={(color) => {
                      setDraftColor(color)
                    }}
                    onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                    onClear={() => setDraftColor(undefined)}
                    title="Color"
                    description="Pick a color from the wheel or choose a saved swatch."
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full px-3 text-[11px] font-medium"
                      onClick={() => setShowDraftColorPopover(false)}
                    >
                      Done
                    </Button>
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
                className={cn("size-8 hover:text-foreground", (draftAttachments.length > 0 || isReadingAttachments) && "text-foreground")}
                aria-label="Attach files"
                title="Attach files"
              >
                <Paperclip className="size-4" />
              </Button>
            </div>

            {showNoteInput ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  placeholder="Add a note"
                  value={draftNoteText}
                  onChange={(event) => setDraftNoteText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setShowNoteInput(false)
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDraftNoteText("")
                    setShowNoteInput(false)
                  }}
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="Close note input"
                  title="Close note"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : null}

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

            {draftAttachments.length > 0 || isReadingAttachments ? (
              <div className="mt-2 rounded-2xl border border-border/70 bg-background/75 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Attachments
                  </div>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="text-[10px] font-medium text-foreground/75 hover:text-foreground"
                  >
                    Add another
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draftAttachments.map((attachment) => {
                    const sizeLabel = formatAttachmentSize(attachment.size)

                    return (
                      <span
                        key={attachment.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/55 px-2 py-1 text-[11px] text-foreground"
                      >
                        <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                        <span className="max-w-[180px] truncate">{attachment.name}</span>
                        {sizeLabel ? <span className="text-[10px] text-muted-foreground">{sizeLabel}</span> : null}
                        <button
                          type="button"
                          onClick={() => removeDraftAttachment(attachment.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${attachment.name}`}
                          title="Remove attachment"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )
                  })}
                  {isReadingAttachments ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
                      <Paperclip className="size-3" />
                      Uploading...
                    </span>
                  ) : null}
                </div>
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

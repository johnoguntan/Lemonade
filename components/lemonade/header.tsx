"use client"

import {
  X,
  ChevronDown,
  Bell,
  Check,
  Link2,
  Paperclip,
  ListChecks,
  Palette,
  Calendar as CalendarIcon,
  Tag,
  AlertTriangle,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { aiParseSingleTask, type AiParsedTask } from "@/lib/ai-task-parser"
import { ColorPickerPanel } from "./color-picker-panel"
import {
  DEFAULT_TASK_SEARCH_FILTERS,
  createOptimisticTodoId,
  formatLocalDateKey,
  parseLocalDateKey,
  useLemonadeStore,
} from "@/lib/store"
import { format, isValid, parseISO } from "date-fns"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { TASK_ICON_LIBRARY } from "@/lib/task-icons"

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

const optionRowClass = (active: boolean) =>
  cn(
    "flex w-full items-center justify-center rounded-lg px-3 py-2 text-center text-[12px] transition-colors",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  )

export function Header({ onNavigate: _onNavigate, viewMode: _viewMode, onViewModeChange: _onViewModeChange }: HeaderProps) {
  const {
    addCalendarTodo,
    ensureLabelIds,
    labels,
    calendarTodos,
    lists,
    selectedCalendarDate,
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
  const [quickAddText, setQuickAddText] = useState("")
  const [quickAddExpanded, setQuickAddExpanded] = useState(false)
  const [draftDateKey, setDraftDateKey] = useState<string | null>(selectedCalendarDate)
  const [draftDateTouched, setDraftDateTouched] = useState(false)
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
  const [draftPriority, setDraftPriority] = useState<"urgent" | "important" | "normal">("normal")
  const [showLabelPopover, setShowLabelPopover] = useState(false)
  const [draftLabelIds, setDraftLabelIds] = useState<string[]>([])
  const [showDraftColorPopover, setShowDraftColorPopover] = useState(false)
  const [draftColor, setDraftColor] = useState<string | undefined>(undefined)
  const [showShortcutDatePopover, setShowShortcutDatePopover] = useState(false)
  const [parsedPreview, setParsedPreview] = useState<AiParsedTask | null>(null)
  const [editingParsedTask, setEditingParsedTask] = useState<AiParsedTask | null>(null)
  const [searchFiltersExpanded, setSearchFiltersExpanded] = useState(false)
  const quickAddBoundaryRef = useRef<HTMLDivElement>(null)
  const parseRequestIdRef = useRef(0)
  const currentDate = parseLocalDateKey(selectedCalendarDate)
  const [shortcutPickerMonth, setShortcutPickerMonth] = useState<Date>(currentDate)

  const selectDraftDate = useCallback((dateKey: string | null) => {
    setDraftDateKey(dateKey)
    setDraftDateTouched(true)
  }, [])

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
      { label: "This Week", dateKey: formatLocalDateKey(base) },
      { label: "Next Week", dateKey: formatLocalDateKey(nextWeekStart) },
      { label: "This Month", dateKey: formatLocalDateKey(base) },
      { label: "Next Month", dateKey: formatLocalDateKey(new Date(base.getFullYear(), base.getMonth() + 1, 1)) },
      { label: "This Year", dateKey: formatLocalDateKey(base) },
      { label: "Someday", dateKey: null },
    ]
  }, [])

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
    setDraftPriority("normal")
    setShowLabelPopover(false)
    setDraftLabelIds([])
    setShowDraftColorPopover(false)
    setDraftColor(undefined)
    setParsedPreview(null)
    setEditingParsedTask(null)
  }, [])

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
    setDraftDateKey(selectedCalendarDate)
    setDraftDateTouched(false)
    setDraftTime("")
    setShowShortcutDatePopover(false)
  }, [resetPerTaskDraft, selectedCalendarDate])

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

  const getResolvedParsedDate = (task: AiParsedTask) =>
    draftDateTouched ? draftDateKey : task.date

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

  const createTaskFromParsedPreview = (task: AiParsedTask) => {
    const title = task.title.trim()
    if (!title) return

    const parsedLabelIds = ensureLabelIds(task.labels)
    const labelIds = Array.from(new Set([...parsedLabelIds, ...draftLabelIds]))
    const notes = [task.notes, draftNotes].filter(Boolean).join("\n").trim()

    addCalendarTodo({
      id: createOptimisticTodoId("header"),
      text: title,
      completed: false,
      date: getResolvedParsedDate(task),
      time: task.time ?? (draftTime.trim() ? draftTime.trim() : undefined),
      isHeading: title === title.toUpperCase() && title.length > 2,
      priority: draftPriority !== "normal" ? draftPriority : task.priority,
      labelIds,
      subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
      color: draftColor,
      notes: notes || undefined,
      url: task.url ?? undefined,
      location: task.location ?? undefined,
      durationMinutes: task.duration ?? undefined,
      reminderOffsetMinutes: task.reminder ?? draftReminderOffsetMinutes,
      isRecurring: task.recurring !== null,
      recurringFrequency:
        task.recurring === "daily" || task.recurring === "weekly" || task.recurring === "monthly"
          ? task.recurring
          : undefined,
      recurringCustomText:
        task.recurring === "yearly"
          ? "yearly"
          : task.recurringDay
            ? `every ${task.recurringDay}`
            : undefined,
      isSyncing: false,
      syncStatus: undefined,
    })

    setQuickAddText("")
    resetPerTaskDraft()
    setDraftDateTouched(false)
    parseRequestIdRef.current += 1
  }

  const createTaskFromEditedParsedDraft = (task: AiParsedTask) => {
    const title = quickAddText.trim()
    if (!title) return

    const parsedLabelIds = ensureLabelIds(task.labels)
    const labelIds = Array.from(new Set([...parsedLabelIds, ...draftLabelIds]))
    const notes = [task.notes, draftNotes].filter(Boolean).join("\n").trim()
    const trimmedLink = draftLink.trim()

    addCalendarTodo({
      id: createOptimisticTodoId("header"),
      text: title,
      completed: false,
      date: draftDateKey,
      time: draftTime.trim() ? draftTime.trim() : undefined,
      isHeading: title === title.toUpperCase() && title.length > 2,
      priority: draftPriority,
      labelIds,
      subtasks: draftSubtasks.map((subtaskTitle) => ({ title: subtaskTitle })),
      color: draftColor,
      notes: notes || undefined,
      url: trimmedLink || task.url || undefined,
      location: task.location ?? undefined,
      durationMinutes: task.duration ?? undefined,
      reminderOffsetMinutes: draftReminderOffsetMinutes,
      isRecurring: task.recurring !== null,
      recurringFrequency:
        task.recurring === "daily" || task.recurring === "weekly" || task.recurring === "monthly"
          ? task.recurring
          : undefined,
      recurringCustomText:
        task.recurring === "yearly"
          ? "yearly"
          : task.recurringDay
            ? `every ${task.recurringDay}`
            : undefined,
      isSyncing: false,
      syncStatus: undefined,
    })

    setQuickAddText("")
    resetPerTaskDraft()
    setDraftDateTouched(false)
    parseRequestIdRef.current += 1
  }

  const handleEditParsedPreview = () => {
    if (!parsedPreview) return

    setQuickAddText(parsedPreview.title)
    setDraftDateKey(getResolvedParsedDate(parsedPreview))
    setDraftTime(parsedPreview.time ?? "")
    setDraftPriority(parsedPreview.priority)
    setDraftReminderOffsetMinutes(parsedPreview.reminder)
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

    if (parsedPreview) {
      createTaskFromParsedPreview(parsedPreview)
      return
    }

    if (editingParsedTask) {
      createTaskFromEditedParsedDraft(editingParsedTask)
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
        notes: draftNotes,
        reminderOffsetMinutes: draftReminderOffsetMinutes,
        isSyncing: false,
        syncStatus: undefined,
      })

      setQuickAddText("")
      resetPerTaskDraft()
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), AI_PARSE_TIMEOUT_MS)
    const requestId = parseRequestIdRef.current + 1
    parseRequestIdRef.current = requestId

    void aiParseSingleTask(rawInputString, controller.signal)
      .then((task) => {
        if (parseRequestIdRef.current !== requestId) return
        setParsedPreview(task)
        setQuickAddExpanded(true)
      })
      .catch(() => {
        if (parseRequestIdRef.current !== requestId) return
        toast("Couldn't parse that — please try again or add manually", { duration: 3000 })
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
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

  return (
    <header
      className="lemonade-header flex w-full items-center"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div ref={quickAddBoundaryRef} data-quick-add-surface="true" className="relative w-full">
        <div
          className="flex w-full items-center gap-2 rounded-full border border-border/45 bg-background/55 px-4 py-3 backdrop-blur-[10px] dark:bg-[rgba(19,19,19,0.42)]"
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
            className={cn("size-8 rounded-full text-muted-foreground hover:text-foreground", searchModeActive && "text-foreground")}
            aria-label={searchModeActive ? "Exit search" : "Search tasks"}
            title={searchModeActive ? "Exit search" : "Search tasks"}
          >
            <Search className="size-4" />
          </Button>

          <Input
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
                handleQuickAddSubmit()
              } else if (event.key === "Escape") {
                closeQuickAdd()
              }
            }}
            className="h-auto w-full min-w-0 flex-1 rounded-full border-0 bg-transparent px-0 py-0 text-[14px] text-foreground shadow-none focus-visible:ring-0"
          />

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
                  void handleQuickAddSubmit()
                }}
                disabled={!quickAddText.trim()}
                className="size-9 rounded-full text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Add task"
                title="Add task"
              >
                <Check className="size-4" />
              </Button>

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
                    className={cn("size-9 rounded-full text-muted-foreground hover:text-foreground", draftDateKey !== selectedCalendarDate && "text-foreground")}
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
                        selectDraftDate(formatLocalDateKey(date))
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
                            onClick={() => selectDraftDate(option.dateKey)}
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
                        onClick={() => selectDraftDate(null)}
                      >
                        Someday
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
            </>
          )}
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
              {parsedPreview.location ? (
                <div className="text-muted-foreground">📍 {parsedPreview.location}</div>
              ) : null}
              <div className="text-muted-foreground">📅 {parsedPreviewDateLabel}</div>
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
                      onClick={() => selectDraftDate(option.dateKey)}
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

              {/* 5) Label */}
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
                  data-quick-add-surface="true"
                  className="z-50 max-h-[70vh] w-[320px] overflow-y-auto border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
                >
                  <ColorPickerPanel
                    value={draftColor}
                    palette={preferences.colorPalette}
                    onChange={(color) => {
                      setDraftColor(color)
                      setShowDraftColorPopover(false)
                    }}
                    onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                    onClear={() => setDraftColor(undefined)}
                    title="Color"
                    description="Pick a color from the wheel or choose a saved swatch."
                  />
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

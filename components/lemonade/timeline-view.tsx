"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createOptimisticTodoId, localTaskParser, normalizeCalendarDateKey, normalizeTodoPriority, parseNaturalLanguageTaskEntries, reconcileOptimisticTaskOrder, todoMatchesSearchFilters, useLemonadeStore, type Todo } from "@/lib/store"
import { getPlannerTaskDragData, setPlannerTaskDragData } from "@/lib/task-dnd"
import { cn } from "@/lib/utils"
import { format, isValid, parseISO } from "date-fns"
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Flag, GripVertical, PencilLine, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface TimelineViewProps {
  date: Date
  onNavigate: (direction: "prev-day" | "next-day" | "today") => void
}

const AI_PARSE_TIMEOUT_MS = 15000
const splitNaturalTitleFallback = (input: string, index: number) =>
  input
    .split(/\s*(?:,|and then|after that|also|plus|then)\s*/i)
    .map((fragment) => fragment.trim())
    .filter(Boolean)[index] ?? input.trim()

const HOUR_HEIGHT = 64
const DEFAULT_DURATION_MINUTES = 30
const MIN_BLOCK_HEIGHT = 46
const MIN_DURATION_MINUTES = 15
const MAX_DURATION_MINUTES = 24 * 60
const SNAP_INTERVAL_MINUTES = 15
const TIMELINE_LEFT_GUTTER = 96
const TIMELINE_RIGHT_GUTTER = 16
const OVERLAP_GAP_PX = 8

type DragInteraction =
  | {
      mode: "move"
      todoId: string
      startClientY: number
      originStartMinutes: number
      originDurationMinutes: number
    }
  | {
      mode: "resize"
      todoId: string
      startClientY: number
      originStartMinutes: number
      originDurationMinutes: number
    }

type TimedTodoLayoutEntry = {
  todo: Todo
  startMinutes: number
  durationMinutes: number
  absoluteStart: number
  absoluteEnd: number
  column: number
  maxColumns: number
}

const formatHourLabel = (hour: number) => {
  const normalizedHour = ((hour % 24) + 24) % 24
  const suffix = normalizedHour >= 12 ? "PM" : "AM"
  const normalized = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12
  return `${normalized}:00 ${suffix}`
}

const parseTimeToMinutes = (value?: string) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()

  if (normalized === "morning") return 9 * 60
  if (normalized === "noon") return 12 * 60
  if (normalized === "evening") return 18 * 60
  if (normalized === "tonight") return 21 * 60

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHourMatch) {
    const hours = Number.parseInt(twentyFourHourMatch[1], 10)
    const minutes = Number.parseInt(twentyFourHourMatch[2], 10)
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
      return null
    }
    return hours * 60 + minutes
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (!match) {
    return null
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2] ?? "0", 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  const baseHour = hours % 12
  return (match[3] === "pm" ? baseHour + 12 : baseHour) * 60 + minutes
}

const formatTimeToken = (minutes: number) => {
  const normalizedMinutes = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const hours24 = Math.floor(normalizedMinutes / 60)
  const minutesPart = normalizedMinutes % 60
  const suffix = hours24 >= 12 ? "pm" : "am"
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return minutesPart === 0
    ? `${hours12}${suffix}`
    : `${hours12}:${`${minutesPart}`.padStart(2, "0")}${suffix}`
}

const formatHeadingDate = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const resolveTimelineBounds = (startHour: number, endHour: number) => {
  const start = startHour * 60
  const end = (endHour <= startHour ? endHour + 24 : endHour) * 60
  return { start, end }
}

const resolveDisplayMinutes = (minutes: number, rangeStart: number, rangeEnd: number) => {
  const nextDayMinutes = minutes + 24 * 60

  if (minutes >= rangeStart && minutes <= rangeEnd) {
    return minutes
  }

  if (nextDayMinutes >= rangeStart && nextDayMinutes <= rangeEnd) {
    return nextDayMinutes
  }

  if (rangeEnd > 24 * 60 && minutes < rangeStart) {
    return nextDayMinutes
  }

  return minutes
}

const resolveTodoDuration = (todo: Todo) => {
  if (
    typeof todo.durationMinutes === "number" &&
    Number.isFinite(todo.durationMinutes) &&
    todo.durationMinutes > 0
  ) {
    return Math.floor(todo.durationMinutes)
  }

  return DEFAULT_DURATION_MINUTES
}

const normalizeDurationInput = (value: string) => value.replace(/[^\d]/g, "")

const parseDurationMinutes = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DURATION_MINUTES
  }

  const clamped = Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, parsed))
  return Math.max(MIN_DURATION_MINUTES, Math.round(clamped / SNAP_INTERVAL_MINUTES) * SNAP_INTERVAL_MINUTES)
}

const snapMinutesToGrid = (minutes: number) =>
  Math.round(minutes / SNAP_INTERVAL_MINUTES) * SNAP_INTERVAL_MINUTES

const clampStartMinutes = (minutes: number, durationMinutes: number) =>
  Math.max(0, Math.min(24 * 60 - durationMinutes, snapMinutesToGrid(minutes)))

const clampDurationMinutes = (durationMinutes: number, startMinutes: number) =>
  Math.max(
    MIN_DURATION_MINUTES,
    Math.min(MAX_DURATION_MINUTES - startMinutes, snapMinutesToGrid(durationMinutes))
  )

const buildTimedTodoLayout = (
  timedTodos: Array<{ todo: Todo; startMinutes: number; durationMinutes: number }>,
  visibleBounds: { start: number; end: number }
): TimedTodoLayoutEntry[] => {
  const entries = timedTodos.map((entry) => {
    const absoluteStart = resolveDisplayMinutes(entry.startMinutes, visibleBounds.start, visibleBounds.end)

    return {
      ...entry,
      absoluteStart,
      absoluteEnd: absoluteStart + entry.durationMinutes,
      column: 0,
      maxColumns: 1,
    }
  })

  const active: TimedTodoLayoutEntry[] = []
  let groupEntries: TimedTodoLayoutEntry[] = []
  const finalizeGroup = () => {
    if (groupEntries.length === 0) return
    const maxColumns = Math.max(...groupEntries.map((entry) => entry.column)) + 1
    groupEntries.forEach((entry) => {
      entry.maxColumns = maxColumns
    })
    groupEntries = []
  }

  for (const entry of entries) {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].absoluteEnd <= entry.absoluteStart) {
        active.splice(index, 1)
      }
    }

    if (active.length === 0) {
      finalizeGroup()
    }

    const usedColumns = new Set(active.map((item) => item.column))
    let nextColumn = 0
    while (usedColumns.has(nextColumn)) {
      nextColumn += 1
    }

    entry.column = nextColumn
    active.push(entry)
    groupEntries.push(entry)
  }

  finalizeGroup()
  return entries
}

export function TimelineView({ date, onNavigate }: TimelineViewProps) {
  const selectedDateKey = useMemo(() => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [date])
  const {
    calendarTodos,
    preferences,
    labels,
    labelFilterIds,
    activeFilterColor,
    searchQuery,
    searchModeActive,
    taskSearchFilters,
    addCalendarTodo,
    ensureLabelIds,
    updateCalendarTodo,
    deleteCalendarTodo,
  } = useLemonadeStore()
  const [draftText, setDraftText] = useState("")
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [editingTime, setEditingTime] = useState("")
  const [editingDuration, setEditingDuration] = useState("30")
  const [pastTimePopoverId, setPastTimePopoverId] = useState<string | null>(null)
  const [dragInteraction, setDragInteraction] = useState<DragInteraction | null>(null)
  const [isTimelineDropActive, setIsTimelineDropActive] = useState(false)
  const expansionResetKey = `${selectedDateKey}-${preferences.timelineStartHour}-${preferences.timelineEndHour}`
  const [manualExpansion, setManualExpansion] = useState({ key: expansionResetKey, earlier: 0, later: 0 })
  const addInputRef = useRef<HTMLInputElement>(null)
  const timelineTrackRef = useRef<HTMLDivElement>(null)
  const dragInteractionRef = useRef<DragInteraction | null>(null)
  const suppressClickTodoIdRef = useRef<string | null>(null)

  const dayTodos = useMemo(
    () =>
      calendarTodos.filter((todo) => {
        if (todo.date !== selectedDateKey) return false
        return todoMatchesSearchFilters(todo, {
          searchQuery,
          searchModeActive,
          taskSearchFilters,
          labelFilterIds,
          activeFilterColor,
          showCompleted: preferences.showCompleted,
          referenceDate: date,
        })
      }),
    [activeFilterColor, calendarTodos, date, labelFilterIds, preferences.showCompleted, searchModeActive, searchQuery, selectedDateKey, taskSearchFilters]
  )

  const unscheduledTodos = dayTodos.filter((todo) => !parseTimeToMinutes(todo.time))
  const timedTodos = dayTodos
    .map((todo) => ({
      todo,
      startMinutes: parseTimeToMinutes(todo.time),
      durationMinutes: resolveTodoDuration(todo),
    }))
    .filter((entry): entry is { todo: Todo; startMinutes: number; durationMinutes: number } => entry.startMinutes !== null)
    .sort((left, right) => left.startMinutes - right.startMinutes)
  const parsedDraft = localTaskParser(draftText, { labels, referenceDate: date })

  const resolvedManualExpansion = manualExpansion.key === expansionResetKey
    ? manualExpansion
    : { key: expansionResetKey, earlier: 0, later: 0 }

  const defaultBounds = useMemo(
    () => resolveTimelineBounds(preferences.timelineStartHour, preferences.timelineEndHour),
    [preferences.timelineEndHour, preferences.timelineStartHour]
  )

  const autoExpandedBounds = useMemo(() => {
    let earliestStart = defaultBounds.start
    let latestEnd = defaultBounds.end

    for (const { startMinutes, durationMinutes } of timedTodos) {
      const absoluteStart = resolveDisplayMinutes(startMinutes, defaultBounds.start, defaultBounds.end)
      const absoluteEnd = absoluteStart + durationMinutes

      if (absoluteStart < earliestStart) {
        earliestStart = Math.floor(absoluteStart / 60) * 60
      }

      if (absoluteEnd > latestEnd) {
        latestEnd = Math.ceil(absoluteEnd / 60) * 60
      }
    }

    return {
      start: earliestStart,
      end: latestEnd,
    }
  }, [defaultBounds.end, defaultBounds.start, timedTodos])

  const visibleBounds = useMemo(
    () => ({
      start: autoExpandedBounds.start - resolvedManualExpansion.earlier * 60,
      end: autoExpandedBounds.end + resolvedManualExpansion.later * 60,
    }),
    [autoExpandedBounds.end, autoExpandedBounds.start, resolvedManualExpansion.earlier, resolvedManualExpansion.later]
  )

  const timelineHourCount = Math.max(1, Math.ceil((visibleBounds.end - visibleBounds.start) / 60) + 1)
  const timelineHeight = timelineHourCount * HOUR_HEIGHT
  const hours = Array.from({ length: timelineHourCount }, (_, index) => Math.floor(visibleBounds.start / 60) + index)
  const positionedTimedTodos = useMemo(
    () => buildTimedTodoLayout(timedTodos, visibleBounds),
    [timedTodos, visibleBounds]
  )

  useEffect(() => {
    if (!prefilledTime) {
      return
    }

    requestAnimationFrame(() => {
      addInputRef.current?.focus()
    })
  }, [prefilledTime])

  useEffect(() => {
    dragInteractionRef.current = dragInteraction
  }, [dragInteraction])

  useEffect(() => {
    if (!dragInteraction) {
      return
    }

    const pxPerMinute = HOUR_HEIGHT / 60

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragInteractionRef.current
      if (!current) {
        return
      }

      const deltaMinutes = snapMinutesToGrid((event.clientY - current.startClientY) / pxPerMinute)

      if (current.mode === "move") {
        const nextStartMinutes = clampStartMinutes(
          current.originStartMinutes + deltaMinutes,
          current.originDurationMinutes
        )

        updateCalendarTodo(current.todoId, { time: formatTimeToken(nextStartMinutes) })
        return
      }

      const nextDurationMinutes = clampDurationMinutes(
        current.originDurationMinutes + deltaMinutes,
        current.originStartMinutes
      )

      updateCalendarTodo(current.todoId, { durationMinutes: nextDurationMinutes })
      if (editingTodoId === current.todoId) {
        setEditingDuration(`${nextDurationMinutes}`)
      }
    }

    const handlePointerUp = () => {
      const current = dragInteractionRef.current
      if (current) {
        suppressClickTodoIdRef.current = current.todoId
      }
      setDragInteraction(null)
      window.setTimeout(() => {
        if (suppressClickTodoIdRef.current === current?.todoId) {
          suppressClickTodoIdRef.current = null
        }
      }, 0)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [dragInteraction, editingTodoId, updateCalendarTodo])

  const resolveDroppedMinutes = (clientY: number) => {
    const timelineRect = timelineTrackRef.current?.getBoundingClientRect()
    if (!timelineRect) {
      return null
    }

    const relativeY = Math.max(0, Math.min(clientY - timelineRect.top, timelineRect.height))
    const rawMinutes = visibleBounds.start + (relativeY / HOUR_HEIGHT) * 60
    return clampStartMinutes(rawMinutes, DEFAULT_DURATION_MINUTES)
  }

  const startMoveInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    todoId: string,
    startMinutes: number,
    durationMinutes: number
  ) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setDragInteraction({
      mode: "move",
      todoId,
      startClientY: event.clientY,
      originStartMinutes: startMinutes,
      originDurationMinutes: durationMinutes,
    })
  }

  const startResizeInteraction = (
    event: ReactPointerEvent<HTMLButtonElement>,
    todoId: string,
    startMinutes: number,
    durationMinutes: number
  ) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setDragInteraction({
      mode: "resize",
      todoId,
      startClientY: event.clientY,
      originStartMinutes: startMinutes,
      originDurationMinutes: durationMinutes,
    })
  }

  const handleUnscheduledDragStart = (event: ReactDragEvent<HTMLButtonElement>, todoId: string) => {
    setPlannerTaskDragData(event, { todoId, source: "timeline-unscheduled" })
  }

  const handleTimedBlockDragStart = (event: ReactDragEvent<HTMLButtonElement>, todoId: string) => {
    event.stopPropagation()
    setPlannerTaskDragData(event, { todoId, source: "timeline-timed" })
  }

  const handleTimelineDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsTimelineDropActive(false)

    const dragData = getPlannerTaskDragData(event)
    if (!dragData?.todoId) {
      return
    }

    const targetTodo = calendarTodos.find((todo) => todo.id === dragData.todoId)
    if (!targetTodo) {
      return
    }

    const droppedMinutes = resolveDroppedMinutes(event.clientY)
    if (droppedMinutes === null) {
      return
    }

    const durationMinutes = clampDurationMinutes(resolveTodoDuration(targetTodo), droppedMinutes)

    updateCalendarTodo(dragData.todoId, {
      date: selectedDateKey,
      time: formatTimeToken(droppedMinutes),
      durationMinutes,
    })

    toast(`Scheduled for ${formatTimeToken(droppedMinutes)}`, { duration: 2500 })
  }

  const handleCreateTimelineTask = async () => {
    const rawInputString = draftText
    const fallbackTime = prefilledTime ?? undefined

    if (!rawInputString.trim()) {
      setDraftText("")
      return
    }

    const parsedTasks = parseNaturalLanguageTaskEntries(rawInputString, { labels, referenceDate: date })
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
        const tempId = createOptimisticTodoId(`timeline-${selectedDateKey}`)
        const optimisticDate = parsedTask.scheduledDate ?? selectedDateKey

        addCalendarTodo({
          id: tempId,
          text: title,
          completed: false,
          date: optimisticDate,
          isHeading: title === title.toUpperCase() && title.length > 2,
          priority: parsedTask.priority,
          labelIds,
          subtasks: parsedTask.subtaskTitles.map((subtaskTitle) => ({ title: subtaskTitle })),
          time: fallbackTime,
          isSyncing: true,
          syncStatus: undefined,
        })

        return { tempId, parsedTask, labelIds, optimisticDate }
      })
      .filter((task): task is NonNullable<typeof task> => task !== null)

    if (optimisticTasks.length === 0) {
      setDraftText("")
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), AI_PARSE_TIMEOUT_MS)

    void fetch("/api/parse-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: rawInputString,
        now: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Task parse failed")
        }

        const tasks = await response.json()
        const aiTasks = Array.isArray(tasks)
          ? (tasks as Array<Record<string, unknown>>)
          : tasks && typeof tasks === "object"
            ? [tasks as Record<string, unknown>]
            : []
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
          const aiPriority: Todo["priority"] = normalizeTodoPriority(primaryTask.priority ?? parsedTask.priority)
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
            time: typeof primaryTask.time === "string" && primaryTask.time ? primaryTask.time : fallbackTime,
            priority: aiPriority,
            labelIds: aiLabelIds.length > 0 ? aiLabelIds : labelIds,
            location:
              typeof primaryTask.location === "string" && primaryTask.location.trim()
                ? primaryTask.location.trim()
                : undefined,
            url:
              typeof primaryTask.url === "string" && primaryTask.url.trim()
                ? primaryTask.url.trim()
                : undefined,
            notes:
              typeof primaryTask.notes === "string" && primaryTask.notes.trim()
                ? primaryTask.notes.trim()
                : undefined,
            durationMinutes:
              typeof primaryTask.duration === "number" && Number.isFinite(primaryTask.duration) && primaryTask.duration > 0
                ? Math.floor(primaryTask.duration)
                : undefined,
            reminderOffsetMinutes:
              typeof primaryTask.reminder === "number" && Number.isFinite(primaryTask.reminder) && primaryTask.reminder >= 0
                ? Math.floor(primaryTask.reminder)
                : undefined,
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

          if (resolvedDate && resolvedDate !== optimisticDate) {
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

    setDraftText("")
    setPrefilledTime(null)
  }

  const openEditDialog = (todo: Todo) => {
    setEditingTodoId(todo.id)
    setEditingText(todo.text)
    setEditingTime(todo.time ?? "")
    setEditingDuration(`${resolveTodoDuration(todo)}`)
  }

  const handleSaveEdit = () => {
    if (!editingTodoId) return
    const trimmedText = editingText.trim()
    if (!trimmedText) return
    const durationMinutes = parseDurationMinutes(editingDuration)

    updateCalendarTodo(editingTodoId, {
      text: trimmedText,
      time: editingTime.trim() || undefined,
      durationMinutes,
    })
    setEditingTodoId(null)
  }

  const currentTimeOffset = (() => {
    const now = new Date()
    if (!isSameDay(now, date)) return null
    const minutes = now.getHours() * 60 + now.getMinutes()
    const absoluteMinutes = resolveDisplayMinutes(minutes, visibleBounds.start, visibleBounds.end)
    if (absoluteMinutes < visibleBounds.start || absoluteMinutes > visibleBounds.end + 60) return null
    return ((absoluteMinutes - visibleBounds.start) / 60) * HOUR_HEIGHT
  })()
  const currentTimeMinutes = useMemo(() => {
    const now = new Date()
    if (!isSameDay(now, date)) return null
    return resolveDisplayMinutes(now.getHours() * 60 + now.getMinutes(), visibleBounds.start, visibleBounds.end)
  }, [date, visibleBounds.end, visibleBounds.start])

  return (
    <div className="flex flex-1 flex-col px-4 pt-6">
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-border/70 bg-background/90 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[rgba(19,19,19,0.9)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("prev-day")} className="size-8">
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Calendar</div>
            <div className="font-heading text-[20px] leading-[20px]">{formatHeadingDate(date)}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onNavigate("next-day")} className="size-8">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => onNavigate("today")} className="text-[12px]">
          Today
        </Button>
      </div>

      <div className="mb-5 rounded-2xl border border-border/70 bg-background/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[rgba(19,19,19,0.9)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Unscheduled</div>
          {prefilledTime ? (
            <div className="text-[11px] font-medium text-[var(--accent-color)]">Prefilled for {prefilledTime}</div>
          ) : null}
        </div>

        <div className="mb-3 flex items-start gap-3">
          <Clock3 className="mt-2 size-4 text-muted-foreground" />
          <div className="flex-1">
            <Input
              ref={addInputRef}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={async (event) => event.key === "Enter" && await handleCreateTimelineTask()}
              placeholder="Add a task or click a time slot to prefill a time"
              className="mb-2"
            />
            {parsedDraft.previewTokens.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {parsedDraft.previewTokens.map((token) => (
                  <span key={token.key} className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    {token.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <Button onClick={() => void handleCreateTimelineTask()}>
            <Plus className="mr-1 size-4" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {unscheduledTodos.length > 0 ? (
            unscheduledTodos.map((todo) => {
              const firstLabel = todo.labelIds.map((labelId) => labels.find((label) => label.id === labelId)).find(Boolean)
              return (
                <button
                  key={todo.id}
                  type="button"
                    onClick={() => openEditDialog(todo)}
                    draggable
                    onDragStart={(event) => handleUnscheduledDragStart(event, todo.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted/40",
                    todo.isSyncing && "animate-pulse"
                  )}
                >
                  {todo.isSyncing ? (
                    <Sparkles className="size-3.5 text-[var(--accent-color)]" />
                  ) : todo.syncStatus === "local" ? (
                    <PencilLine className="size-3.5 text-muted-foreground" />
                  ) : null}
                  <div className={cn("size-2 rounded-full", normalizeTodoPriority(todo.priority) === "urgent" ? "bg-red-500" : normalizeTodoPriority(todo.priority) === "important" ? "bg-amber-500" : "bg-muted-foreground/30")} />
                  <span className={cn("flex-1 text-sm", todo.completed && "line-through opacity-50")}>{todo.text}</span>
                  {firstLabel ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: firstLabel.color }}>
                      {firstLabel.name}
                    </span>
                  ) : null}
                </button>
              )
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
              No unscheduled tasks for this day.
            </div>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-background/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[rgba(19,19,19,0.9)]">
        <button
          type="button"
          onClick={() =>
            setManualExpansion((current) => ({
              key: expansionResetKey,
              earlier: (current.key === expansionResetKey ? current.earlier : 0) + 1,
              later: current.key === expansionResetKey ? current.later : 0,
            }))
          }
          className="flex w-full items-center justify-center gap-2 border-b border-border/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <ChevronUp className="size-3.5" />
          Show earlier
        </button>
        <div
          ref={timelineTrackRef}
          className={cn("relative overflow-y-auto", isTimelineDropActive && "bg-[color-mix(in_srgb,var(--accent-color)_6%,transparent)]")}
          style={{ maxHeight: "70vh" }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsTimelineDropActive(true)
          }}
          onDragLeave={() => setIsTimelineDropActive(false)}
          onDrop={handleTimelineDrop}
        >
          <div className="relative" style={{ height: timelineHeight }}>
            {hours.map((hour, index) => (
              <button
                key={hour}
                type="button"
                onClick={() => {
                  const minutes = hour * 60
                  const token = formatTimeToken(minutes)
                  setPrefilledTime(token)
                  setDraftText((current) => {
                    const trimmed = current.trim()
                    return trimmed.length > 0 ? `${trimmed} ${token}` : token
                  })
                }}
                className="absolute inset-x-0 grid w-full grid-cols-[88px_minmax(0,1fr)] text-left hover:bg-muted/20"
                style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <div className="border-r border-border/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {formatHourLabel(hour)}
                </div>
                <div className="border-t border-border/50" />
              </button>
            ))}

            {currentTimeOffset !== null ? (
              <div
                className="pointer-events-none absolute left-[88px] right-0 z-20 border-t"
                style={{
                  top: currentTimeOffset,
                  borderColor: "var(--accent-color)",
                }}
              >
                <span
                  className="absolute -left-2 -top-[5px] size-2.5 rounded-full"
                  style={{ backgroundColor: "var(--accent-color)" }}
                />
              </div>
            ) : null}

            <div className="absolute inset-y-0 z-10" style={{ left: TIMELINE_LEFT_GUTTER, right: TIMELINE_RIGHT_GUTTER }}>
            {positionedTimedTodos.map(({ todo, startMinutes, durationMinutes, absoluteStart, column, maxColumns }) => {
              const firstLabel = todo.labelIds.map((labelId) => labels.find((label) => label.id === labelId)).find(Boolean)
              const top = ((absoluteStart - visibleBounds.start) / 60) * HOUR_HEIGHT
              const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT)
              const showPastTimeWarning =
                currentTimeMinutes !== null &&
                absoluteStart < currentTimeMinutes &&
                !todo.completed
              const widthPercent = 100 / maxColumns
              const widthAdjustment = ((maxColumns - 1) * OVERLAP_GAP_PX) / maxColumns
              const left = `calc(${column * widthPercent}% + ${column * OVERLAP_GAP_PX}px)`
              const width = `calc(${widthPercent}% - ${widthAdjustment}px)`

              return (
                <div
                  key={todo.id}
                  onPointerDown={(event) => startMoveInteraction(event, todo.id, startMinutes, durationMinutes)}
                  onClick={() => {
                    if (suppressClickTodoIdRef.current === todo.id) {
                      suppressClickTodoIdRef.current = null
                      return
                    }
                    openEditDialog(todo)
                  }}
                  className={cn(
                    "absolute z-10 overflow-hidden rounded-xl border px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-transform hover:scale-[1.01]",
                    todo.isSyncing && "animate-pulse"
                  )}
                  style={{
                    top,
                    height,
                    left,
                    width,
                    backgroundColor: todo.color ?? "color-mix(in srgb, var(--accent-color) 12%, transparent)",
                    borderColor: "color-mix(in srgb, var(--accent-color) 35%, var(--border))",
                  }}
                >
                  <div className="flex min-h-full cursor-grab flex-col justify-between active:cursor-grabbing">
                  <div className="flex items-center gap-2">
                    {todo.isSyncing ? (
                      <Sparkles className="size-3.5 text-[var(--accent-color)]" />
                    ) : todo.syncStatus === "local" ? (
                      <PencilLine className="size-3.5 text-muted-foreground" />
                    ) : null}
                    <Flag className={cn("size-3.5", normalizeTodoPriority(todo.priority) === "urgent" ? "text-red-500" : normalizeTodoPriority(todo.priority) === "important" ? "text-amber-500" : "text-muted-foreground/50")} />
                    <span className={cn("truncate text-sm font-medium", todo.completed && "line-through opacity-50")}>
                      {todo.text}
                    </span>
                    {firstLabel ? (
                      <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: firstLabel.color }}>
                        {firstLabel.name}
                      </span>
                    ) : null}
                    {showPastTimeWarning ? (
                      <Popover open={pastTimePopoverId === todo.id} onOpenChange={(open) => setPastTimePopoverId(open ? todo.id : null)}>
                        <PopoverTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              setPastTimePopoverId((current) => current === todo.id ? null : todo.id)
                            }}
                            onMouseEnter={() => setPastTimePopoverId(todo.id)}
                            onMouseLeave={() => setPastTimePopoverId((current) => current === todo.id ? null : current)}
                            className="ml-1 inline-flex items-center text-amber-600"
                          >
                            <AlertTriangle className="size-3.5" />
                          </span>
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="end"
                          className="w-[220px] border border-border/70 border-b-[4px] border-b-[var(--accent-color)] p-3"
                          onMouseEnter={() => setPastTimePopoverId(todo.id)}
                          onMouseLeave={() => setPastTimePopoverId(null)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">This time has passed - move to now?</p>
                            <Button
                              size="sm"
                              className="h-8 text-[12px]"
                              onClick={() => {
                                if (currentTimeMinutes === null) {
                                  return
                                }
                                updateCalendarTodo(todo.id, { time: formatTimeToken(currentTimeMinutes) })
                                setPastTimePopoverId(null)
                              }}
                            >
                              Move to now
                            </Button>
                          </div>
                        </PopoverContent>
                        </Popover>
                    ) : null}
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleTimedBlockDragStart(event, todo.id)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                      aria-label={`Drag ${todo.text} to another panel`}
                      title="Drag to another panel"
                    >
                      <GripVertical className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {todo.time} • {durationMinutes} min
                  </div>
                  {todo.isSyncing ? (
                    <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Syncing...
                    </div>
                  ) : null}
                  </div>
                  <button
                    type="button"
                    onPointerDown={(event) => startResizeInteraction(event, todo.id, startMinutes, durationMinutes)}
                    className="absolute inset-x-2 bottom-1 h-2 cursor-ns-resize rounded-full bg-foreground/10 hover:bg-foreground/20"
                    aria-label={`Resize ${todo.text}`}
                  />
                </div>
              )
            })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setManualExpansion((current) => ({
              key: expansionResetKey,
              earlier: current.key === expansionResetKey ? current.earlier : 0,
              later: (current.key === expansionResetKey ? current.later : 0) + 1,
            }))
          }
          className="flex w-full items-center justify-center gap-2 border-t border-border/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted/30"
        >
          Show later
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      <Dialog open={editingTodoId !== null} onOpenChange={(open) => !open && setEditingTodoId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editingText} onChange={(event) => setEditingText(event.target.value)} placeholder="Task title" />
            <Input value={editingTime} onChange={(event) => setEditingTime(event.target.value)} placeholder="Time (e.g. 5pm)" />
            <Input
              value={editingDuration}
              onChange={(event) => {
                const nextValue = normalizeDurationInput(event.target.value)
                setEditingDuration(nextValue)

                if (editingTodoId && nextValue.trim()) {
                  updateCalendarTodo(editingTodoId, { durationMinutes: parseDurationMinutes(nextValue) })
                }
              }}
              placeholder="Duration in minutes"
              inputMode="numeric"
            />
          </div>
          <DialogFooter className="justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (editingTodoId) {
                  deleteCalendarTodo(editingTodoId)
                }
                setEditingTodoId(null)
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 size-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingTodoId(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

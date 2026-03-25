"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseNaturalLanguageTaskInput, useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Flag, Plus, Trash2 } from "lucide-react"

interface TimelineViewProps {
  date: Date
  onNavigate: (direction: "prev-day" | "next-day" | "today") => void
}

const HOUR_HEIGHT = 64
const DEFAULT_DURATION_MINUTES = 30
const MIN_BLOCK_HEIGHT = 46

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
  const expansionResetKey = `${selectedDateKey}-${preferences.timelineStartHour}-${preferences.timelineEndHour}`
  const [manualExpansion, setManualExpansion] = useState({ key: expansionResetKey, earlier: 0, later: 0 })
  const addInputRef = useRef<HTMLInputElement>(null)

  const dayTodos = useMemo(
    () =>
      calendarTodos.filter((todo) => {
        if (todo.date !== selectedDateKey) return false
        if (!preferences.showCompleted && todo.completed) return false
        if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
        if (activeFilterColor && todo.color !== activeFilterColor) return false
        return true
      }),
    [activeFilterColor, calendarTodos, labelFilterIds, preferences.showCompleted, searchQuery, selectedDateKey]
  )

  const unscheduledTodos = dayTodos.filter((todo) => !parseTimeToMinutes(todo.time))
  const timedTodos = dayTodos
    .map((todo) => ({
      todo,
      startMinutes: parseTimeToMinutes(todo.time),
    }))
    .filter((entry): entry is { todo: Todo; startMinutes: number } => entry.startMinutes !== null)
    .sort((left, right) => left.startMinutes - right.startMinutes)

  const parsedDraft = parseNaturalLanguageTaskInput(draftText, { labels, referenceDate: date })

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

    for (const { startMinutes } of timedTodos) {
      const absoluteStart = resolveDisplayMinutes(startMinutes, defaultBounds.start, defaultBounds.end)
      const absoluteEnd = absoluteStart + DEFAULT_DURATION_MINUTES

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

  useEffect(() => {
    if (!prefilledTime) {
      return
    }

    requestAnimationFrame(() => {
      addInputRef.current?.focus()
    })
  }, [prefilledTime])

  const handleCreateTimelineTask = () => {
    const parsed = parseNaturalLanguageTaskInput(draftText, { labels, referenceDate: date })
    const labelIds = [...parsed.labelIds, ...ensureLabelIds(parsed.newLabelNames)]
    const fallbackTime = prefilledTime ?? undefined

    if (!parsed.cleanText) {
      setDraftText("")
      return
    }

    addCalendarTodo({
      text: parsed.cleanText,
      completed: false,
      date: parsed.scheduledDate ?? selectedDateKey,
      isHeading: parsed.cleanText === parsed.cleanText.toUpperCase() && parsed.cleanText.length > 2,
      isRecurring: parsed.recurrence?.isRecurring,
      recurringFrequency: parsed.recurrence?.recurringFrequency,
      recurringDays: parsed.recurrence?.recurringDays,
      priority: parsed.priority,
      labelIds,
      subtasks: parsed.subtaskTitles.map((title) => ({ title })),
      time: parsed.time ?? fallbackTime,
    })

    setDraftText("")
    setPrefilledTime(null)
  }

  const openEditDialog = (todo: Todo) => {
    setEditingTodoId(todo.id)
    setEditingText(todo.text)
    setEditingTime(todo.time ?? "")
    setEditingDuration("30")
  }

  const handleSaveEdit = () => {
    if (!editingTodoId) return
    const trimmedText = editingText.trim()
    if (!trimmedText) return
    updateCalendarTodo(editingTodoId, {
      text: trimmedText,
      time: editingTime.trim() || undefined,
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
    <div className="flex flex-1 flex-col px-10 pt-6">
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-border/70 bg-background/90 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[rgba(19,19,19,0.9)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("prev-day")} className="size-8">
            <ChevronLeft className="size-4" />
          </Button>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Timeline</div>
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
              onKeyDown={(event) => event.key === "Enter" && handleCreateTimelineTask()}
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
          <Button onClick={handleCreateTimelineTask}>
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
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <div className={cn("size-2 rounded-full", todo.priority === "high" ? "bg-red-500" : todo.priority === "medium" ? "bg-orange-500" : todo.priority === "low" ? "bg-blue-500" : "bg-muted-foreground/30")} />
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
        <div className="relative overflow-y-auto" style={{ maxHeight: "70vh" }}>
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

            {timedTodos.map(({ todo, startMinutes }) => {
              const firstLabel = todo.labelIds.map((labelId) => labels.find((label) => label.id === labelId)).find(Boolean)
              const absoluteStart = resolveDisplayMinutes(startMinutes, visibleBounds.start, visibleBounds.end)
              const top = ((absoluteStart - visibleBounds.start) / 60) * HOUR_HEIGHT
              const height = Math.max((DEFAULT_DURATION_MINUTES / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT)
              const showPastTimeWarning =
                currentTimeMinutes !== null &&
                absoluteStart < currentTimeMinutes &&
                !todo.completed

              return (
                <button
                  key={todo.id}
                  type="button"
                  onClick={() => openEditDialog(todo)}
                  className="absolute left-[96px] right-4 z-10 overflow-hidden rounded-xl border px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-transform hover:scale-[1.01]"
                  style={{
                    top,
                    height,
                    backgroundColor: todo.color ?? "color-mix(in srgb, var(--accent-color) 12%, transparent)",
                    borderColor: "color-mix(in srgb, var(--accent-color) 35%, var(--border))",
                  }}
                >
                  <div className="flex min-h-full flex-col justify-between">
                  <div className="flex items-center gap-2">
                    {todo.priority ? (
                      <Flag className={cn("size-3.5", todo.priority === "high" ? "text-red-500" : todo.priority === "medium" ? "text-orange-500" : "text-blue-500")} />
                    ) : null}
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
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {todo.time}
                  </div>
                  </div>
                </button>
              )
            })}
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
            <Input value={editingDuration} onChange={(event) => setEditingDuration(event.target.value)} placeholder="Duration in minutes" disabled />
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

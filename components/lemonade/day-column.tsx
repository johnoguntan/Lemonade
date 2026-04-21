"use client"

import { useState, useRef, useEffect, useMemo, type DragEvent, type ReactNode } from "react"
import {
  createOptimisticTodoId,
  formatLocalDateKey,
  localTaskParser,
  normalizeCalendarDateKey,
  normalizeTodoPriority,
  parseNaturalLanguageTaskEntries,
  reconcileOptimisticTaskOrder,
  todoMatchesSearchFilters,
  useLemonadeStore,
  holidays,
  type NaturalLanguagePreviewToken,
  type Todo,
} from "@/lib/store"
import { cn } from "@/lib/utils"
import { TodoItem } from "./todo-item"
import { getPlannerTaskDragData, setPlannerTaskDragData } from "@/lib/task-dnd"
import { format, isValid, parseISO } from "date-fns"
import { Check } from "lucide-react"
import { toast } from "sonner"

interface DayColumnProps {
  date: Date
  isToday: boolean
  anchorId?: string
  afterTodosContent?: ReactNode
}

const AI_PARSE_TIMEOUT_MS = 15000

const formatDate = (date: Date) => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  return {
    month: months[date.getMonth()],
    day: date.getDate(),
    year: date.getFullYear(),
    dayName: days[date.getDay()],
  }
}

const getDateString = (date: Date) => {
  return formatLocalDateKey(date)
}

const splitNaturalTitleFallback = (input: string, index: number) =>
  input
    .split(/\s*(?:,|and then|after that|also|plus|then)\s*/i)
    .map((fragment) => fragment.trim())
    .filter(Boolean)[index] ?? input.trim()

const sortEndOfDayTodos = (todos: Todo[]) => {
  const getBucket = (todo: Todo) => {
    if (!todo.completed && !todo.endOfDay) return 0
    if (!todo.completed && todo.endOfDay) return 1
    if (todo.completed && !todo.endOfDay) return 2
    return 3
  }

  // We sort explicitly by section and creation time so ordering stays predictable
  // across reloads and does not depend on engine sort stability.
  return todos
    .map((todo, index) => ({ todo, index }))
    .sort((a, b) => {
      const bucketDiff = getBucket(a.todo) - getBucket(b.todo)
      if (bucketDiff !== 0) return bucketDiff

      const createdAtDiff = a.todo.createdAt - b.todo.createdAt
      if (createdAtDiff !== 0) return createdAtDiff

      return a.index - b.index
    })
    .map(({ todo }) => todo)
}

const priorityRank: Record<NonNullable<Todo["priority"]>, number> = {
  none: 0,
  low: 0,
  normal: 1,
  medium: 2,
  important: 2,
  high: 3,
  urgent: 3,
}

const maxTodoPriority = (left: Todo["priority"], right: Todo["priority"]): Todo["priority"] => {
  if (!left) return right
  if (!right) return left
  return priorityRank[right] > priorityRank[left] ? right : left
}

export function DayColumn({ date, isToday, anchorId, afterTodosContent }: DayColumnProps) {
  const preferences = useLemonadeStore((state) => state.preferences)
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos)
  const lastCreatedTodoId = useLemonadeStore((state) => state.lastCreatedTodoId)
  const addCalendarTodo = useLemonadeStore((state) => state.addCalendarTodo)
  const updateCalendarTodo = useLemonadeStore((state) => state.updateCalendarTodo)
  const setSelectedCalendarDate = useLemonadeStore((state) => state.setSelectedCalendarDate)
  const clearLastCreatedTodoId = useLemonadeStore((state) => state.clearLastCreatedTodoId)
  const ensureLabelIds = useLemonadeStore((state) => state.ensureLabelIds)
  const moveTodoToDate = useLemonadeStore((state) => state.moveTodoToDate)
  const reorderCalendarTodo = useLemonadeStore((state) => state.reorderCalendarTodo)
  const searchQuery = useLemonadeStore((state) => state.searchQuery)
  const searchModeActive = useLemonadeStore((state) => state.searchModeActive)
  const taskSearchFilters = useLemonadeStore((state) => state.taskSearchFilters)
  const isCalendarExpanded = useLemonadeStore((state) => state.isCalendarExpanded)
  const labelFilterIds = useLemonadeStore((state) => state.labelFilterIds)
  const activeFilterColor = useLemonadeStore((state) => state.activeFilterColor)
  const labels = useLemonadeStore((state) => state.labels)
  const [newTodoText, setNewTodoText] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: "before" | "after" } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateStr = getDateString(date)
  const { month, day, year, dayName } = formatDate(date)
  const holiday = holidays[dateStr]

  const todosForDay: Todo[] = useMemo(
    () =>
      sortEndOfDayTodos(
        calendarTodos.filter((todo) => {
          if (todo.date !== dateStr) return false
          return todoMatchesSearchFilters(todo, {
            searchQuery,
            searchModeActive,
            taskSearchFilters,
            labelFilterIds,
            activeFilterColor,
            showCompleted: preferences.showCompleted,
          })
        })
      ),
    [activeFilterColor, calendarTodos, dateStr, labelFilterIds, preferences.showCompleted, searchModeActive, searchQuery, taskSearchFilters]
  )

  const textSizeClass = "lemonade-task-text"

  useEffect(() => {
    if (isAdding && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isAdding])

  const handleStartAdding = () => {
    setIsAdding(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const getResponsiveFontSizes = () => {
    return { date: 'text-[10px]' }
  }

  const { date: dateFontSize } = getResponsiveFontSizes()
  const visibleLineCount = isCalendarExpanded ? 18 : 9
  const fillerRowCount = Math.max(visibleLineCount - todosForDay.length - 1, 0)
  const parsedInput = localTaskParser(newTodoText, { labels })

  const handleTodoDragStart = (event: DragEvent<HTMLDivElement>, todoId: string) => {
    setPlannerTaskDragData(event, { todoId, source: "calendar" })
    setDraggedTodoId(todoId)
  }

  const handleColumnDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setIsDragOver(true)
  }

  const handleColumnDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const dragData = getPlannerTaskDragData(event)

    if (dragData?.todoId) {
      if (dragData.source === "timeline-unscheduled" || dragData.source === "timeline-timed") {
        updateCalendarTodo(dragData.todoId, {
          date: dateStr,
          time: undefined,
          durationMinutes: undefined,
        })
        toast("Task moved back to calendar", { duration: 2000 })
      } else {
        moveTodoToDate(dragData.todoId, dateStr)
        toast("Task moved", { duration: 2000 })
      }
    }

    setIsDragOver(false)
    setDraggedTodoId(null)
    setDropIndicator(null)
  }

  const handleCreateNaturalLanguageTodo = async () => {
    const rawInputString = newTodoText

    if (!rawInputString.trim()) {
      setNewTodoText("")
      return false
    }

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
        const tempId = createOptimisticTodoId(`day-${dateStr}`)
        const optimisticDate = parsedTask.scheduledDate ?? dateStr

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
      setNewTodoText("")
      return false
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
          const aiPriority: Todo["priority"] = normalizeTodoPriority(
            maxTodoPriority(parsedTask.priority, primaryTask.priority as Todo["priority"])
          )
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

            // Ensure the user can immediately see the task (avoid "it disappeared").
            window.requestAnimationFrame(() => {
              const anchor = document.getElementById(`calendar-day-${resolvedDate}`)
              if (anchor) {
                anchor.scrollIntoView({ behavior: "smooth", block: "start" })
              } else {
                // Fallback: navigate the calendar anchor to the moved date.
                setSelectedCalendarDate(resolvedDate)
              }
            })
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

    setNewTodoText("")
    clearLastCreatedTodoId()
    return true
  }

  return (
    <div id={anchorId} className="w-full">
      <div className="w-full px-2">
        <div className="lemonade-day-header pb-3 pt-3">
          <div
            className={cn("lemonade-day-date font-semibold tracking-[0.08em]", dateFontSize)}
            style={{ color: "#A4A4A4" }}
          >
            {month} {day}, {year}
          </div>
          <div className={cn(
            "lemonade-day-label font-heading uppercase text-[20px] leading-[20px]",
            isToday ? "text-[var(--accent-color)]" : "text-foreground"
          )}>
            {dayName}
          </div>
          {holiday && (
            <div className="mt-1 text-xs italic text-muted-foreground">
              {holiday}
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col transition-colors",
            isDragOver && "rounded-md border border-dashed border-border bg-accent/50"
          )}
          onDragOver={handleColumnDragOver}
          onDragEnter={handleColumnDragOver}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleColumnDrop}
        >
          <div className="flex flex-col">
            {todosForDay.map((todo) => (
              <div
                key={todo.id}
                className={cn(
                  dropIndicator?.targetId === todo.id && dropIndicator.position === "before" && "relative before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-[var(--accent-color)]",
                  dropIndicator?.targetId === todo.id && dropIndicator.position === "after" && "relative after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--accent-color)]"
                )}
                onDragOver={(event) => {
                  const dragData = getPlannerTaskDragData(event)
                  if (!dragData || dragData.source !== "calendar") return
                  const dragged = calendarTodos.find((item) => item.id === dragData.todoId)
                  if (!dragged || dragged.date !== dateStr) return
                  if (dragData.todoId === todo.id) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"

                  const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const position: "before" | "after" = event.clientY < rect.top + rect.height / 2 ? "before" : "after"
                  setDropIndicator({ targetId: todo.id, position })
                }}
                onDragLeave={() => {
                  setDropIndicator((current) => (current?.targetId === todo.id ? null : current))
                }}
                onDrop={(event) => {
                  const dragData = getPlannerTaskDragData(event)
                  if (!dragData || dragData.source !== "calendar") return
                  const dragged = calendarTodos.find((item) => item.id === dragData.todoId)
                  if (!dragged || dragged.date !== dateStr) return
                  if (dragData.todoId === todo.id) return

                  event.preventDefault()
                  event.stopPropagation()

                  const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const position: "before" | "after" = event.clientY < rect.top + rect.height / 2 ? "before" : "after"
                  reorderCalendarTodo(dragData.todoId, todo.id, position)
                  setDropIndicator(null)
                  setDraggedTodoId(null)
                }}
              >
                <TodoItem
                  todo={todo}
                  autoFocus={todo.id === lastCreatedTodoId}
                  textSizeClass={textSizeClass}
                  isDragging={todo.id === draggedTodoId}
                  draggable
                  onDragStart={(event) => handleTodoDragStart(event, todo.id)}
                  onDragEnd={() => {
                    setIsDragOver(false)
                    setDraggedTodoId(null)
                    setDropIndicator(null)
                  }}
                />
              </div>
            ))}

            {afterTodosContent ? (
              <div
                className={cn(
                  "calendar-focus-shortcuts-slot",
                  todosForDay.length === 0 && !isAdding
                    ? "calendar-focus-shortcuts-slot-empty"
                    : "calendar-focus-shortcuts-slot-filled"
                )}
              >
                {afterTodosContent}
              </div>
            ) : null}

            <div
              className="lemonade-task-row flex h-[42px] items-center px-0 transition-colors cursor-text hover:bg-accent/20"
              onClick={handleStartAdding}
            >
              {isAdding ? (
                <div className="w-full py-2">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      spellCheck
                      autoCorrect="on"
                      autoCapitalize="sentences"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          const created = await handleCreateNaturalLanguageTodo()
                          if (created) {
                            requestAnimationFrame(() => {
                              inputRef.current?.focus()
                            })
                          }
                        } else if (e.key === "Escape") {
                          setIsAdding(false)
                          setNewTodoText("")
                        }
                      }}
                      onBlur={async () => {
                        await handleCreateNaturalLanguageTodo()
                        setIsAdding(false)
                      }}
                      className={cn(
                        "w-full bg-transparent px-0 pr-7 outline-none font-task",
                        textSizeClass
                      )}
                      placeholder="Add a todo..."
                    />
                    {newTodoText.trim() ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={async () => {
                          const created = await handleCreateNaturalLanguageTodo()
                          if (created) {
                            requestAnimationFrame(() => {
                              inputRef.current?.focus()
                            })
                          }
                        }}
                        className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-[var(--accent-color)] opacity-75 transition-opacity hover:opacity-100"
                        aria-label="Confirm task"
                      >
                        <Check className="size-4" strokeWidth={2.5} />
                      </button>
                    ) : null}
                  </div>
                  <TokenPreviewBar tokens={parsedInput.previewTokens} />
                </div>
              ) : null}
            </div>

            {Array.from({ length: fillerRowCount }).map((_, index) => (
              <div
                key={`${dateStr}-line-${index}`}
                className="lemonade-task-row flex h-[42px] items-center px-0 transition-colors cursor-text hover:bg-accent/20"
                onClick={handleStartAdding}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TokenPreviewBar({ tokens }: { tokens: NaturalLanguagePreviewToken[] }) {
  if (tokens.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
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

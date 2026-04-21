"use client"

import { useState, useSyncExternalStore } from "react"
import { createOptimisticTodoId, formatLocalDateKey, normalizeCalendarDateKey, normalizeTodoPriority, parseNaturalLanguageTaskEntries, reconcileOptimisticTaskOrder, useLemonadeStore, type Todo } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format, isValid, parseISO } from "date-fns"
import { ArrowRight, Trash2, MoveRight, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

const AI_PARSE_TIMEOUT_MS = 15000
const splitNaturalTitleFallback = (input: string, index: number) =>
  input
    .split(/\s*(?:,|and then|after that|also|plus|then)\s*/i)
    .map((fragment) => fragment.trim())
    .filter(Boolean)[index] ?? input.trim()

export function DailyPlannerModal() {
  const { calendarTodos, moveTodoToDate, deleteCalendarTodo, addCalendarTodo, updateCalendarTodo, ensureLabelIds, labels, restoreLastDeletedTodo, clearLastDeleted } = useLemonadeStore()
  const [priorities, setPriorities] = useState(["", "", ""])
  const [keptTodoIds, setKeptTodoIds] = useState<string[]>([])
  const [dismissedDate, setDismissedDate] = useState<string | null>(null)
  
  const today = new Date()
  const todayStr = formatLocalDateKey(today)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatLocalDateKey(yesterday)

  const shouldOpenToday = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem('lemonade-last-planner') !== todayStr,
    () => false
  )

  const isOpen = shouldOpenToday && dismissedDate !== todayStr

  const yesterdayUnfinished = calendarTodos.filter(
    todo =>
      todo.date === yesterdayStr &&
      !todo.completed &&
      !todo.isHeading &&
      !todo.parentId &&
      !keptTodoIds.includes(todo.id)
  )

  const todaySchedule = calendarTodos.filter(
    todo => todo.date === todayStr && !todo.isHeading
  )

  const greeting = (() => {
    const hour = today.getHours()
    if (hour < 12) return "Good Morning ☀️"
    if (hour <= 17) return "Good Afternoon 👋"
    return "Good Evening 🌙"
  })()

  const handleStartDay = async () => {
    for (const text of priorities) {
      const rawInputString = text

      if (!rawInputString.trim()) {
        continue
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
          const tempId = createOptimisticTodoId(`planner-${todayStr}`)
          const optimisticDate = parsedTask.scheduledDate ?? todayStr

          addCalendarTodo({
            id: tempId,
            text: title,
            completed: false,
            date: optimisticDate,
            priority: parsedTask.priority ?? "important",
            labelIds,
            subtasks: parsedTask.subtaskTitles.map((subtaskTitle) => ({ title: subtaskTitle })),
            isSyncing: true,
            syncStatus: undefined,
          })

          return { tempId, parsedTask, labelIds, optimisticDate }
        })
        .filter((task): task is NonNullable<typeof task> => task !== null)

      if (optimisticTasks.length === 0) {
        continue
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
            const aiPriority: Todo["priority"] = normalizeTodoPriority(primaryTask.priority ?? parsedTask.priority ?? "important")
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
    }
    
    localStorage.setItem('lemonade-last-planner', todayStr)
    setDismissedDate(todayStr)
  }

  const handleSkipForToday = () => {
    localStorage.setItem('lemonade-last-planner', todayStr)
    setDismissedDate(todayStr)
  }

  const handleDeleteTodo = (todoId: string) => {
    deleteCalendarTodo(todoId)
    const deleteToken = useLemonadeStore.getState().lastDeleted?.token

    toast("Task deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => restoreLastDeletedTodo(),
      },
    })

    if (deleteToken) {
      window.setTimeout(() => {
        clearLastDeleted(deleteToken)
      }, 5000)
    }
  }

  const handleMoveToToday = (todoId: string) => {
    moveTodoToDate(todoId, todayStr)
    toast("Task moved", { duration: 2000 })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-background border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-border/50 text-center">
          <h1 className="text-4xl font-bold mb-2">{greeting}</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-medium">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Section 1: Yesterday's unfinished */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-border"></span>
              {"Yesterday's Unfinished"}
            </h2>
            <div className="space-y-2">
              {yesterdayUnfinished.length > 0 ? (
                yesterdayUnfinished.map(todo => (
                  <div key={todo.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                    <span className="text-sm">{todo.text}</span>
                    <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase font-bold hover:bg-[var(--accent-color)] hover:text-white"
                      onClick={() => handleMoveToToday(todo.id)}
                      >
                        <MoveRight className="size-3 mr-1" /> Move to Today
                      </Button>
                      <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase font-bold hover:bg-destructive hover:text-white"
                      onClick={() => handleDeleteTodo(todo.id)}
                    >
                      <Trash2 className="size-3 mr-1" /> Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[10px] uppercase font-bold hover:bg-muted hover:text-foreground"
                      onClick={() => setKeptTodoIds((current) => [...current, todo.id])}
                    >
                      Keep
                    </Button>
                  </div>
                </div>
              ))
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground font-medium">
                  You crushed yesterday 🎉
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Today's schedule */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-border"></span>
              {"Today's Schedule"}
            </h2>
            <div className="space-y-1">
              {todaySchedule.length > 0 ? (
                todaySchedule.map(todo => (
                  <div key={todo.id} className="flex items-center gap-3 p-2 text-sm opacity-70">
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                    <span>{todo.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-sm text-muted-foreground italic">
                  No tasks scheduled yet
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Top 3 priorities */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-border"></span>
              Top 3 Priorities
            </h2>
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-xl font-bold text-muted-foreground/30">{i + 1}</span>
                  <Input 
                    placeholder="Focus on..."
                    value={priorities[i]}
                    onChange={(e) => {
                      const newPriorities = [...priorities]
                      newPriorities[i] = e.target.value
                      setPriorities(newPriorities)
                    }}
                    className="h-12 bg-muted/20 border-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] text-base"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-border/50">
          <Button 
            className="w-full h-14 text-lg font-bold bg-[var(--accent-color)] hover:opacity-90 transition-opacity text-white rounded-xl"
            onClick={handleStartDay}
          >
            Start My Day <ArrowRight className="ml-2 size-5" />
          </Button>
          <button
            type="button"
            onClick={handleSkipForToday}
            className="mt-4 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for today
          </button>
        </div>
      </div>
    </div>
  )
}

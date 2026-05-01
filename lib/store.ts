"use client"

import { addDays, addMonths, format, isValid, parseISO } from 'date-fns'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeColor = 
  | 'green' | 'lime' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'violet' | 'purple'
  | 'pink' | 'red' | 'orange' | 'yellow' | 'slate' | 'zinc'

export type BulletStyle = 'none' | 'dot' | 'dash' | 'arrow'

export interface SubTask {
  id: string
  title: string
  completed: boolean
  parentId: string
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Todo {
  id: string
  text: string
  completed: boolean
  date: string | null // ISO date string
  createdAt: number
  endOfDay: boolean
  isSyncing?: boolean
  syncStatus?: 'local'
  time?: string
  reminderTime?: string
  reminderOffsetMinutes?: number | null
  reminderLoopRule?: string | null
  scheduledNotificationId?: string | null
  durationMinutes?: number
  color?: string
  icon?: string
  photoDataUrl?: string
  url?: string
  location?: string
  isHeading?: boolean
  subtasks: SubTask[]
  isRecurring?: boolean
  recurringFrequency?: 'daily' | 'weekday' | 'weekly' | 'monthly'
  recurringDays?: number[] // 0-6 for Sunday-Saturday
  recurringInterval?: number
  recurringCustomText?: string
  parentId?: string | null // For recurring instances
  priority?: 'high' | 'medium' | 'low' | 'none' | 'urgent' | 'important' | 'normal'
  labelIds: string[]
  tags?: string[] // Legacy migrated tag IDs
  storeName?: string
  returnDeadline?: string
  notes?: string
}

export type CalendarTimeframe = "week" | "next-week" | "next-month" | "next-year" | "this-month" | "this-year"
export type CalendarFilterMode = "all" | "ppl"
export type RightPageViewMode = "default" | "project" | "calendar"
export type ShortcutType = "NEXT_WEEK" | "NEXT_MONTH" | "NEXT_YEAR" | "PPL"
export type MainViewMode = "standard" | "dual"
export type DualViewRange = "NEXT_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "PPL"
export type TodoPriority = 'urgent' | 'important' | 'normal'
export type TaskSearchStatusFilter = "all" | "done" | "todo"
export type TaskSearchWhenFilter =
  | "all"
  | "today"
  | "tomorrow"
  | "this-week"
  | "next-week"
  | "this-month"
  | "next-month"
  | "this-year"
  | "someday"
export type TaskSearchPriorityFilter = "all" | "high" | "med" | "low" | "none"
export type TaskSearchRecurringFilter = "all" | "yes" | "no" | "both"
export type TaskSearchBooleanFilter = "all" | "yes" | "no" | "both"
export type TaskSearchAlertFilter = "all" | "none" | "5min" | "10min" | "15min" | "30min" | "1hr"
export type TaskSearchDateAddedFilter = "all" | "today" | "yesterday" | "this-week"

export interface TaskSearchFilters {
  status: TaskSearchStatusFilter
  when: TaskSearchWhenFilter
  priority: TaskSearchPriorityFilter
  recurring: TaskSearchRecurringFilter
  icon: string | null
  attachment: TaskSearchBooleanFilter
  url: TaskSearchBooleanFilter
  phone: TaskSearchBooleanFilter
  alert: TaskSearchAlertFilter
  dateAdded: TaskSearchDateAddedFilter
}

export interface List {
  id: string
  name: string
  todos: Todo[]
  type: 'list' | 'planning' | 'shopping-returns'
  tabId?: string
}

export interface ListTab {
  id: string
  name: string
}

export interface UserPreferences {
  columns: 1 | 3 | 5 | 7
  textSize: 'sm' | 'md' | 'lg'
  spacing: 'compact' | 'normal' | 'comfortable'
  timelineStartHour: number
  timelineEndHour: number
  showCompleted: boolean
  bulletStyle: BulletStyle
  startOnYesterday: boolean
  autoMoveUndoneToToday: boolean
  theme: 'light' | 'dark'
  accentColor: string
  showCelebrations: boolean
  colorPalette: string[]
  showDotGridBackground: boolean
  defaultLabelId: string | null
  displayName: string
}

export interface NaturalLanguagePreviewToken {
  key: string
  label: string
}

export interface ParsedNaturalLanguageTask {
  cleanText: string
  scheduledDate?: string
  subtaskTitles: string[]
  recurrence?: {
    isRecurring: boolean
    recurringFrequency?: 'daily' | 'weekday' | 'weekly' | 'monthly'
    recurringDays?: number[]
    recurringInterval?: number
    customText?: string
    label: string
  }
  priority?: Todo['priority']
  labelIds: string[]
  newLabelNames: string[]
  time?: string
  previewTokens: NaturalLanguagePreviewToken[]
}

type OptimisticTaskCandidate = {
  text: string
  optimisticDate: string
}

const WEEKDAY_PATTERN = "\\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b"

interface DeletedTodoBuffer {
  items: Todo[]
  token: string
}

type CalendarTodoInput = Omit<Todo, 'id' | 'subtasks' | 'endOfDay' | 'createdAt' | 'labelIds'> & {
  id?: string
  endOfDay?: boolean
  createdAt?: number
  labelIds?: string[]
  subtasks?: Array<Partial<SubTask> & { title?: string; text?: string }>
}

type SnoozeOption = "later-today" | "tomorrow" | "this-weekend" | "next-week"

type TaskHistorySnapshot = {
  calendarTodos: Todo[]
  collapsedSubtasks: Record<string, boolean>
  selectedTaskIds: string[]
}

type TaskHistoryEntry = {
  label: string
  snapshot: TaskHistorySnapshot
}

type CelebrationEvent = {
  id: string
  taskCompleted: boolean
  dayCompleted: boolean
  date: string | null
  createdAt: number
}

interface LemonadeStore {
  // Preferences
  preferences: UserPreferences
  setPreferences: (prefs: Partial<UserPreferences>) => void
  celebrationEvent: CelebrationEvent | null
  clearCelebrationEvent: () => void
  
  // Calendar todos
  calendarTodos: Todo[]
  lastCreatedTodoId: string | null
  lastDeleted: DeletedTodoBuffer | null
  lastAutoMovedCount: number
  addCalendarTodo: (todo: CalendarTodoInput) => string
  clearLastCreatedTodoId: () => void
  clearLastDeleted: (token?: string) => void
  clearLastAutoMovedCount: () => void
  restoreLastDeletedTodo: () => void
  updateCalendarTodo: (id: string, updates: Partial<Todo>) => void
  updateCalendarTodoInstance: (id: string, updates: Partial<Todo>) => void
  deleteCalendarTodo: (id: string) => void
  toggleCalendarTodo: (id: string) => void
  toggleEndOfDay: (id: string) => void
  addSubtask: (todoId: string, text: string) => void
  editSubtask: (todoId: string, subtaskId: string, title: string) => void
  toggleSubtask: (todoId: string, subtaskId: string) => void
  deleteSubtask: (todoId: string, subtaskId: string) => void
  collapsedSubtasks: Record<string, boolean>
  setSubtasksCollapsed: (todoId: string, collapsed: boolean) => void
  toggleSubtasksCollapsed: (todoId: string) => void
  moveTodoToDate: (todoId: string, newDate: string) => void
  moveCalendarTodoToList: (todoId: string, listId: string) => void
  moveListTodoToList: (sourceListId: string, todoId: string, targetListId: string) => void
  moveListTodoToDate: (sourceListId: string, todoId: string, newDate: string) => void
  snoozeCalendarTodo: (todoId: string, option: SnoozeOption) => void
  duplicateCalendarTodo: (todoId: string) => void
  reorderCalendarTodo: (todoId: string, targetId: string, position: "before" | "after") => void
  skipRecurringOccurrence: (todoId: string) => void
  splitCalendarTodo: (todoId: string, titles: string[]) => void
  convertTodoToSubtask: (todoId: string, parentId: string) => void
  selectedTaskIds: string[]
  toggleTaskSelection: (todoId: string) => void
  clearTaskSelection: () => void
  mergeSelectedTasks: (mergedTitle: string) => void
  taskHistoryPast: TaskHistoryEntry[]
  taskHistoryFuture: TaskHistoryEntry[]
  canUndoTaskAction: boolean
  canRedoTaskAction: boolean
  undoTaskAction: () => string | null
  redoTaskAction: () => string | null
  applyTaskIdMap: (idMap: Record<string, string>) => void
  
  // Lists
  listTabs: ListTab[]
  addListTab: (name: string) => void
  renameListTab: (id: string, name: string) => void
  deleteListsInTab: (tabId: string) => void
  lists: List[]
  addList: (name: string, type: 'list' | 'planning', tabId?: string) => void
  deleteList: (id: string) => void
  renameList: (id: string, name: string) => void
  reorderList: (tabId: string, draggedId: string, targetId: string) => void
  addListAdjacent: (referenceListId: string, position: 'left' | 'right') => void
  moveListToTab: (listId: string, tabId: string) => void
  addListTodo: (listId: string, text: string) => void
  updateListTodo: (listId: string, todoId: string, updates: Partial<Todo>) => void
  deleteListTodo: (listId: string, todoId: string) => void
  toggleListTodo: (listId: string, todoId: string) => void
  
 
  
  // Labels
  labels: Label[]
  addLabel: (name: string, color: string) => void
  ensureLabelIds: (names: string[]) => string[]
  editLabel: (id: string, name: string, color: string) => void
  deleteLabel: (id: string) => void
  addLabelToTask: (taskId: string, labelId: string) => void
  removeLabelFromTask: (taskId: string, labelId: string) => void
  
  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchModeActive: boolean
  setSearchModeActive: (active: boolean) => void
  taskSearchFilters: TaskSearchFilters
  setTaskSearchFilters: (updates: Partial<TaskSearchFilters>) => void
  resetTaskSearchFilters: () => void
  
  // Filter
  labelFilterIds: string[]
  activeFilterColor: string | null
  setActiveFilterColor: (color: string | null) => void
  setLabelFilterIds: (labelIds: string[]) => void
  toggleLabelFilter: (labelId: string) => void
  clearLabelFilters: () => void
  
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Calendar selection
  selectedCalendarDate: string
  setSelectedCalendarDate: (date: string) => void
  calendarTimeframe: CalendarTimeframe
  setCalendarTimeframe: (timeframe: CalendarTimeframe) => void
  calendarFilterMode: CalendarFilterMode
  setCalendarFilterMode: (mode: CalendarFilterMode) => void
  // UI-only: whether the user has scrolled away from today's anchor in the calendar view.
  calendarPastTodayScroll: boolean
  setCalendarPastTodayScroll: (value: boolean) => void
  aiMode: boolean
  setAiMode: (next: boolean) => void
  rightPageViewMode: RightPageViewMode
  setRightPageViewMode: (mode: RightPageViewMode) => void
  selectedShortcut: ShortcutType | null
  setSelectedShortcut: (shortcut: ShortcutType | null) => void
  mainViewMode: MainViewMode
  setMainViewMode: (mode: MainViewMode) => void
  dualViewRange: DualViewRange | null
  setDualViewRange: (range: DualViewRange | null) => void
  playgroundNote: string
  setPlaygroundNote: (note: string) => void
  quickAddSessionActive: boolean
  quickAddSessionTodoIds: string[]
  startQuickAddSession: () => void
  endQuickAddSession: () => void
  weekCount: number
  lastSessionDate: string | null
  incrementWeekCount: () => void
  decrementWeekCount: () => void

    // Calendar expansion
    isCalendarExpanded: boolean
    toggleCalendar: () => void

    // Recurring todos
    generateRecurringInstances: () => void

    // Auto-rollover
    autoRollover: () => void
}

type PersistedLemonadeStore = Partial<
  Pick<
    LemonadeStore,
    | 'preferences'
    | 'calendarTodos'
    | 'listTabs'
    | 'lists'
    | 'labels'
    | 'searchQuery'
    | 'labelFilterIds'
    | 'collapsedSubtasks'
    | 'sidebarOpen'
    | 'weekCount'
    | 'isCalendarExpanded'
    | 'lastSessionDate'
  >
>

const generateId = () => Math.random().toString(36).substring(2, 15)

export const createOptimisticTodoId = (_scope = "task") => globalThis.crypto.randomUUID()

const TASK_HISTORY_LIMIT = 50
const LEGACY_ATTACHMENT_PREFIX = "Attachment: "
const LEGACY_LINK_PATTERN = /^(https?:\/\/|www\.|tel:|\+?[\d()\-\s]{6,})/i

const buildLocalDateTime = (dateKey: string, timeValue: string) => {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part))
  const [hour, minute] = timeValue.split(":").map((part) => Number(part))
  if (!year || !month || !day) return null
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

const computeReminderScheduleIso = (todo: Pick<Todo, "date" | "time" | "reminderOffsetMinutes" | "completed">) => {
  if (!todo.date) return null
  if (!todo.time) return null
  if (typeof todo.reminderOffsetMinutes !== "number" || !Number.isFinite(todo.reminderOffsetMinutes)) return null
  if (todo.completed) return null

  const base = buildLocalDateTime(todo.date, todo.time)
  if (!base) return null
  const scheduled = new Date(base.getTime() - todo.reminderOffsetMinutes * 60 * 1000)
  return scheduled.toISOString()
}

const scheduleReminderForTodo = async (todo: Todo) => {
  if (typeof window === "undefined") return
  const scheduledFor = computeReminderScheduleIso(todo)
  if (!scheduledFor) return

  try {
    const response = await fetch("/api/notifications/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: todo.id,
        title: todo.text,
        scheduledFor,
        loopRule:
          typeof todo.reminderLoopRule === "string" && todo.reminderLoopRule.trim()
            ? todo.reminderLoopRule.trim()
            : null,
      }),
    })
    if (!response.ok) return
    const data = (await response.json()) as { scheduledNotificationId?: string }
    if (typeof data.scheduledNotificationId === "string" && data.scheduledNotificationId) {
      useLemonadeStore.getState().updateCalendarTodo(todo.id, {
        scheduledNotificationId: data.scheduledNotificationId,
      })
    }
  } catch {
    // ignore (offline / permission denied / etc.)
  }
}

export const DEFAULT_TASK_SEARCH_FILTERS: TaskSearchFilters = {
  status: "all",
  when: "all",
  priority: "all",
  recurring: "all",
  icon: null,
  attachment: "all",
  url: "all",
  phone: "all",
  alert: "all",
  dateAdded: "all",
}

const extractLegacyStructuredLink = (notes?: string) => {
  const lines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (line.startsWith(LEGACY_ATTACHMENT_PREFIX)) {
      continue
    }

    if (LEGACY_LINK_PATTERN.test(line)) {
      return line
    }
  }

  return undefined
}

const cloneTaskHistorySnapshot = (state: Pick<LemonadeStore, "calendarTodos" | "collapsedSubtasks" | "selectedTaskIds">): TaskHistorySnapshot => ({
  calendarTodos: state.calendarTodos.map((todo) => ({
    ...todo,
    subtasks: todo.subtasks.map((subtask) => ({ ...subtask })),
  })),
  collapsedSubtasks: { ...state.collapsedSubtasks },
  selectedTaskIds: [...state.selectedTaskIds],
})

const pushTaskHistory = (
  state: LemonadeStore,
  label: string
): Pick<LemonadeStore, "canUndoTaskAction" | "canRedoTaskAction"> & { taskHistoryPast: TaskHistoryEntry[]; taskHistoryFuture: TaskHistoryEntry[] } => ({
  taskHistoryPast: [
    ...state.taskHistoryPast.slice(-(TASK_HISTORY_LIMIT - 1)),
    { label, snapshot: cloneTaskHistorySnapshot(state) },
  ],
  taskHistoryFuture: [],
  canUndoTaskAction: true,
  canRedoTaskAction: false,
})

const ATTACHMENT_PREFIX = "Attachment: "

const isStructuredLinkValue = (value: string) => {
  const normalized = value.trim()

  return (
    /^https?:\/\//i.test(normalized) ||
    /^www\./i.test(normalized) ||
    /^tel:/i.test(normalized) ||
    /^\+?[\d()\-\s]{6,}$/.test(normalized)
  )
}

const isStructuredPhoneValue = (value: string) => {
  const normalized = value.trim()
  return /^tel:/i.test(normalized) || /^\+?[\d()\-\s]{6,}$/.test(normalized)
}

const isStructuredUrlValue = (value: string) => {
  const normalized = value.trim()
  return /^(https?:\/\/|www\.)/i.test(normalized)
}

export const extractTaskNotesMetadata = (notes?: string) => {
  const lines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  let hasAttachment = false
  let hasUrl = false
  let hasPhone = false

  for (const line of lines) {
    if (line.startsWith(ATTACHMENT_PREFIX)) {
      hasAttachment = true
      continue
    }

    if (!isStructuredLinkValue(line)) {
      continue
    }

    if (isStructuredPhoneValue(line)) {
      hasPhone = true
    }

    if (isStructuredUrlValue(line)) {
      hasUrl = true
    }
  }

  return { hasAttachment, hasUrl, hasPhone }
}

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addLocalDays = (date: Date, amount: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const startOfWeekMonday = (date: Date) => {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return startOfLocalDay(addLocalDays(date, diff))
}

const endOfWeekSunday = (date: Date) => startOfLocalDay(addLocalDays(startOfWeekMonday(date), 6))

const createdAtMatchesFilter = (createdAt: number, filter: TaskSearchDateAddedFilter, referenceDate: Date) => {
  if (filter === "all") return true

  const createdDate = startOfLocalDay(new Date(createdAt))
  const today = startOfLocalDay(referenceDate)

  switch (filter) {
    case "today":
      return createdDate.getTime() === today.getTime()
    case "yesterday":
      return createdDate.getTime() === addLocalDays(today, -1).getTime()
    case "this-week": {
      const weekStart = startOfWeekMonday(today)
      return createdDate >= weekStart && createdDate <= endOfWeekSunday(today)
    }
    default:
      return true
  }
}

export const normalizeTodoPriority = (value: unknown): TodoPriority => {
  if (value === "urgent" || value === "important" || value === "normal") {
    return value
  }

  if (value === "high") {
    return "urgent"
  }

  if (value === "medium") {
    return "important"
  }

  return "normal"
}

const taskDateMatchesFilter = (todo: Todo, filter: TaskSearchWhenFilter, referenceDate: Date) => {
  if (filter === "all") return true
  if (filter === "someday") return todo.date === null
  if (!todo.date) return false

  const today = startOfLocalDay(referenceDate)
  const todayKey = formatLocalDateKey(today)
  const tomorrowKey = formatLocalDateKey(addLocalDays(today, 1))

  switch (filter) {
    case "today":
      return todo.date === todayKey
    case "tomorrow":
      return todo.date === tomorrowKey
    case "this-week": {
      const weekStart = startOfWeekMonday(today)
      const weekEnd = endOfWeekSunday(today)
      return todo.date >= formatLocalDateKey(weekStart) && todo.date <= formatLocalDateKey(weekEnd)
    }
    case "next-week": {
      const nextWeekStart = addLocalDays(startOfWeekMonday(today), 7)
      const nextWeekEnd = addLocalDays(nextWeekStart, 6)
      return todo.date >= formatLocalDateKey(nextWeekStart) && todo.date <= formatLocalDateKey(nextWeekEnd)
    }
    case "this-month": {
      const monthPrefix = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`
      return todo.date.startsWith(monthPrefix)
    }
    case "next-month": {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      const monthPrefix = `${nextMonth.getFullYear()}-${`${nextMonth.getMonth() + 1}`.padStart(2, "0")}`
      return todo.date.startsWith(monthPrefix)
    }
    case "this-year":
      return todo.date.startsWith(`${today.getFullYear()}-`)
    default:
      return true
  }
}

const taskPriorityMatchesFilter = (todo: Todo, filter: TaskSearchPriorityFilter) => {
  if (filter === "all") return true
  const priority = normalizeTodoPriority(todo.priority)

  switch (filter) {
    case "high":
      return priority === "urgent"
    case "med":
      return priority === "important"
    case "low":
      return priority === "normal"
    case "none":
      return todo.priority == null || todo.priority === "none"
    default:
      return true
  }
}

const taskAlertMatchesFilter = (todo: Todo, filter: TaskSearchAlertFilter) => {
  if (filter === "all") return true
  const value = todo.reminderOffsetMinutes

  switch (filter) {
    case "none":
      return value == null
    case "5min":
      return value === 5
    case "10min":
      return value === 10
    case "15min":
      return value === 15
    case "30min":
      return value === 30
    case "1hr":
      return value === 60
    default:
      return true
  }
}

export const todoMatchesSearchFilters = (
  todo: Todo,
  options: {
    searchQuery: string
    searchModeActive?: boolean
    taskSearchFilters?: TaskSearchFilters
    labelFilterIds?: string[]
    activeFilterColor?: string | null
    showCompleted?: boolean
    referenceDate?: Date
  }
) => {
  const {
    searchQuery,
    searchModeActive = false,
    taskSearchFilters = DEFAULT_TASK_SEARCH_FILTERS,
    labelFilterIds = [],
    activeFilterColor = null,
    showCompleted = true,
    referenceDate = new Date(),
  } = options

  if (searchModeActive) {
    if (taskSearchFilters.status === "done" && !todo.completed) return false
    if (taskSearchFilters.status === "todo" && todo.completed) return false
  } else if (!showCompleted && todo.completed) {
    return false
  }

  if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
  if (labelFilterIds.length > 0 && !todo.labelIds.some((labelId) => labelFilterIds.includes(labelId))) return false
  if (activeFilterColor && todo.color !== activeFilterColor) return false
  if (!taskDateMatchesFilter(todo, taskSearchFilters.when, referenceDate)) return false
  if (!taskPriorityMatchesFilter(todo, taskSearchFilters.priority)) return false
  if (taskSearchFilters.recurring === "yes" && !todo.isRecurring) return false
  if (taskSearchFilters.recurring === "no" && todo.isRecurring) return false
  if (taskSearchFilters.icon && todo.icon !== taskSearchFilters.icon) return false

  const notesMetadata = extractTaskNotesMetadata(todo.notes)
  if (taskSearchFilters.attachment === "yes" && !notesMetadata.hasAttachment) return false
  if (taskSearchFilters.attachment === "no" && notesMetadata.hasAttachment) return false
  if (taskSearchFilters.url === "yes" && !notesMetadata.hasUrl) return false
  if (taskSearchFilters.url === "no" && notesMetadata.hasUrl) return false
  if (taskSearchFilters.phone === "yes" && !notesMetadata.hasPhone) return false
  if (taskSearchFilters.phone === "no" && notesMetadata.hasPhone) return false
  if (!taskAlertMatchesFilter(todo, taskSearchFilters.alert)) return false
  if (!createdAtMatchesFilter(todo.createdAt, taskSearchFilters.dateAdded, referenceDate)) return false

  return true
}

const normalizeSubtask = (
  subtask: Partial<SubTask> & { id?: string; title?: string; text?: string; completed?: boolean; parentId?: string },
  fallbackParentId: string
): SubTask => ({
  id: typeof subtask.id === "string" ? subtask.id : generateId(),
  title:
    typeof subtask.title === "string"
      ? subtask.title
      : typeof subtask.text === "string"
        ? subtask.text
        : "",
  completed: typeof subtask.completed === "boolean" ? subtask.completed : false,
  parentId: typeof subtask.parentId === "string" ? subtask.parentId : fallbackParentId,
})

// Persisted storage version history:
// 0: legacy persisted state before explicit versioning/migrations
// 1: normalized persisted preferences, todos, lists, weekCount, and calendar expansion
// 2: normalized task metadata fields including reminders, duration, icons, photos, URLs, and locations
//
// When you add or rename persisted fields:
// 1. bump STORAGE_VERSION
// 2. add the migration branch in `migrate`
// 3. keep `normalizePersistedState` backward-safe for older payloads
export const STORAGE_VERSION = 2
export const LEMONADE_STORAGE_KEY = "lemonade-storage"

const normalizeTodo = (todo: Todo, fallbackCreatedAt: number): Todo => {
  const fallbackLabelIds = Array.isArray(todo.labelIds)
    ? todo.labelIds
    : Array.isArray(todo.tags)
      ? todo.tags
      : []

  return {
    ...todo,
    createdAt: typeof todo.createdAt === "number" ? todo.createdAt : fallbackCreatedAt,
    endOfDay: typeof todo.endOfDay === "boolean" ? todo.endOfDay : false,
    isSyncing: typeof todo.isSyncing === "boolean" ? todo.isSyncing : false,
    syncStatus: todo.syncStatus === "local" ? "local" : undefined,
    reminderOffsetMinutes:
      typeof todo.reminderOffsetMinutes === "number" && Number.isFinite(todo.reminderOffsetMinutes)
        ? todo.reminderOffsetMinutes
        : todo.reminderOffsetMinutes === 0
          ? 0
          : null,
    durationMinutes:
      typeof todo.durationMinutes === "number" && Number.isFinite(todo.durationMinutes) && todo.durationMinutes > 0
        ? Math.floor(todo.durationMinutes)
        : undefined,
    icon: typeof todo.icon === "string" && todo.icon.trim().length > 0 ? todo.icon : undefined,
    photoDataUrl:
      typeof todo.photoDataUrl === "string" && todo.photoDataUrl.trim().length > 0
        ? todo.photoDataUrl
        : undefined,
    url:
      typeof todo.url === "string" && todo.url.trim().length > 0
        ? todo.url.trim()
        : extractLegacyStructuredLink(todo.notes),
    location:
      typeof todo.location === "string" && todo.location.trim().length > 0
        ? todo.location.trim()
        : undefined,
    recurringInterval:
      typeof todo.recurringInterval === "number" && Number.isFinite(todo.recurringInterval) && todo.recurringInterval > 1
        ? Math.floor(todo.recurringInterval)
        : undefined,
    recurringCustomText:
      typeof todo.recurringCustomText === "string" && todo.recurringCustomText.trim().length > 0
        ? todo.recurringCustomText.trim()
        : undefined,
    subtasks: Array.isArray(todo.subtasks) ? todo.subtasks.map((subtask) => normalizeSubtask(subtask, todo.id)) : [],
    labelIds: fallbackLabelIds,
    priority: normalizeTodoPriority(todo.priority),
    storeName: typeof todo.storeName === "string" ? todo.storeName : undefined,
    returnDeadline: typeof todo.returnDeadline === "string" ? todo.returnDeadline : undefined,
    notes: typeof todo.notes === "string" ? todo.notes : undefined,
  }
}

const normalizeLegacyTodo = (todo: Todo, fallbackCreatedAt: number): Todo => ({
  ...normalizeTodo(todo, fallbackCreatedAt),
  parentId: todo.parentId ?? null,
})

const normalizePersistedPreferences = (
  preferences: Partial<UserPreferences> | undefined,
  fallbackPreferences: UserPreferences
): UserPreferences => ({
  ...fallbackPreferences,
  ...preferences,
  columns:
    preferences?.columns === 1 ||
    preferences?.columns === 3 ||
    preferences?.columns === 5 ||
    preferences?.columns === 7
      ? preferences.columns
      : fallbackPreferences.columns,
  textSize: normalizeTextSizePreference(preferences?.textSize),
  spacing: normalizeSpacingPreference(preferences?.spacing),
  timelineStartHour: normalizeTimelineHourPreference(preferences?.timelineStartHour, fallbackPreferences.timelineStartHour),
  timelineEndHour: normalizeTimelineHourPreference(preferences?.timelineEndHour, fallbackPreferences.timelineEndHour),
  autoMoveUndoneToToday: preferences?.autoMoveUndoneToToday ?? fallbackPreferences.autoMoveUndoneToToday,
  accentColor:
    typeof preferences?.accentColor === "string"
      ? preferences.accentColor === "#852CE6"
        ? "#2563EB"
        : preferences.accentColor
      : fallbackPreferences.accentColor,
  colorPalette: preferences?.colorPalette ?? fallbackPreferences.colorPalette,
  showDotGridBackground: preferences?.showDotGridBackground ?? fallbackPreferences.showDotGridBackground,
  defaultLabelId:
    typeof preferences?.defaultLabelId === "string" ? preferences.defaultLabelId : null,
  displayName:
    typeof preferences?.displayName === "string" && preferences.displayName.trim().length > 0
      ? preferences.displayName
      : fallbackPreferences.displayName,
})

const clampWeekCount = () => 1

export const FIXED_LIST_TABS: ListTab[] = [
  { id: 'planning-tab', name: 'PLANNING' },
  { id: 'my-lists-tab', name: 'MY LISTS' },
  { id: 'shopping-returns-tab', name: 'SHOPPING RETURNS' },
]

export const FIXED_LISTS: List[] = [
  { id: 'brain-dump', name: 'BRAIN DUMP', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'grocery', name: 'GROCERY LIST', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'to-buy', name: 'TO BUY', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'shopping-returns', name: 'SHOPPING RETURNS', todos: [], type: 'shopping-returns', tabId: 'shopping-returns-tab' },
  { id: 'to-read', name: 'TO READ', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'this-week', name: 'THIS WEEK', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'next-week', name: 'NEXT WEEK', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'this-month', name: 'THIS MONTH', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'next-month', name: 'NEXT MONTH', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'this-year', name: 'THIS YEAR', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'next-year', name: 'NEXT YEAR', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'goals', name: 'GOALS', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'someday', name: 'SOMEDAY', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'ideas', name: 'IDEAS', todos: [], type: 'planning', tabId: 'planning-tab' },
]

export const ensureFixedTabs = (tabs: ListTab[]): ListTab[] => {
  const byId = new Map(tabs.map((tab) => [tab.id, tab]))
  return FIXED_LIST_TABS.map((tab) => byId.get(tab.id) ?? tab).concat(
    tabs.filter((tab) => !FIXED_LIST_TABS.some((fixedTab) => fixedTab.id === tab.id))
  )
}

export const ensureFixedLists = (lists: List[]): List[] => {
  const existing = new Map(lists.map((list) => [list.id, list]))
  const normalizedExisting = lists.map((list) =>
    list.id === "shopping-returns"
      ? { ...list, type: "shopping-returns" as const, tabId: "shopping-returns-tab" }
      : list
  )

  const fixedLists = FIXED_LISTS.map((list) => {
    const current = existing.get(list.id)
    if (!current) {
      return list
    }

    if (list.id === "shopping-returns") {
      return {
        ...current,
        name: "SHOPPING RETURNS",
        type: "shopping-returns" as const,
        tabId: "shopping-returns-tab",
      }
    }

    return current
  })

  const combined = fixedLists.concat(
    normalizedExisting.filter((list) => !FIXED_LISTS.some((fixedList) => fixedList.id === list.id))
  )

  // Reduce duplicate planning lists with the same display name (common when older sessions
  // created custom lists named like our fixed planning buckets).
  //
  // Rule: if a list's name matches a fixed planning list name exactly, we only keep the
  // canonical fixed list id(s) for that name and drop any non-canonical duplicates.
  const canonicalPlanningByName = new Map<string, Set<string>>()
  FIXED_LISTS.filter((list) => list.tabId === "planning-tab").forEach((list) => {
    const key = list.name.trim().toUpperCase()
    const current = canonicalPlanningByName.get(key) ?? new Set<string>()
    current.add(list.id)
    canonicalPlanningByName.set(key, current)
  })

  return combined.filter((list) => {
    const normalizedName = list.name.trim().toUpperCase()
    const inPlanning = (list.tabId ?? (list.type === "planning" ? "planning-tab" : "")) === "planning-tab"
    if (!inPlanning) return true

    const canonicalIds = canonicalPlanningByName.get(normalizedName)
    if (!canonicalIds) return true

    // If it shares a name with a fixed planning list, only keep the canonical fixed one.
    return canonicalIds.has(list.id)
  })
}

const ensureUniqueTodoIds = (todos: Todo[]) => {
  const seenIds = new Set<string>()

  return todos.map((todo) => {
    if (!seenIds.has(todo.id)) {
      seenIds.add(todo.id)
      return todo
    }

    const nextId = generateId()
    seenIds.add(nextId)
    return { ...todo, id: nextId }
  })
}

export const migratePersistedLemonadeState = (
  persistedState: unknown,
  fallbackState?: LemonadeStore
): PersistedLemonadeStore => {
  const persisted = (persistedState && typeof persistedState === "object"
    ? persistedState
    : {}) as PersistedLemonadeStore

  const fallbackPreferences = fallbackState?.preferences ?? {
    columns: 7,
    textSize: "md",
    spacing: "normal",
    timelineStartHour: 6,
    timelineEndHour: 23,
    showCompleted: true,
    bulletStyle: "none",
    startOnYesterday: false,
    autoMoveUndoneToToday: true,
    theme: "light",
    accentColor: "#2563EB",
    showCelebrations: false,
    colorPalette: DEFAULT_COLOR_PALETTE,
    showDotGridBackground: true,
    defaultLabelId: null,
    displayName: "Alessandro User",
  }

  const isLegacyVersion = typeof fallbackState === "undefined"

  return {
    ...persisted,
    preferences: normalizePersistedPreferences(persisted.preferences, fallbackPreferences),
    calendarTodos: Array.isArray(persisted.calendarTodos)
      ? ensureUniqueTodoIds(
          persisted.calendarTodos.map((todo, index) =>
            isLegacyVersion ? normalizeLegacyTodo(todo, index) : normalizeTodo(todo, index)
          )
        )
      : [],
    listTabs: ensureFixedTabs(Array.isArray(persisted.listTabs) ? persisted.listTabs : []),
    lists: ensureFixedLists(
      Array.isArray(persisted.lists)
      ? persisted.lists.map((list, listIndex) => ({
          ...list,
          todos: Array.isArray(list.todos)
            ? ensureUniqueTodoIds(
                list.todos.map((todo, todoIndex) =>
                  isLegacyVersion
                    ? normalizeLegacyTodo(todo, listIndex * 1000 + todoIndex)
                    : normalizeTodo(todo, listIndex * 1000 + todoIndex)
                )
              )
            : [],
        }))
      : []
    ),
    labels: Array.isArray((persisted as { labels?: Label[] }).labels)
      ? (persisted as { labels: Label[] }).labels
      : Array.isArray((persisted as { tags?: Label[] }).tags)
        ? (persisted as { tags: Label[] }).tags
        : [],
    searchQuery: typeof persisted.searchQuery === "string" ? persisted.searchQuery : "",
    labelFilterIds: Array.isArray((persisted as { labelFilterIds?: string[] }).labelFilterIds)
      ? (persisted as { labelFilterIds: string[] }).labelFilterIds
      : typeof (persisted as { tagFilterId?: string }).tagFilterId === "string"
        ? [(persisted as { tagFilterId: string }).tagFilterId]
        : [],
    collapsedSubtasks:
      persisted && typeof persisted === "object" && (persisted as { collapsedSubtasks?: unknown }).collapsedSubtasks && typeof (persisted as { collapsedSubtasks?: unknown }).collapsedSubtasks === "object"
        ? (Object.fromEntries(
            Object.entries((persisted as { collapsedSubtasks: Record<string, unknown> }).collapsedSubtasks).filter(
              ([, value]) => typeof value === "boolean"
            )
          ) as Record<string, boolean>)
        : {},
    sidebarOpen: typeof persisted.sidebarOpen === "boolean" ? persisted.sidebarOpen : false,
    weekCount: clampWeekCount(),
    lastSessionDate:
      typeof (persisted as { lastSessionDate?: string }).lastSessionDate === "string"
        ? (persisted as { lastSessionDate: string }).lastSessionDate
        : null,
    isCalendarExpanded:
      typeof persisted.isCalendarExpanded === "boolean"
        ? persisted.isCalendarExpanded
        : fallbackState?.isCalendarExpanded ?? false,
  }
}

const DEFAULT_COLOR_PALETTE = [
  '#fef08a',
  '#bbf7d0',
  '#bfdbfe',
  '#fbcfe8',
  '#fed7aa',
]

type TokenRange = {
  start: number
  end: number
  type: 'date' | 'recurrence' | 'priority' | 'tag' | 'time'
  preview: NaturalLanguagePreviewToken
  payload?: unknown
}

const startOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export const formatLocalDateKey = (date: Date) => {
  const normalized = startOfDay(date)
  const year = normalized.getFullYear()
  const month = `${normalized.getMonth() + 1}`.padStart(2, '0')
  const day = `${normalized.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseLocalDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export const normalizeCalendarDateKey = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return undefined
  }

  const parsed = parseISO(trimmed)
  if (!isValid(parsed)) {
    return undefined
  }

  return format(parsed, "yyyy-MM-dd")
}

const toIsoDate = (date: Date) => formatLocalDateKey(date)

const normalizeTodoDate = (value: string | null | undefined) => {
  if (value === null) {
    return null
  }
  const normalized = normalizeCalendarDateKey(value)

  if (!normalized) {
    return toIsoDate(new Date())
  }

  return normalized
}

const getInitialCalendarDate = (startOnYesterday: boolean) => {
  const date = new Date()
  if (startOnYesterday) {
    date.setDate(date.getDate() - 1)
  }
  return formatLocalDateKey(date)
}

const normalizeTextSizePreference = (value: unknown): UserPreferences["textSize"] => {
  if (value === "sm" || value === "md" || value === "lg") {
    return value
  }

  if (value === "S") return "sm"
  if (value === "L") return "lg"
  return "md"
}

const normalizeSpacingPreference = (value: unknown): UserPreferences["spacing"] => {
  if (value === "compact" || value === "normal" || value === "comfortable") {
    return value
  }

  if (value === "S") return "compact"
  if (value === "L") return "comfortable"
  return "normal"
}

const normalizeTimelineHourPreference = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback
  }

  const normalized = Math.floor(value)
  if (normalized < 0) return 0
  if (normalized > 23) return 23
  return normalized
}

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase())

const normalizeTagName = (value: string) => value.trim().toLowerCase()

const DATE_TIME_STOP_WORDS = new Set([
  "at",
  "on",
  "for",
  "by",
  "in",
  "due",
  "from",
  "until",
])

const STRONG_TASK_SEPARATOR = /\s*(?:,|and then|after that|also|plus|then)\s*/i
const ACTION_START_PATTERN =
  /^(?:call|run|send|email|text|buy|book|schedule|plan|review|write|read|clean|organize|pick|drop|submit|prepare|get|make|go|meet|pay|finish|start|stop|take|bring|file|draft|return|visit|exercise|work|check|update|follow|talk|message|shop)\b/i
const DEPENDENT_ACTION_PATTERN = /^(?:send|email|text|message|submit|return)\s+(?:it|this|that|them|back|over|in|out)\b/i
const CONTEXTUAL_INSTRUCTION_PATTERN = /\b(?:said|asked|told|needs?|need|wants?|want|requires?|require)\b/i
const BLOCKED_TASK_PATTERN =
  /\b(?:can't|cant|cannot|unable|blocked|stuck|problem|issue|error|broken|won't|wont|doesn't|doesnt|not\s+(?:working|opening|loading|available)|weird\s+file\s+type)\b/i
const DEADLINE_TASK_PATTERN =
  /\b(?:asap|urgent|critical|right away|due|deadline|before|by|no later than|end of day|eod|close of business|cob)\b/i

const splitNaturalLanguageTaskFragments = (input: string) => {
  const strongFragments = input
    .split(STRONG_TASK_SEPARATOR)
    .map((fragment) => fragment.trim())
    .filter(Boolean)

  return strongFragments.flatMap((fragment) => {
    const andMatches = [...fragment.matchAll(/\s+and\s+/gi)]

    if (andMatches.length === 0) {
      return [fragment]
    }

    const parts: string[] = []
    let cursor = 0

    for (const match of andMatches) {
      const matchIndex = match.index ?? -1
      const nextStart = matchIndex + match[0].length
      const nextFragment = fragment.slice(nextStart).trim()
      const previousFragment = fragment.slice(0, matchIndex).trim()

      if (!ACTION_START_PATTERN.test(nextFragment)) {
        continue
      }

      if (DEPENDENT_ACTION_PATTERN.test(nextFragment) && CONTEXTUAL_INSTRUCTION_PATTERN.test(previousFragment)) {
        continue
      }

      const current = fragment.slice(cursor, matchIndex).trim()
      if (current) {
        parts.push(current)
      }
      cursor = nextStart
    }

    const tail = fragment.slice(cursor).trim()
    if (tail) {
      parts.push(tail)
    }

    return parts.length > 0 ? parts : [fragment]
  })
}

const detectSharedNaturalLanguageDate = (input: string, today: Date) => {
  const firstFragment = splitNaturalLanguageTaskFragments(input)[0]?.toLowerCase() ?? ""

  if (/\b(?:tomorrow|tmr)\b/.test(firstFragment)) {
    return toIsoDate(addDays(today, 1))
  }

  if (/\btoday\b/.test(firstFragment)) {
    return toIsoDate(today)
  }

  if (/\bnext week\b/.test(firstFragment)) {
    const nextMonday = new Date(today)
    const day = nextMonday.getDay()
    const daysUntilNextMonday = ((8 - day) % 7) || 7
    nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday)
    return toIsoDate(nextMonday)
  }

  return null
}

const hasExplicitDateOverride = (fragment: string) => {
  const normalized = fragment.toLowerCase()

  return (
    /\b(?:today|tomorrow|tmr|next week)\b/.test(normalized) ||
    new RegExp(`\\b(?:on|by|this|next)\\s+${WEEKDAY_PATTERN.slice(2, -2)}\\b`, "i").test(normalized) ||
    new RegExp(`${WEEKDAY_PATTERN}\\s+at\\b`, "i").test(normalized) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(normalized) ||
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(normalized)
  )
}

const hasOverlap = (ranges: TokenRange[], start: number, end: number) =>
  ranges.some((range) => start < range.end && end > range.start)

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  tuesay: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const getNextWeekdayDate = (referenceDate: Date, weekday: number, includeNextWeek = false) => {
  const base = startOfDay(referenceDate)
  const currentWeekday = base.getDay()
  let daysUntil = (weekday - currentWeekday + 7) % 7

  if (daysUntil === 0) {
    daysUntil = 7
  }

  if (includeNextWeek) {
    daysUntil += 7
  }

  return addDays(base, daysUntil)
}

const detectFastPathScheduledDate = (input: string, referenceDate: Date) => {
  const normalized = input.toLowerCase()

  const explicitNextWeekdayMatch = normalized.match(/\bnext\s+(monday|tuesday|tuesay|wednesday|thursday|friday|saturday|sunday)\b/)
  if (explicitNextWeekdayMatch) {
    return toIsoDate(
      getNextWeekdayDate(referenceDate, WEEKDAY_INDEX_BY_NAME[explicitNextWeekdayMatch[1]], true)
    )
  }

  if (/\b(?:tomorrow|tmr)\b/.test(normalized)) {
    return toIsoDate(addDays(referenceDate, 1))
  }

  if (/\btoday\b/.test(normalized)) {
    return toIsoDate(referenceDate)
  }

  if (/\bnext week\b/.test(normalized)) {
    const nextMonday = new Date(referenceDate)
    const day = nextMonday.getDay()
    const daysUntilNextMonday = ((8 - day) % 7) || 7
    nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday)
    return toIsoDate(nextMonday)
  }

  const weekdayMatch = normalized.match(/\b(?:on\s+)?(monday|tuesday|tuesay|wednesday|thursday|friday|saturday|sunday)\b/)
  if (weekdayMatch) {
    return toIsoDate(getNextWeekdayDate(referenceDate, WEEKDAY_INDEX_BY_NAME[weekdayMatch[1]]))
  }

  return undefined
}

const detectImplicitPriority = (input: string): Todo["priority"] | undefined => {
  if (BLOCKED_TASK_PATTERN.test(input) && DEADLINE_TASK_PATTERN.test(input)) {
    return "urgent"
  }

  return undefined
}

const stripTokenRanges = (input: string, ranges: TokenRange[]) => {
  const expandedRanges = ranges.map((range) => {
    if (range.type !== "date" && range.type !== "time" && range.type !== "recurrence") {
      return range
    }

    let start = range.start
    let end = range.end

    let cursor = start
    while (cursor > 0 && /\s/.test(input[cursor - 1])) {
      cursor -= 1
    }

    const wordEnd = cursor
    while (cursor > 0 && /[a-z]/i.test(input[cursor - 1])) {
      cursor -= 1
    }

    const previousWord = input.slice(cursor, wordEnd).toLowerCase()
    if (previousWord && DATE_TIME_STOP_WORDS.has(previousWord)) {
      start = cursor
    }

    cursor = end
    while (cursor < input.length && /\s/.test(input[cursor])) {
      cursor += 1
    }

    const nextWordStart = cursor
    while (cursor < input.length && /[a-z]/i.test(input[cursor])) {
      cursor += 1
    }

    const nextWord = input.slice(nextWordStart, cursor).toLowerCase()
    if (nextWord && DATE_TIME_STOP_WORDS.has(nextWord)) {
      end = cursor
    }

    return {
      ...range,
      start,
      end,
    }
  })

  const sorted = [...expandedRanges].sort((left, right) => left.start - right.start)
  let cursor = 0
  let output = ""

  for (const range of sorted) {
    output += input.slice(cursor, range.start)
    cursor = range.end
  }

  output += input.slice(cursor)

  return output
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,!.?])/g, "$1")
    .trim()
}

export function parseNaturalLanguageTaskInput(
  input: string,
  options: { labels: Label[]; referenceDate?: Date }
): ParsedNaturalLanguageTask {
  const referenceDate = options.referenceDate ?? new Date()
  const [taskInput = "", ...subtaskParts] = input
    .split(/\s*>\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  const ranges: TokenRange[] = []
  let prioritySelection: Todo["priority"] | undefined
  let priorityPreview: NaturalLanguagePreviewToken | null = null
  let priorityIndex = -1
  const labelIds: string[] = []
  const newLabelNames: string[] = []
  const labelPreviews: NaturalLanguagePreviewToken[] = []

  const pushRange = (range: TokenRange) => {
    if (!hasOverlap(ranges, range.start, range.end)) {
      ranges.push(range)
      return true
    }
    return false
  }

  for (const match of taskInput.matchAll(/\b(p1|p2|p3|high priority|medium priority|low priority|urgent|asap|important|normal priority|normal|whenever)\b/gi)) {
    const normalized = match[0].toLowerCase()
    const value =
      normalized === "p1" || normalized === "urgent" || normalized === "asap" || normalized === "important" || normalized === "high priority"
        ? "urgent"
        : normalized === "p2" || normalized === "medium priority" || normalized === "normal priority" || normalized === "normal"
          ? "important"
          : "normal"
    const preview = { key: `priority-${match.index}`, label: `❗ ${titleCase(value)}` }

    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "priority", preview, payload: value })) {
      if (match.index! >= priorityIndex) {
        prioritySelection = value
        priorityPreview = preview
        priorityIndex = match.index!
      }
    }
  }

  for (const match of taskInput.matchAll(/#([a-z0-9_-]+)/gi)) {
    const tagName = normalizeTagName(match[1])
    const existingLabel = options.labels.find((label) => normalizeTagName(label.name) === tagName)
    if (!pushRange({
      start: match.index!,
      end: match.index! + match[0].length,
      type: "tag",
      preview: {
        key: `tag-${match.index}`,
        label: existingLabel ? `#${tagName}` : `#${tagName} (new)`,
      },
      payload: tagName,
    })) {
      continue
    }

    if (existingLabel) {
      labelIds.push(existingLabel.id)
    } else if (!newLabelNames.includes(tagName)) {
      newLabelNames.push(tagName)
    }

    labelPreviews.push({
      key: `tag-${match.index}`,
      label: existingLabel ? `#${tagName}` : `#${tagName} (new)`,
    })
  }

  const previewTokens: NaturalLanguagePreviewToken[] = []

  if (prioritySelection && priorityPreview && priorityIndex >= 0) {
    previewTokens.push(priorityPreview)
  }
  previewTokens.push(...labelPreviews)

  previewTokens.sort((left, right) => {
    const leftIndex = Number.parseInt(left.key.split("-").at(-1) || "0", 10)
    const rightIndex = Number.parseInt(right.key.split("-").at(-1) || "0", 10)
    return leftIndex - rightIndex
  })

  return {
    cleanText: stripTokenRanges(taskInput, ranges),
    scheduledDate: detectFastPathScheduledDate(taskInput, referenceDate),
    subtaskTitles: subtaskParts,
    recurrence: undefined,
    priority: prioritySelection ?? detectImplicitPriority(taskInput),
    labelIds,
    newLabelNames,
    time: undefined,
    previewTokens,
  }
}

export const localTaskParser = parseNaturalLanguageTaskInput

export function parseNaturalLanguageTaskEntries(
  input: string,
  options: { labels: Label[]; referenceDate?: Date }
): ParsedNaturalLanguageTask[] {
  const referenceDate = options.referenceDate ?? new Date()
  const fragments = splitNaturalLanguageTaskFragments(input)

  if (fragments.length === 0) {
    return []
  }

  const sharedDate = detectSharedNaturalLanguageDate(input, referenceDate)

  return fragments.map((fragment) => {
    const parsed = parseNaturalLanguageTaskInput(fragment, {
      labels: options.labels,
      referenceDate,
    })

    if (sharedDate && !hasExplicitDateOverride(fragment)) {
      return {
        ...parsed,
        scheduledDate: sharedDate,
      }
    }

    return parsed
  })
}

const tokenizeTaskText = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)

const scoreOptimisticTaskMatch = (
  candidate: OptimisticTaskCandidate,
  aiTask: Record<string, unknown>
) => {
  const aiTitle = typeof aiTask.title === "string" ? aiTask.title.trim() : ""
  const aiDate = normalizeCalendarDateKey(typeof aiTask.date === "string" ? aiTask.date : undefined)
  const optimisticTokens = new Set(tokenizeTaskText(candidate.text))
  const aiTokens = new Set(tokenizeTaskText(aiTitle))
  let sharedTokens = 0

  optimisticTokens.forEach((token) => {
    if (aiTokens.has(token)) {
      sharedTokens += 1
    }
  })

  let score = sharedTokens * 4

  if (aiTitle && aiTitle.toLowerCase() === candidate.text.toLowerCase()) {
    score += 12
  }

  if (aiDate && aiDate === candidate.optimisticDate) {
    score += 6
  } else if (aiDate) {
    score += 1
  }

  return score
}

export const reconcileOptimisticTaskOrder = (
  optimisticTasks: OptimisticTaskCandidate[],
  aiTasks: Array<Record<string, unknown>>
) => {
  const remaining = aiTasks.map((task, index) => ({ task, index }))

  return optimisticTasks.map((candidate) => {
    let bestIndex = -1
    let bestScore = Number.NEGATIVE_INFINITY

    remaining.forEach((entry, index) => {
      const score = scoreOptimisticTaskMatch(candidate, entry.task)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    if (bestIndex === -1) {
      return undefined
    }

    const [matched] = remaining.splice(bestIndex, 1)
    return matched?.task
  })
}

const removeRecurringChildren = (todos: Todo[], parentId: string) =>
  todos.filter((todo) => todo.parentId !== parentId)

const removeIncompleteRecurringChildren = (todos: Todo[], parentId: string) =>
  todos.filter((todo) => todo.parentId !== parentId || todo.completed)

const cloneRecurringSubtasks = (subtasks: SubTask[], parentId: string) =>
  subtasks.map((subtask) => ({
    ...subtask,
    id: generateId(),
    parentId,
    completed: false,
  }))

const getRecurringInterval = (todo: Todo) =>
  typeof todo.recurringInterval === "number" && Number.isFinite(todo.recurringInterval) && todo.recurringInterval > 1
    ? Math.floor(todo.recurringInterval)
    : 1

const differenceInWholeWeeks = (left: Date, right: Date) => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.floor((startOfDay(left).getTime() - startOfDay(right).getTime()) / (7 * MS_PER_DAY))
}

const insertTodoAfter = (todos: Todo[], targetId: string, nextTodo: Todo) => {
  const index = todos.findIndex((todo) => todo.id === targetId)
  if (index === -1) {
    return [...todos, nextTodo]
  }

  const nextTodos = [...todos]
  nextTodos.splice(index + 1, 0, nextTodo)
  return nextTodos
}

const getTodoSortBucket = (todo: Todo) => {
  if (!todo.completed && !todo.endOfDay) return 0
  if (!todo.completed && todo.endOfDay) return 1
  if (todo.completed && !todo.endOfDay) return 2
  return 3
}

const getSnoozeDate = (option: SnoozeOption, referenceDate: Date) => {
  const today = startOfDay(referenceDate)

  switch (option) {
    case "later-today":
      return today
    case "tomorrow":
      return addDays(today, 1)
    case "this-weekend": {
      const day = today.getDay()
      const daysUntilSaturday = ((6 - day + 7) % 7) || 7
      return addDays(today, daysUntilSaturday)
    }
    case "next-week": {
      const day = today.getDay()
      const daysUntilNextMonday = ((8 - day) % 7) || 7
      return addDays(today, daysUntilNextMonday)
    }
    default:
      return today
  }
}

const getNextRecurringOccurrenceDate = (todo: Todo, referenceDate: Date) => {
  const interval = getRecurringInterval(todo)
  const base = startOfDay(referenceDate)

  if (todo.recurringFrequency === "daily") {
    return addDays(base, interval)
  }

  if (todo.recurringFrequency === "weekday") {
    let offset = 1
    while (offset < 14 * interval) {
      const candidate = addDays(base, offset)
      if (candidate.getDay() !== 0 && candidate.getDay() !== 6) {
        return candidate
      }
      offset += 1
    }
  }

  if (todo.recurringFrequency === "monthly") {
    return addMonths(base, interval)
  }

  const recurringDays = todo.recurringDays && todo.recurringDays.length > 0
    ? new Set(todo.recurringDays)
    : new Set([base.getDay()])

  let offset = 1
  while (offset <= 366) {
    const candidate = addDays(base, offset)
    if (recurringDays.has(candidate.getDay())) {
      if (interval <= 1) {
        return candidate
      }

      const weeksSinceReference = differenceInWholeWeeks(candidate, base)
      if (weeksSinceReference % interval === 0) {
        return candidate
      }
    }
    offset += 1
  }

  return addDays(base, 7)
}

const mapTodosInStore = (
  state: Pick<LemonadeStore, "calendarTodos" | "lists">,
  todoId: string,
  updater: (todo: Todo) => Todo
) => ({
  calendarTodos: state.calendarTodos.map((todo) => (todo.id === todoId ? updater(todo) : todo)),
  lists: state.lists.map((list) => ({
    ...list,
    todos: list.todos.map((todo) => (todo.id === todoId ? updater(todo) : todo)),
  })),
})

const RECURRING_GENERATION_DAYS = 730
const DEFAULT_LABEL_COLOR = "#6b7280"

const getHolidays = (year: number): Record<string, string> => {
  return {
    [`${year}-01-01`]: "New Year's Day",
    [`${year}-02-14`]: "Valentine's Day",
    [`${year}-07-04`]: "Independence Day",
    [`${year}-10-31`]: "Halloween",
    [`${year}-11-28`]: "Thanksgiving",
    [`${year}-12-25`]: "Christmas Day",
    [`${year}-12-31`]: "New Year's Eve",
  }
}

export const holidays = {
  ...getHolidays(2025),
  ...getHolidays(2026),
  ...getHolidays(2027),
}

export const useLemonadeStore = create<LemonadeStore>()(
  persist(
    (set, get) => ({
      // Default preferences
      preferences: {
        columns: 7,
        textSize: 'md',
        spacing: 'normal',
        timelineStartHour: 6,
        timelineEndHour: 23,
        showCompleted: true,
        bulletStyle: 'none',
        startOnYesterday: false,
        autoMoveUndoneToToday: true,
        theme: 'light',
        accentColor: '#2563EB',
        showCelebrations: false,
        colorPalette: DEFAULT_COLOR_PALETTE,
        showDotGridBackground: true,
        defaultLabelId: null,
        displayName: "Alessandro User",
      },
      
      setPreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),

      celebrationEvent: null,
      clearCelebrationEvent: () => set({ celebrationEvent: null }),
      
      // Calendar todos
      calendarTodos: [],
      collapsedSubtasks: {},
      lastCreatedTodoId: null,
      lastDeleted: null,
      lastAutoMovedCount: 0,
      selectedTaskIds: [],
      taskHistoryPast: [],
      taskHistoryFuture: [],
      canUndoTaskAction: false,
      canRedoTaskAction: false,
      applyTaskIdMap: (idMap) =>
        set((state) => {
          const mapId = (id: string | null | undefined) => (id ? idMap[id] ?? id : id)

          const remapSubtasks = (subtasks: SubTask[], parentId: string) =>
            subtasks.map((subtask) => ({
              ...subtask,
              parentId,
            }))

          const remapTodos = (todos: Todo[]) =>
            todos.map((todo) => {
              const nextId = mapId(todo.id) as string
              const nextParentId = mapId(todo.parentId ?? null) ?? null
              return {
                ...todo,
                id: nextId,
                parentId: nextParentId,
                subtasks: remapSubtasks(todo.subtasks, nextId),
              }
            })

          const remapCollapsed = (collapsed: Record<string, boolean>) => {
            const entries = Object.entries(collapsed).map(([key, value]) => [mapId(key) as string, value] as const)
            return Object.fromEntries(entries)
          }

          const remapHistory = (entry: TaskHistoryEntry): TaskHistoryEntry => ({
            ...entry,
            snapshot: {
              calendarTodos: remapTodos(entry.snapshot.calendarTodos),
              collapsedSubtasks: remapCollapsed(entry.snapshot.collapsedSubtasks),
              selectedTaskIds: entry.snapshot.selectedTaskIds.map((id) => mapId(id) as string),
            },
          })

          return {
            calendarTodos: remapTodos(state.calendarTodos),
            collapsedSubtasks: remapCollapsed(state.collapsedSubtasks),
            selectedTaskIds: state.selectedTaskIds.map((id) => mapId(id) as string),
            lastCreatedTodoId: mapId(state.lastCreatedTodoId) ?? null,
            lastDeleted: state.lastDeleted
              ? {
                  ...state.lastDeleted,
                  items: remapTodos(state.lastDeleted.items),
                }
              : null,
            taskHistoryPast: state.taskHistoryPast.map(remapHistory),
            taskHistoryFuture: state.taskHistoryFuture.map(remapHistory),
          }
        }),
      
      addCalendarTodo: (todo) => {
        const existingIds = new Set(get().calendarTodos.map((item) => item.id))
        const requestedId = todo.id
        const id =
          requestedId && !existingIds.has(requestedId)
            ? requestedId
            : globalThis.crypto.randomUUID()
        const resolvedDate = normalizeTodoDate(todo.date)
        const defaultLabelId = get().preferences.defaultLabelId
        const resolvedLabelIds =
          Array.isArray(todo.labelIds) && todo.labelIds.length > 0
            ? todo.labelIds
            : defaultLabelId
              ? [defaultLabelId]
              : []
        const resolvedSubtasks = Array.isArray(todo.subtasks)
          ? todo.subtasks
              .map((subtask) => normalizeSubtask(subtask, id))
              .filter((subtask) => subtask.title.trim().length > 0)
          : []
        const createdTodo: Todo = {
          ...todo,
          id,
          date: resolvedDate,
          labelIds: resolvedLabelIds,
          createdAt: todo.createdAt ?? Date.now(),
          endOfDay: todo.endOfDay ?? false,
          isSyncing: todo.isSyncing ?? false,
          syncStatus: todo.syncStatus === "local" ? "local" : undefined,
          subtasks: resolvedSubtasks,
          priority: normalizeTodoPriority(todo.priority),
          reminderOffsetMinutes:
            typeof todo.reminderOffsetMinutes === "number" && Number.isFinite(todo.reminderOffsetMinutes)
              ? todo.reminderOffsetMinutes
              : null,
          scheduledNotificationId:
            typeof todo.scheduledNotificationId === "string" ? todo.scheduledNotificationId : null,
          icon: typeof todo.icon === "string" && todo.icon.trim().length > 0 ? todo.icon : undefined,
          url: typeof todo.url === "string" && todo.url.trim().length > 0 ? todo.url.trim() : undefined,
          location: typeof todo.location === "string" && todo.location.trim().length > 0 ? todo.location.trim() : undefined,
          photoDataUrl:
            typeof todo.photoDataUrl === "string" && todo.photoDataUrl.trim().length > 0
              ? todo.photoDataUrl
              : undefined,
        }

        set((state) => ({
          ...pushTaskHistory(state, "add task"),
          calendarTodos: [...state.calendarTodos, createdTodo],
          lastCreatedTodoId: id,
          quickAddSessionTodoIds:
            state.quickAddSessionActive && !state.quickAddSessionTodoIds.includes(id)
              ? [...state.quickAddSessionTodoIds, id]
              : state.quickAddSessionTodoIds,
        }))
        if (todo.isRecurring && !todo.parentId) {
          get().generateRecurringInstances()
        }

        // Background schedule if reminder is set.
        void scheduleReminderForTodo(createdTodo)
        return id
      },
      clearLastCreatedTodoId: () => set({ lastCreatedTodoId: null }),
      clearLastDeleted: (token) =>
        set((state) => {
          if (!state.lastDeleted) {
            return state
          }

          if (token && state.lastDeleted.token !== token) {
            return state
          }

          return { lastDeleted: null }
        }),
      clearLastAutoMovedCount: () => set({ lastAutoMovedCount: 0 }),
      restoreLastDeletedTodo: () =>
        set((state) => {
          if (!state.lastDeleted) {
            return state
          }

          const existingIds = new Set(state.calendarTodos.map((todo) => todo.id))
          const restoredItems = state.lastDeleted.items.filter((todo) => !existingIds.has(todo.id))

          if (restoredItems.length === 0) {
            return { lastDeleted: null }
          }

          return {
            calendarTodos: [...state.calendarTodos, ...restoredItems],
            lastDeleted: null,
          }
        }),
      
      updateCalendarTodo: (id, updates) => {
        set((state) => {
          const targetTodo = state.calendarTodos.find((todo) => todo.id === id)
          if (!targetTodo) {
            return state
          }

          const updatedTodo = {
            ...targetTodo,
            ...updates,
            date: "date" in updates ? normalizeTodoDate(updates.date) : targetTodo.date,
            priority: "priority" in updates ? normalizeTodoPriority(updates.priority) : targetTodo.priority,
            reminderOffsetMinutes:
              "reminderOffsetMinutes" in updates
                ? typeof updates.reminderOffsetMinutes === "number" && Number.isFinite(updates.reminderOffsetMinutes)
                  ? updates.reminderOffsetMinutes
                  : null
                : targetTodo.reminderOffsetMinutes,
            icon:
              "icon" in updates
                ? typeof updates.icon === "string" && updates.icon.trim().length > 0
                  ? updates.icon
                  : undefined
                : targetTodo.icon,
            url:
              "url" in updates
                ? typeof updates.url === "string" && updates.url.trim().length > 0
                  ? updates.url.trim()
                  : undefined
                : targetTodo.url,
            location:
              "location" in updates
                ? typeof updates.location === "string" && updates.location.trim().length > 0
                  ? updates.location.trim()
                  : undefined
                : targetTodo.location,
            scheduledNotificationId:
              "scheduledNotificationId" in updates
                ? typeof updates.scheduledNotificationId === "string" && updates.scheduledNotificationId.trim().length > 0
                  ? updates.scheduledNotificationId.trim()
                  : null
                : (targetTodo as Todo).scheduledNotificationId ?? null,
            photoDataUrl:
              "photoDataUrl" in updates
                ? typeof updates.photoDataUrl === "string" && updates.photoDataUrl.trim().length > 0
                  ? updates.photoDataUrl
                  : undefined
                : targetTodo.photoDataUrl,
            syncStatus:
              updates.syncStatus === "local"
                ? "local"
                : "syncStatus" in updates
                  ? undefined
                  : targetTodo.syncStatus,
          }
          const shouldResetChildren =
            !updatedTodo.parentId &&
            (
              "isRecurring" in updates ||
              "recurringFrequency" in updates ||
              "recurringDays" in updates ||
              "date" in updates
            )

          const todosWithoutChildren = shouldResetChildren
            ? removeIncompleteRecurringChildren(state.calendarTodos, id)
            : state.calendarTodos

          return {
            ...pushTaskHistory(state, "edit task"),
            calendarTodos: todosWithoutChildren.map((todo) =>
              todo.id === id ? updatedTodo : todo
            )
          }
        })
        if ("isRecurring" in updates || "recurringFrequency" in updates || "recurringDays" in updates || "recurringInterval" in updates || "date" in updates) {
          get().generateRecurringInstances()
        }

        // Background schedule/cancel if reminder-relevant fields changed.
        if (
          "reminderOffsetMinutes" in updates ||
          "date" in updates ||
          "time" in updates ||
          "completed" in updates
        ) {
          const todo = get().calendarTodos.find((item) => item.id === id)
          if (todo) {
            if (todo.completed || typeof todo.reminderOffsetMinutes !== "number" || !todo.date || !todo.time) {
              void fetch("/api/notifications/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId: todo.id }),
              }).catch(() => {})
            } else {
              void scheduleReminderForTodo(todo)
            }
          }
        }
      },

      updateCalendarTodoInstance: (id, updates) => set((state) => ({
        ...pushTaskHistory(state, "edit recurring task"),
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                ...updates,
                priority: "priority" in updates ? normalizeTodoPriority(updates.priority) : todo.priority,
                reminderOffsetMinutes:
                  "reminderOffsetMinutes" in updates
                    ? typeof updates.reminderOffsetMinutes === "number" && Number.isFinite(updates.reminderOffsetMinutes)
                      ? updates.reminderOffsetMinutes
                      : null
                    : todo.reminderOffsetMinutes,
                icon:
                  "icon" in updates
                    ? typeof updates.icon === "string" && updates.icon.trim().length > 0
                      ? updates.icon
                      : undefined
                    : todo.icon,
                url:
                  "url" in updates
                    ? typeof updates.url === "string" && updates.url.trim().length > 0
                      ? updates.url.trim()
                      : undefined
                    : todo.url,
                location:
                  "location" in updates
                    ? typeof updates.location === "string" && updates.location.trim().length > 0
                      ? updates.location.trim()
                      : undefined
                    : todo.location,
                photoDataUrl:
                  "photoDataUrl" in updates
                    ? typeof updates.photoDataUrl === "string" && updates.photoDataUrl.trim().length > 0
                      ? updates.photoDataUrl
                      : undefined
                    : todo.photoDataUrl,
                parentId: undefined,
                isRecurring: false,
                recurringFrequency: undefined,
                recurringDays: undefined,
                recurringInterval: undefined,
                recurringCustomText: undefined,
              }
            : todo
        )
      })),
      
      deleteCalendarTodo: (id) =>
        set((state) => {
          const deletedItems = state.calendarTodos.filter(
            (todo) => todo.id === id || todo.parentId === id
          )

          if (deletedItems.length === 0) {
            return state
          }

          return {
            ...pushTaskHistory(state, "delete task"),
            calendarTodos: removeRecurringChildren(
              state.calendarTodos.filter((todo) => todo.id !== id),
              id
            ),
            lastDeleted: {
              items: deletedItems,
              token: generateId(),
            },
            selectedTaskIds: state.selectedTaskIds.filter((selectedId) => !deletedItems.some((item) => item.id === selectedId)),
          }
        }),
      
      toggleCalendarTodo: (id) => {
        const target = get().calendarTodos.find((todo) => todo.id === id)
        if (!target) {
          return
        }

        const nextCompleted = !target.completed

        set((state) => {
          const nextTodos = state.calendarTodos.map((todo) =>
            todo.id === id ? { ...todo, completed: nextCompleted } : todo
          )

          let celebrationEvent = state.celebrationEvent
          if (nextCompleted && state.preferences.showCelebrations) {
            const dateKey = target.date ?? null
            const dayTodos =
              dateKey
                ? nextTodos.filter((todo) => todo.date === dateKey && !todo.isHeading)
                : []
            const dayCompleted = dayTodos.length > 0 && dayTodos.every((todo) => todo.completed)

            celebrationEvent = {
              id: generateId(),
              taskCompleted: true,
              dayCompleted,
              date: dateKey,
              createdAt: Date.now(),
            }
          }

          return {
            ...pushTaskHistory(state, "complete task"),
            calendarTodos: nextTodos,
            celebrationEvent,
          }
        })

        // Cancel reminders when a task is marked complete; reschedule when uncompleted.
        const updated = get().calendarTodos.find((todo) => todo.id === id)
        if (!updated) return
        if (updated.completed) {
          void fetch("/api/notifications/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: updated.id }),
          }).catch(() => {})
        } else {
          void scheduleReminderForTodo(updated)
        }
      },

      toggleEndOfDay: (id) => set((state) => ({
        ...pushTaskHistory(state, "toggle end of day"),
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === id ? { ...todo, endOfDay: !todo.endOfDay } : todo
        )
      })),
      
      addSubtask: (todoId, text) => set((state) => ({
        ...pushTaskHistory(state, "add subtask"),
        ...mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: [
            ...todo.subtasks,
            {
              id: generateId(),
              title: text,
              completed: false,
              parentId: todo.id,
            },
          ],
        })),
      })),

      editSubtask: (todoId, subtaskId, title) => set((state) => ({
        ...pushTaskHistory(state, "edit subtask"),
        ...mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: todo.subtasks.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, title } : subtask
          ),
        })),
      })),

      toggleSubtask: (todoId, subtaskId) => set((state) => ({
        ...pushTaskHistory(state, "complete subtask"),
        ...mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: todo.subtasks.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
          ),
        })),
      })),

      deleteSubtask: (todoId, subtaskId) => set((state) => ({
        ...pushTaskHistory(state, "delete subtask"),
        ...mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: todo.subtasks.filter((subtask) => subtask.id !== subtaskId),
        })),
      })),

      setSubtasksCollapsed: (todoId, collapsed) =>
        set((state) => ({
          collapsedSubtasks: {
            ...state.collapsedSubtasks,
            [todoId]: collapsed,
          },
        })),

      toggleSubtasksCollapsed: (todoId) =>
        set((state) => ({
          collapsedSubtasks: {
            ...state.collapsedSubtasks,
            [todoId]: !(state.collapsedSubtasks[todoId] ?? true),
          },
        })),
      
      moveTodoToDate: (todoId, newDate) => set((state) => ({
        ...pushTaskHistory(state, "move task"),
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === todoId ? { ...todo, date: newDate } : todo
        )
      })),

      moveCalendarTodoToList: (todoId, listId) => set((state) => {
        const source = state.calendarTodos.find((todo) => todo.id === todoId)
        const targetList = state.lists.find((list) => list.id === listId)
        if (!source || !targetList) return state

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const addDaysLocal = (base: Date, amount: number) => {
          const next = new Date(base)
          next.setDate(next.getDate() + amount)
          return next
        }
        const formatKey = (date: Date) => formatLocalDateKey(date)
        const endOfWeekSunday = (base: Date) => {
          const day = base.getDay()
          const diff = (7 - day) % 7
          return addDaysLocal(base, diff)
        }
        const nextMonday = (base: Date) => {
          const day = base.getDay()
          const daysUntilNextMonday = ((8 - day) % 7) || 7
          return addDaysLocal(base, daysUntilNextMonday)
        }
        const endOfMonth = (base: Date) => new Date(base.getFullYear(), base.getMonth() + 1, 0)
        const endOfYear = (base: Date) => new Date(base.getFullYear(), 11, 31)
        const dueDateForList = () => {
          switch (listId) {
            case "this-week":
              return formatKey(endOfWeekSunday(today))
            case "next-week":
              return formatKey(nextMonday(today))
            case "this-month":
              return formatKey(endOfMonth(today))
            case "next-month":
              return formatKey(new Date(today.getFullYear(), today.getMonth() + 1, 1))
            case "this-year":
              return formatKey(endOfYear(today))
            case "next-year":
              return formatKey(new Date(today.getFullYear() + 1, 0, 1))
            default:
              return null
          }
        }

        const moved: Todo = {
          ...source,
          date: dueDateForList(),
          time: undefined,
          durationMinutes: undefined,
        }

        return {
          ...pushTaskHistory(state, "move task"),
          calendarTodos: state.calendarTodos.filter((todo) => todo.id !== todoId),
          lists: state.lists.map((list) =>
            list.id === listId ? { ...list, todos: [...list.todos, moved] } : list
          ),
        }
      }),

      moveListTodoToList: (sourceListId, todoId, targetListId) => set((state) => {
        if (sourceListId === targetListId) return state
        const sourceList = state.lists.find((list) => list.id === sourceListId)
        const targetList = state.lists.find((list) => list.id === targetListId)
        if (!sourceList || !targetList) return state
        const item = sourceList.todos.find((todo) => todo.id === todoId)
        if (!item) return state

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const addDaysLocal = (base: Date, amount: number) => {
          const next = new Date(base)
          next.setDate(next.getDate() + amount)
          return next
        }
        const formatKey = (date: Date) => formatLocalDateKey(date)
        const endOfWeekSunday = (base: Date) => {
          const day = base.getDay()
          const diff = (7 - day) % 7
          return addDaysLocal(base, diff)
        }
        const nextMonday = (base: Date) => {
          const day = base.getDay()
          const daysUntilNextMonday = ((8 - day) % 7) || 7
          return addDaysLocal(base, daysUntilNextMonday)
        }
        const endOfMonth = (base: Date) => new Date(base.getFullYear(), base.getMonth() + 1, 0)
        const endOfYear = (base: Date) => new Date(base.getFullYear(), 11, 31)
        const dueDateForList = () => {
          switch (targetListId) {
            case "this-week":
              return formatKey(endOfWeekSunday(today))
            case "next-week":
              return formatKey(nextMonday(today))
            case "this-month":
              return formatKey(endOfMonth(today))
            case "next-month":
              return formatKey(new Date(today.getFullYear(), today.getMonth() + 1, 1))
            case "this-year":
              return formatKey(endOfYear(today))
            case "next-year":
              return formatKey(new Date(today.getFullYear() + 1, 0, 1))
            default:
              return null
          }
        }

        const moved: Todo = {
          ...item,
          date: dueDateForList(),
          time: undefined,
          durationMinutes: undefined,
        }

        return {
          ...pushTaskHistory(state, "move task"),
          lists: state.lists.map((list) => {
            if (list.id === sourceListId) {
              return { ...list, todos: list.todos.filter((todo) => todo.id !== todoId) }
            }
            if (list.id === targetListId) {
              return { ...list, todos: [...list.todos, moved] }
            }
            return list
          }),
        }
      }),

      moveListTodoToDate: (sourceListId, todoId, newDate) => {
        const state = get()
        const sourceList = state.lists.find((list) => list.id === sourceListId)
        const item = sourceList?.todos.find((todo) => todo.id === todoId) ?? null
        if (!item) return

        // 1) Remove from list
        set((current) => ({
          ...pushTaskHistory(current, "move task"),
          lists: current.lists.map((list) =>
            list.id === sourceListId
              ? { ...list, todos: list.todos.filter((todo) => todo.id !== todoId) }
              : list
          ),
        }))

        // 2) Add to calendar (preserve id + metadata)
        get().addCalendarTodo({
          ...item,
          id: item.id,
          date: newDate,
          time: undefined,
          durationMinutes: undefined,
          isSyncing: false,
          syncStatus: undefined,
        })
      },

      snoozeCalendarTodo: (todoId, option) => set((state) => {
        const target = state.calendarTodos.find((todo) => todo.id === todoId)
        if (!target) {
          return state
        }

        const snoozeDate = formatLocalDateKey(getSnoozeDate(option, new Date()))
        const nextTime =
          option === "later-today"
            ? `${`${Math.min(new Date().getHours() + 2, 23)}`.padStart(2, "0")}:00`
            : undefined

        return {
          ...pushTaskHistory(state, "snooze task"),
          calendarTodos: state.calendarTodos.map((todo) =>
            todo.id === todoId
              ? { ...todo, date: snoozeDate, time: nextTime, completed: false }
              : todo
          ),
        }
      }),

      duplicateCalendarTodo: (todoId) => set((state) => {
        const target = state.calendarTodos.find((todo) => todo.id === todoId)
        if (!target) {
          return state
        }

        // Prevent creating phantom/blank duplicates.
        if (!target.text || target.text.trim().length === 0) {
          return state
        }

        const duplicateId = generateId()
        const baseCreatedAt = typeof target.createdAt === "number" ? target.createdAt : Date.now()
        const duplicate: Todo = {
          ...target,
          id: duplicateId,
          // Duplicate should stay in the same list/date context as the original.
          date: target.date,
          // Exact copy of completion state (including subtasks).
          completed: target.completed,
          // Keep the duplicate directly under the original (DayColumn sorts by createdAt).
          createdAt: baseCreatedAt + 1,
          parentId: undefined,
          // Ensure arrays are copied (no shared references).
          labelIds: [...target.labelIds],
          // This app is local-only: never show syncing indicators on duplicates.
          isSyncing: false,
          syncStatus: undefined,
          subtasks: target.subtasks.map((subtask) => ({
            ...subtask,
            id: generateId(),
            parentId: duplicateId,
          })),
        }

        return {
          ...pushTaskHistory(state, "duplicate task"),
          calendarTodos: insertTodoAfter(state.calendarTodos, todoId, duplicate),
          // Helps keep the duplicate immediately visible (autofocus / highlight behavior).
          lastCreatedTodoId: duplicateId,
        }
      }),

      reorderCalendarTodo: (todoId, targetId, position) => set((state) => {
        if (todoId === targetId) return state
        const source = state.calendarTodos.find((todo) => todo.id === todoId)
        const target = state.calendarTodos.find((todo) => todo.id === targetId)
        if (!source || !target) return state
        if (!source.date || !target.date || source.date !== target.date) return state

        const sourceBucket = getTodoSortBucket(source)
        const targetBucket = getTodoSortBucket(target)
        // Keep the app's existing section ordering (end-of-day / completed groups).
        if (sourceBucket !== targetBucket) return state

        const bucketTodos = state.calendarTodos
          .map((todo, index) => ({ todo, index }))
          .filter(({ todo }) => todo.date === source.date && getTodoSortBucket(todo) === sourceBucket)
          .sort((a, b) => {
            const createdAtDiff = (a.todo.createdAt ?? 0) - (b.todo.createdAt ?? 0)
            if (createdAtDiff !== 0) return createdAtDiff
            return a.index - b.index
          })
          .map(({ todo }) => todo)

        const withoutSource = bucketTodos.filter((todo) => todo.id !== todoId)
        const targetIndex = withoutSource.findIndex((todo) => todo.id === targetId)
        if (targetIndex === -1) return state

        const insertIndex = position === "before" ? targetIndex : targetIndex + 1
        const nextBucket = [...withoutSource]
        nextBucket.splice(insertIndex, 0, source)

        const base =
          nextBucket.reduce((min, todo) => Math.min(min, todo.createdAt ?? min), Number.POSITIVE_INFINITY) ??
          Date.now()
        const baseNumber = Number.isFinite(base) ? base : Date.now()

        const createdAtById = new Map<string, number>()
        nextBucket.forEach((todo, idx) => {
          createdAtById.set(todo.id, baseNumber + idx)
        })

        return {
          ...pushTaskHistory(state, "reorder tasks"),
          calendarTodos: state.calendarTodos.map((todo) => {
            const nextCreatedAt = createdAtById.get(todo.id)
            return typeof nextCreatedAt === "number" ? { ...todo, createdAt: nextCreatedAt } : todo
          }),
        }
      }),

      skipRecurringOccurrence: (todoId) => set((state) => {
        const target = state.calendarTodos.find((todo) => todo.id === todoId)
        if (!target || !target.isRecurring) {
          return state
        }

        const series = target.parentId
          ? state.calendarTodos.find((todo) => todo.id === target.parentId) ?? target
          : target
        const referenceDate = parseLocalDateKey(target.date ?? formatLocalDateKey(new Date()))
        const nextDate = formatLocalDateKey(getNextRecurringOccurrenceDate(series, referenceDate))
        const nextDateTaken = state.calendarTodos.some((todo) => todo.parentId === series.id && todo.date === nextDate)

        return {
          ...pushTaskHistory(state, "skip recurrence"),
          calendarTodos: state.calendarTodos
            .filter((todo) => !(target.id === series.id && todo.parentId === series.id && todo.date === nextDate))
            .map((todo) => {
              if (todo.id !== todoId) {
                return todo
              }

              if (todo.parentId && nextDateTaken) {
                return null
              }

              return {
                ...todo,
                date: nextDate,
                completed: false,
                time: series.time,
              }
            })
            .filter((todo): todo is Todo => Boolean(todo)),
        }
      }),

      splitCalendarTodo: (todoId, titles) => set((state) => {
        const target = state.calendarTodos.find((todo) => todo.id === todoId)
        const nextTitles = titles.map((title) => title.trim()).filter(Boolean)
        if (!target || nextTitles.length === 0) {
          return state
        }

        const baseCreatedAt = Date.now()
        const replacements = nextTitles.map((title, index) => {
          const nextId = generateId()
          return {
            ...target,
            id: nextId,
            text: title,
            createdAt: baseCreatedAt + index,
            completed: false,
            parentId: undefined,
            subtasks: [],
          }
        })

        const targetIndex = state.calendarTodos.findIndex((todo) => todo.id === todoId)
        const nextTodos = [...state.calendarTodos]
        nextTodos.splice(targetIndex, 1, ...replacements)

        return {
          ...pushTaskHistory(state, "split task"),
          calendarTodos: nextTodos,
          selectedTaskIds: state.selectedTaskIds.filter((id) => id !== todoId),
        }
      }),

      convertTodoToSubtask: (todoId, parentId) => set((state) => {
        if (todoId === parentId) {
          return state
        }

        const source = state.calendarTodos.find((todo) => todo.id === todoId)
        const parent = state.calendarTodos.find((todo) => todo.id === parentId)
        if (!source || !parent) {
          return state
        }

        return {
          ...pushTaskHistory(state, "convert to subtask"),
          calendarTodos: state.calendarTodos
            .filter((todo) => todo.id !== todoId)
            .map((todo) =>
              todo.id === parentId
                ? {
                    ...todo,
                    subtasks: [
                      ...todo.subtasks,
                      {
                        id: generateId(),
                        title: source.text,
                        completed: source.completed,
                        parentId,
                      },
                    ],
                  }
                : todo
            ),
          // Make sure the parent is expanded so the user can immediately see the new subtask.
          collapsedSubtasks: {
            ...state.collapsedSubtasks,
            [parentId]: false,
          },
          selectedTaskIds: state.selectedTaskIds.filter((id) => id !== todoId),
        }
      }),

      toggleTaskSelection: (todoId) => set((state) => ({
        selectedTaskIds: state.selectedTaskIds.includes(todoId)
          ? state.selectedTaskIds.filter((id) => id !== todoId)
          : [...state.selectedTaskIds, todoId],
      })),

      clearTaskSelection: () => set({ selectedTaskIds: [] }),

      mergeSelectedTasks: (mergedTitle) => set((state) => {
        const selectedTodos = state.calendarTodos.filter((todo) => state.selectedTaskIds.includes(todo.id))
        const title = mergedTitle.trim()

        if (selectedTodos.length < 2 || !title) {
          return state
        }

        const anchor = selectedTodos[0]
        const mergedId = generateId()
        const mergedTodo: Todo = {
          ...anchor,
          id: mergedId,
          text: title,
          createdAt: Date.now(),
          completed: false,
          subtasks: [],
          labelIds: Array.from(new Set(selectedTodos.flatMap((todo) => todo.labelIds))),
          notes: selectedTodos
            .map((todo) => todo.notes?.trim())
            .filter((value): value is string => Boolean(value))
            .join("\n\n") || anchor.notes,
        }

        const anchorIndex = state.calendarTodos.findIndex((todo) => todo.id === anchor.id)
        const remaining = state.calendarTodos.filter((todo) => !state.selectedTaskIds.includes(todo.id))
        remaining.splice(anchorIndex >= 0 ? anchorIndex : remaining.length, 0, mergedTodo)

        return {
          ...pushTaskHistory(state, "merge tasks"),
          calendarTodos: remaining,
          selectedTaskIds: [],
        }
      }),

      undoTaskAction: () => {
        const state = get()
        const previous = state.taskHistoryPast.at(-1)
        if (!previous) {
          return null
        }

        const currentSnapshot = cloneTaskHistorySnapshot(state)
        const nextPast = state.taskHistoryPast.slice(0, -1)

        set({
          calendarTodos: previous.snapshot.calendarTodos,
          collapsedSubtasks: previous.snapshot.collapsedSubtasks,
          selectedTaskIds: previous.snapshot.selectedTaskIds,
          taskHistoryPast: nextPast,
          taskHistoryFuture: [{ label: previous.label, snapshot: currentSnapshot }, ...state.taskHistoryFuture].slice(0, TASK_HISTORY_LIMIT),
          canUndoTaskAction: nextPast.length > 0,
          canRedoTaskAction: true,
        })

        return previous.label
      },

      redoTaskAction: () => {
        const state = get()
        const next = state.taskHistoryFuture[0]
        if (!next) {
          return null
        }

        const currentSnapshot = cloneTaskHistorySnapshot(state)
        const remainingFuture = state.taskHistoryFuture.slice(1)

        set({
          calendarTodos: next.snapshot.calendarTodos,
          collapsedSubtasks: next.snapshot.collapsedSubtasks,
          selectedTaskIds: next.snapshot.selectedTaskIds,
          taskHistoryPast: [...state.taskHistoryPast.slice(-(TASK_HISTORY_LIMIT - 1)), { label: next.label, snapshot: currentSnapshot }],
          taskHistoryFuture: remainingFuture,
          canUndoTaskAction: true,
          canRedoTaskAction: remainingFuture.length > 0,
        })

        return next.label
      },
      
      // Lists
      listTabs: FIXED_LIST_TABS,

      addListTab: (name) => set((state) => ({
        listTabs: [...state.listTabs, { id: generateId(), name }]
      })),

      renameListTab: (id, name) => set((state) => ({
        listTabs: state.listTabs.map((tab) =>
          FIXED_LIST_TABS.some((fixedTab) => fixedTab.id === id)
            ? tab
            : tab.id === id
              ? { ...tab, name }
              : tab
        )
      })),

      deleteListsInTab: (tabId) => set((state) => ({
        listTabs: state.listTabs,
        lists: state.lists.filter((list) => {
          if (tabId === 'shopping-returns-tab') {
            return true
          }
          const listTabId = list.tabId ?? (list.type === 'planning' ? 'planning-tab' : 'my-lists-tab')
          return listTabId !== tabId
        })
      })),

      lists: FIXED_LISTS,
      
      addList: (name, type, tabId) => set((state) => {
        const resolvedTabId = tabId ?? (type === 'planning' ? 'planning-tab' : 'my-lists-tab')
        if (resolvedTabId === 'shopping-returns-tab') {
          return state
        }

        return {
          lists: [...state.lists, {
            id: generateId(),
            name,
            todos: [],
            type,
            tabId: resolvedTabId
          }]
        }
      }),
      
      deleteList: (id) => set((state) => ({
        lists: FIXED_LISTS.some((list) => list.id === id)
          ? state.lists
          : state.lists.filter((list) => list.id !== id)
      })),
      
      renameList: (id, name) => set((state) => ({
        lists: state.lists.map((list) =>
          FIXED_LISTS.some((fixedList) => fixedList.id === id)
            ? list
            : list.id === id
              ? { ...list, name }
              : list
        )
      })),

      reorderList: (tabId, draggedId, targetId) => set((state) => {
        if (draggedId === targetId) {
          return state
        }

        const groupedLists = state.lists.filter(
          (list) =>
            (list.tabId ?? (list.type === 'planning' ? 'planning-tab' : 'my-lists-tab')) === tabId
        )
        const fromIndex = groupedLists.findIndex((list) => list.id === draggedId)
        const toIndex = groupedLists.findIndex((list) => list.id === targetId)

        if (fromIndex === -1 || toIndex === -1) {
          return state
        }

        const reordered = [...groupedLists]
        const [draggedList] = reordered.splice(fromIndex, 1)
        reordered.splice(toIndex, 0, draggedList)

        let typeIndex = 0

        return {
          lists: state.lists.map((list) =>
            (list.tabId ?? (list.type === 'planning' ? 'planning-tab' : 'my-lists-tab')) === tabId
              ? reordered[typeIndex++]
              : list
          )
        }
      }),

      addListAdjacent: (referenceListId, position) => set((state) => {
        const referenceIndex = state.lists.findIndex((list) => list.id === referenceListId)
        const referenceList = state.lists[referenceIndex]

        if (referenceIndex === -1 || !referenceList) {
          return state
        }

        const tabId = referenceList.tabId ?? (referenceList.type === 'planning' ? 'planning-tab' : 'my-lists-tab')
        const autoNamedCount = state.lists.filter((list) => {
          const listTabId = list.tabId ?? (list.type === 'planning' ? 'planning-tab' : 'my-lists-tab')
          return listTabId === tabId && /^LIST \d+$/.test(list.name)
        }).length

        const newList: List = {
          id: generateId(),
          name: `LIST ${autoNamedCount + 1}`,
          todos: [],
          type: referenceList.type,
          tabId,
        }

        const lists = [...state.lists]
        const insertIndex = position === 'left' ? referenceIndex : referenceIndex + 1
        lists.splice(insertIndex, 0, newList)

        return { lists }
      }),

      moveListToTab: (listId, tabId) => set((state) => {
        const sourceIndex = state.lists.findIndex((list) => list.id === listId)
        const sourceList = state.lists[sourceIndex]

        if (sourceIndex === -1 || !sourceList) {
          return state
        }

        if (sourceList.id === "shopping-returns" || tabId === "shopping-returns-tab") {
          return state
        }

        const updatedList: List = {
          ...sourceList,
          tabId,
          type: tabId === 'planning-tab' ? 'planning' : 'list',
        }

        const remainingLists = state.lists.filter((list) => list.id !== listId)
        const targetIndices = remainingLists.reduce<number[]>((indices, list, index) => {
          const listTabId = list.tabId ?? (list.type === 'planning' ? 'planning-tab' : 'my-lists-tab')
          if (listTabId === tabId) {
            indices.push(index)
          }
          return indices
        }, [])

        const insertIndex = targetIndices.length > 0 ? targetIndices[targetIndices.length - 1] + 1 : remainingLists.length
        const lists = [...remainingLists]
        lists.splice(insertIndex, 0, updatedList)

        return { lists }
      }),
      
      addListTodo: (listId, text) => set((state) => {
        const defaultLabelId = state.preferences.defaultLabelId
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const formatKey = (date: Date) => formatLocalDateKey(date)
        const addDaysLocal = (base: Date, amount: number) => {
          const next = new Date(base)
          next.setDate(next.getDate() + amount)
          return next
        }
        const endOfWeekSunday = (base: Date) => {
          // Sunday = 0 ... Saturday = 6
          const day = base.getDay()
          const diff = (7 - day) % 7
          return addDaysLocal(base, diff)
        }
        const nextMonday = (base: Date) => {
          const day = base.getDay()
          const daysUntilNextMonday = ((8 - day) % 7) || 7
          return addDaysLocal(base, daysUntilNextMonday)
        }
        const endOfMonth = (base: Date) => {
          // Last day of current month.
          return new Date(base.getFullYear(), base.getMonth() + 1, 0)
        }
        const endOfYear = (base: Date) => new Date(base.getFullYear(), 11, 31)

        const dateForList = () => {
          switch (listId) {
            case "this-week":
              return formatKey(endOfWeekSunday(today))
            case "next-week":
              return formatKey(nextMonday(today))
            case "this-month":
              return formatKey(endOfMonth(today))
            case "next-month":
              return formatKey(new Date(today.getFullYear(), today.getMonth() + 1, 1))
            case "this-year":
              return formatKey(endOfYear(today))
            case "next-year":
              return formatKey(new Date(today.getFullYear() + 1, 0, 1))
            case "someday":
            case "goals":
            case "ideas":
              return null
            default:
              return formatKey(today)
          }
        }

        return {
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  todos: [...list.todos, {
                    id: generateId(),
                    text,
                    completed: false,
                    date: dateForList(),
                    createdAt: Date.now(),
                    endOfDay: false,
                    subtasks: [],
                    labelIds: defaultLabelId ? [defaultLabelId] : [],
                  }]
                }
              : list
          )
        }
      }),

      updateListTodo: (listId, todoId, updates) => set((state) => ({
        lists: state.lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                todos: list.todos.map((todo) =>
                  todo.id === todoId ? { ...todo, ...updates } : todo
                ),
              }
            : list
        ),
      })),
      
      deleteListTodo: (listId, todoId) => set((state) => ({
        lists: state.lists.map((list) =>
          list.id === listId
            ? { ...list, todos: list.todos.filter((todo) => todo.id !== todoId) }
            : list
        )
      })),
      
      toggleListTodo: (listId, todoId) => set((state) => ({
        lists: state.lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                todos: list.todos.map((todo) =>
                  todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
                )
              }
            : list
        )
      })),
      
      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchModeActive: false,
      setSearchModeActive: (active) => set({ searchModeActive: active }),
      taskSearchFilters: DEFAULT_TASK_SEARCH_FILTERS,
      setTaskSearchFilters: (updates) =>
        set((state) => ({
          taskSearchFilters: {
            ...state.taskSearchFilters,
            ...updates,
          },
        })),
      resetTaskSearchFilters: () => set({ taskSearchFilters: DEFAULT_TASK_SEARCH_FILTERS }),
      
      // Filter
      labelFilterIds: [],
      activeFilterColor: null,
      setActiveFilterColor: (color) => set({ activeFilterColor: color }),
      setLabelFilterIds: (labelIds) => set({ labelFilterIds: [...new Set(labelIds)] }),
      toggleLabelFilter: (labelId) =>
        set((state) => ({
          labelFilterIds: state.labelFilterIds.includes(labelId)
            ? state.labelFilterIds.filter((id) => id !== labelId)
            : [...state.labelFilterIds, labelId],
        })),
      clearLabelFilters: () => set({ labelFilterIds: [] }),

      // Labels
      labels: [],
      addLabel: (name, color) => set((state) => ({
        labels: [...state.labels, { id: generateId(), name, color }]
      })),
      ensureLabelIds: (names) => {
        const state = get()
        const resolvedIds: string[] = []
        const existingByName = new Map(
          state.labels.map((label) => [normalizeTagName(label.name), label])
        )
        const nextLabels = [...state.labels]

        for (const rawName of names) {
          const normalized = normalizeTagName(rawName)
          const existing = existingByName.get(normalized)

          if (existing) {
            resolvedIds.push(existing.id)
            continue
          }

          const newLabel = {
            id: generateId(),
            name: normalized,
            color: DEFAULT_LABEL_COLOR,
          }

          existingByName.set(normalized, newLabel)
          nextLabels.push(newLabel)
          resolvedIds.push(newLabel.id)
        }

        if (nextLabels.length !== state.labels.length) {
          set({ labels: nextLabels })
        }

        return resolvedIds
      },
      editLabel: (id, name, color) => set((state) => ({
        labels: state.labels.map((label) => label.id === id ? { ...label, name, color } : label)
      })),
      deleteLabel: (id) => set((state) => ({
        labels: state.labels.filter((label) => label.id !== id),
        preferences: {
          ...state.preferences,
          defaultLabelId: state.preferences.defaultLabelId === id ? null : state.preferences.defaultLabelId,
        },
        labelFilterIds: state.labelFilterIds.filter((labelId) => labelId !== id),
        calendarTodos: state.calendarTodos.map(todo => ({
          ...todo,
          labelIds: todo.labelIds.filter((labelId) => labelId !== id)
        })),
        lists: state.lists.map(list => ({
          ...list,
          todos: list.todos.map(todo => ({
            ...todo,
            labelIds: todo.labelIds.filter((labelId) => labelId !== id)
          }))
        }))
      })),
      addLabelToTask: (taskId, labelId) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === taskId && !todo.labelIds.includes(labelId)
            ? { ...todo, labelIds: [...todo.labelIds, labelId] }
            : todo
        ),
        lists: state.lists.map((list) => ({
          ...list,
          todos: list.todos.map((todo) =>
            todo.id === taskId && !todo.labelIds.includes(labelId)
              ? { ...todo, labelIds: [...todo.labelIds, labelId] }
              : todo
          ),
        })),
      })),
      removeLabelFromTask: (taskId, labelId) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === taskId
            ? { ...todo, labelIds: todo.labelIds.filter((id) => id !== labelId) }
            : todo
        ),
        lists: state.lists.map((list) => ({
          ...list,
          todos: list.todos.map((todo) =>
            todo.id === taskId
              ? { ...todo, labelIds: todo.labelIds.filter((id) => id !== labelId) }
              : todo
          ),
        })),
      })),

      // Sidebar
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Calendar selection
      selectedCalendarDate: getInitialCalendarDate(false),
      setSelectedCalendarDate: (date) => set({ selectedCalendarDate: date }),
      calendarTimeframe: "week",
      setCalendarTimeframe: (timeframe) => set({ calendarTimeframe: timeframe }),
      calendarFilterMode: "all",
      setCalendarFilterMode: (mode) => set({ calendarFilterMode: mode }),
      calendarPastTodayScroll: false,
      setCalendarPastTodayScroll: (value) => set({ calendarPastTodayScroll: value }),
      aiMode: true,
      setAiMode: (next) => set({ aiMode: next }),
      rightPageViewMode: "default",
      setRightPageViewMode: (mode) => set({ rightPageViewMode: mode }),
      selectedShortcut: null,
      setSelectedShortcut: (shortcut) => set({ selectedShortcut: shortcut }),
      mainViewMode: "standard",
      setMainViewMode: (mode) => set({ mainViewMode: mode }),
      dualViewRange: null,
      setDualViewRange: (range) => set({ dualViewRange: range }),
      playgroundNote: "",
      setPlaygroundNote: (note) => set({ playgroundNote: note }),
      quickAddSessionActive: false,
      quickAddSessionTodoIds: [],
      startQuickAddSession: () => set({ quickAddSessionActive: true, quickAddSessionTodoIds: [] }),
      endQuickAddSession: () => set({ quickAddSessionActive: false, quickAddSessionTodoIds: [] }),
      weekCount: 1,
      lastSessionDate: null,
      incrementWeekCount: () => set({ weekCount: 1 }),
      decrementWeekCount: () => set({ weekCount: 1 }),

      // Calendar expansion
      isCalendarExpanded: false,
      toggleCalendar: () => set((state) => ({ isCalendarExpanded: !state.isCalendarExpanded })),

      // Recurring todos
      generateRecurringInstances: () => {
        const state = get()
        const recurringParents = state.calendarTodos.filter(
          (todo): todo is Todo & { date: string } =>
            todo.isRecurring === true && !todo.parentId && typeof todo.date === "string"
        )
        const generationStart = startOfDay(new Date())
        const generationEnd = addDays(generationStart, RECURRING_GENERATION_DAYS)
        let currentTodos = [...state.calendarTodos]
        let changed = false

        for (const parent of recurringParents) {
          const cleanedTodos = removeIncompleteRecurringChildren(currentTodos, parent.id)
          if (cleanedTodos.length !== currentTodos.length) {
            currentTodos = cleanedTodos
            changed = true
          } else {
            currentTodos = cleanedTodos
          }

          const existingChildDates = new Set(
            currentTodos
              .filter((todo) => todo.parentId === parent.id)
              .map((todo) => todo.date)
          )

          const parentStartDate = parseLocalDateKey(parent.date)
          const nextInstances: Todo[] = []
          const createdAtBase = Date.now()
          const recurringInterval = getRecurringInterval(parent)

          if (parent.recurringFrequency === 'daily') {
            for (let offset = recurringInterval; offset <= RECURRING_GENERATION_DAYS; offset += recurringInterval) {
              const candidate = addDays(parentStartDate, offset)
              if (candidate > generationEnd) break
              if (candidate < generationStart) continue

              const candidateDate = formatLocalDateKey(candidate)
              if (existingChildDates.has(candidateDate)) continue

              const childId = generateId()

              nextInstances.push({
                ...parent,
                id: childId,
                text: parent.text,
                date: candidateDate,
                createdAt: createdAtBase + offset,
                completed: false,
                parentId: parent.id,
                isRecurring: true,
                subtasks: cloneRecurringSubtasks(parent.subtasks, childId),
              })
              existingChildDates.add(candidateDate)
            }
          } else if (parent.recurringFrequency === 'weekday') {
            for (let offset = 1; offset <= RECURRING_GENERATION_DAYS; offset += 1) {
              const candidate = addDays(parentStartDate, offset)
              if (candidate > generationEnd) break
              if (candidate < generationStart) continue
              if (candidate.getDay() === 0 || candidate.getDay() === 6) continue
              if (recurringInterval > 1) {
                const weekdayBlock = Math.floor(offset / 7)
                if (weekdayBlock % recurringInterval !== 0) continue
              }

              const candidateDate = formatLocalDateKey(candidate)
              if (existingChildDates.has(candidateDate)) continue

              const childId = generateId()

              nextInstances.push({
                ...parent,
                id: childId,
                text: parent.text,
                date: candidateDate,
                createdAt: createdAtBase + offset,
                completed: false,
                parentId: parent.id,
                isRecurring: true,
                subtasks: cloneRecurringSubtasks(parent.subtasks, childId),
              })
              existingChildDates.add(candidateDate)
            }
          } else if (parent.recurringFrequency === 'weekly' || (parent.recurringDays && parent.recurringDays.length > 0)) {
            const recurringDays = parent.recurringDays && parent.recurringDays.length > 0
              ? new Set(parent.recurringDays)
              : new Set([parentStartDate.getDay()])

            for (let offset = 1; offset <= RECURRING_GENERATION_DAYS; offset += 1) {
              const candidate = addDays(parentStartDate, offset)
              if (candidate > generationEnd) break
              if (candidate < generationStart) continue
              if (!recurringDays.has(candidate.getDay())) continue
              if (recurringInterval > 1) {
                const weeksSinceParent = differenceInWholeWeeks(candidate, parentStartDate)
                if (weeksSinceParent % recurringInterval !== 0) continue
              }

              const candidateDate = formatLocalDateKey(candidate)
              if (existingChildDates.has(candidateDate)) continue

              const childId = generateId()

              nextInstances.push({
                ...parent,
                id: childId,
                text: parent.text,
                date: candidateDate,
                createdAt: createdAtBase + offset,
                completed: false,
                parentId: parent.id,
                isRecurring: true,
                subtasks: cloneRecurringSubtasks(parent.subtasks, childId),
              })
              existingChildDates.add(candidateDate)
            }
          } else if (parent.recurringFrequency === 'monthly') {
            for (let monthOffset = recurringInterval; monthOffset <= 36; monthOffset += recurringInterval) {
              const candidate = addMonths(parentStartDate, monthOffset)
              if (candidate > generationEnd) break
              if (candidate < generationStart) continue

              const candidateDate = formatLocalDateKey(candidate)
              if (existingChildDates.has(candidateDate)) continue

              const childId = generateId()

              nextInstances.push({
                ...parent,
                id: childId,
                text: parent.text,
                date: candidateDate,
                createdAt: createdAtBase + monthOffset,
                completed: false,
                parentId: parent.id,
                isRecurring: true,
                subtasks: cloneRecurringSubtasks(parent.subtasks, childId),
              })
              existingChildDates.add(candidateDate)
            }
          }

          if (nextInstances.length > 0) {
            currentTodos = [...currentTodos, ...nextInstances]
            changed = true
          }
        }

        if (changed) {
          set({ calendarTodos: currentTodos })
        }
      },

      // Auto-rollover
      autoRollover: () => {
        const todayStr = formatLocalDateKey(new Date())
        const { lastSessionDate, preferences } = get()

        if (!lastSessionDate || lastSessionDate >= todayStr) {
          set({ lastSessionDate: todayStr, lastAutoMovedCount: 0 })
          return
        }

        if (!preferences.autoMoveUndoneToToday) {
          set({ lastSessionDate: todayStr, lastAutoMovedCount: 0 })
          return
        }

        set((state) => {
          let movedCount = 0
          const updatedTodos = state.calendarTodos.map((todo) => {
            if (
              !todo.completed &&
              !todo.isRecurring &&
              !todo.parentId &&
              !todo.isHeading &&
              typeof todo.date === "string" &&
              todo.date < todayStr
            ) {
              movedCount += 1
              return { ...todo, date: todayStr }
            }

            return todo
          })

          return {
            calendarTodos: updatedTodos,
            lastSessionDate: todayStr,
            lastAutoMovedCount: movedCount,
          }
        })
      },
    }),
    {
      name: LEMONADE_STORAGE_KEY,
      version: STORAGE_VERSION,
      partialize: (state) => ({
        preferences: state.preferences,
        calendarTodos: state.calendarTodos,
        collapsedSubtasks: state.collapsedSubtasks,
        listTabs: state.listTabs,
        lists: state.lists,
        labels: state.labels,
        searchQuery: state.searchQuery,
        labelFilterIds: state.labelFilterIds,
        sidebarOpen: state.sidebarOpen,
        weekCount: 1,
        lastSessionDate: state.lastSessionDate,
        isCalendarExpanded: state.isCalendarExpanded,
      }),
      migrate: (persistedState, version) => {
        const normalized = migratePersistedLemonadeState(persistedState)

    // Version 0 -> 2:
        // Older installs had no explicit persist version and could contain
        // partially shaped preferences/todos/lists. We normalize them here,
        // including defaulting legacy task `parentId` to null and `subtasks` to [].
        if (typeof version !== "number" || version === 0 || version < STORAGE_VERSION) {
          return normalized
        }

        return normalized
      },
      merge: (persistedState, currentState) => {
        const persisted = migratePersistedLemonadeState(persistedState, currentState)

        return {
          ...currentState,
          ...persisted,
          calendarTodos: persisted.calendarTodos ?? currentState.calendarTodos,
          lists: persisted.lists ?? currentState.lists,
          preferences: persisted.preferences ?? currentState.preferences,
          selectedCalendarDate: getInitialCalendarDate((persisted.preferences ?? currentState.preferences).startOnYesterday),
          weekCount: 1,
          lastSessionDate: persisted.lastSessionDate ?? currentState.lastSessionDate,
        }
      },
    }
  )
)

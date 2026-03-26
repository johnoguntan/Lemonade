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
  date: string // ISO date string
  createdAt: number
  endOfDay: boolean
  isSyncing?: boolean
  syncStatus?: 'local'
  time?: string
  durationMinutes?: number
  color?: string
  isHeading?: boolean
  subtasks: SubTask[]
  isRecurring?: boolean
  recurringFrequency?: 'daily' | 'weekday' | 'weekly' | 'monthly'
  recurringDays?: number[] // 0-6 for Sunday-Saturday
  parentId?: string | null // For recurring instances
  priority?: 'high' | 'medium' | 'low' | 'none'
  labelIds: string[]
  tags?: string[] // Legacy migrated tag IDs
  storeName?: string
  returnDeadline?: string
  notes?: string
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

interface LemonadeStore {
  // Preferences
  preferences: UserPreferences
  setPreferences: (prefs: Partial<UserPreferences>) => void
  
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
  moveTodoToDate: (todoId: string, newDate: string) => void
  
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
  
  // Filter
  labelFilterIds: string[]
  activeFilterColor: string | null
  setActiveFilterColor: (color: string | null) => void
  toggleLabelFilter: (labelId: string) => void
  clearLabelFilters: () => void
  
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Calendar selection
  selectedCalendarDate: string
  setSelectedCalendarDate: (date: string) => void
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
    | 'sidebarOpen'
    | 'weekCount'
    | 'isCalendarExpanded'
    | 'lastSessionDate'
  >
>

const generateId = () => Math.random().toString(36).substring(2, 15)

export const createOptimisticTodoId = (scope = "task") => `optimistic-${scope}-${generateId()}`

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
//
// When you add or rename persisted fields:
// 1. bump STORAGE_VERSION
// 2. add the migration branch in `migrate`
// 3. keep `normalizePersistedState` backward-safe for older payloads
export const STORAGE_VERSION = 1
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
    durationMinutes:
      typeof todo.durationMinutes === "number" && Number.isFinite(todo.durationMinutes) && todo.durationMinutes > 0
        ? Math.floor(todo.durationMinutes)
        : undefined,
    subtasks: Array.isArray(todo.subtasks) ? todo.subtasks.map((subtask) => normalizeSubtask(subtask, todo.id)) : [],
    labelIds: fallbackLabelIds,
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

const FIXED_LIST_TABS: ListTab[] = [
  { id: 'planning-tab', name: 'PLANNING' },
  { id: 'my-lists-tab', name: 'MY LISTS' },
  { id: 'shopping-returns-tab', name: 'SHOPPING RETURNS' },
]

const FIXED_LISTS: List[] = [
  { id: 'brain-dump', name: 'BRAIN DUMP', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'grocery', name: 'GROCERY LIST', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'to-buy', name: 'TO BUY', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'shopping-returns', name: 'SHOPPING RETURNS', todos: [], type: 'shopping-returns', tabId: 'shopping-returns-tab' },
  { id: 'to-read', name: 'TO READ', todos: [], type: 'list', tabId: 'my-lists-tab' },
  { id: 'goals', name: 'GOALS', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'someday', name: 'SOMEDAY', todos: [], type: 'planning', tabId: 'planning-tab' },
  { id: 'ideas', name: 'IDEAS', todos: [], type: 'planning', tabId: 'planning-tab' },
]

const ensureFixedTabs = (tabs: ListTab[]): ListTab[] => {
  const byId = new Map(tabs.map((tab) => [tab.id, tab]))
  return FIXED_LIST_TABS.map((tab) => byId.get(tab.id) ?? tab).concat(
    tabs.filter((tab) => !FIXED_LIST_TABS.some((fixedTab) => fixedTab.id === tab.id))
  )
}

const ensureFixedLists = (lists: List[]): List[] => {
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

  return fixedLists.concat(
    normalizedExisting.filter((list) => !FIXED_LISTS.some((fixedList) => fixedList.id === list.id))
  )
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
    accentColor: "#852CE6",
    showCelebrations: false,
    colorPalette: DEFAULT_COLOR_PALETTE,
    showDotGridBackground: true,
    defaultLabelId: null,
    displayName: "Lemonade User",
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

      if (!ACTION_START_PATTERN.test(nextFragment)) {
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
        ? "high"
        : normalized === "p2" || normalized === "medium priority" || normalized === "normal priority" || normalized === "normal"
          ? "medium"
          : "low"
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
    priority: prioritySelection,
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
        accentColor: '#852CE6',
        showCelebrations: false,
        colorPalette: DEFAULT_COLOR_PALETTE,
        showDotGridBackground: true,
        defaultLabelId: null,
        displayName: "Lemonade User",
      },
      
      setPreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),
      
      // Calendar todos
      calendarTodos: [],
      lastCreatedTodoId: null,
      lastDeleted: null,
      lastAutoMovedCount: 0,
      
      addCalendarTodo: (todo) => {
        const existingIds = new Set(get().calendarTodos.map((item) => item.id))
        const requestedId = todo.id
        const id = requestedId && !existingIds.has(requestedId) ? requestedId : generateId()
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
        set((state) => ({
          calendarTodos: [...state.calendarTodos, {
            ...todo,
            id,
            date: resolvedDate,
            labelIds: resolvedLabelIds,
            createdAt: todo.createdAt ?? Date.now(),
            endOfDay: todo.endOfDay ?? false,
            isSyncing: todo.isSyncing ?? false,
            syncStatus: todo.syncStatus === "local" ? "local" : undefined,
            subtasks: resolvedSubtasks,
          }],
          lastCreatedTodoId: id,
        }))
        if (todo.isRecurring && !todo.parentId) {
          get().generateRecurringInstances()
        }
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
            calendarTodos: todosWithoutChildren.map((todo) =>
              todo.id === id ? updatedTodo : todo
            )
          }
        })
        if ("isRecurring" in updates || "recurringFrequency" in updates || "recurringDays" in updates || "date" in updates) {
          get().generateRecurringInstances()
        }
      },

      updateCalendarTodoInstance: (id, updates) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                ...updates,
                parentId: undefined,
                isRecurring: false,
                recurringFrequency: undefined,
                recurringDays: undefined,
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
            calendarTodos: removeRecurringChildren(
              state.calendarTodos.filter((todo) => todo.id !== id),
              id
            ),
            lastDeleted: {
              items: deletedItems,
              token: generateId(),
            },
          }
        }),
      
      toggleCalendarTodo: (id) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      })),

      toggleEndOfDay: (id) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === id ? { ...todo, endOfDay: !todo.endOfDay } : todo
        )
      })),
      
      addSubtask: (todoId, text) => set((state) =>
        mapTodosInStore(state, todoId, (todo) => ({
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
        }))
      ),

      editSubtask: (todoId, subtaskId, title) => set((state) =>
        mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: todo.subtasks.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, title } : subtask
          ),
        }))
      ),

      toggleSubtask: (todoId, subtaskId) => set((state) =>
        mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: todo.subtasks.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
          ),
        }))
      ),

      deleteSubtask: (todoId, subtaskId) => set((state) =>
        mapTodosInStore(state, todoId, (todo) => ({
          ...todo,
          subtasks: todo.subtasks.filter((subtask) => subtask.id !== subtaskId),
        }))
      ),
      
      moveTodoToDate: (todoId, newDate) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === todoId ? { ...todo, date: newDate } : todo
        )
      })),
      
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

        return {
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  todos: [...list.todos, {
                    id: generateId(),
                    text,
                    completed: false,
                    date: new Date().toISOString().split('T')[0],
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
      
      // Filter
      labelFilterIds: [],
      activeFilterColor: null,
      setActiveFilterColor: (color) => set({ activeFilterColor: color }),
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
        const recurringParents = state.calendarTodos.filter((todo) => todo.isRecurring && !todo.parentId)
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

          if (parent.recurringFrequency === 'daily') {
            for (let offset = 1; offset <= RECURRING_GENERATION_DAYS; offset += 1) {
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
            for (let monthOffset = 1; monthOffset <= 36; monthOffset += 1) {
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

        // Version 0 -> 1:
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

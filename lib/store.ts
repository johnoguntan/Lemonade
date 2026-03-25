"use client"

import { addDays, addMonths } from 'date-fns'
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
  time?: string
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

interface DeletedTodoBuffer {
  items: Todo[]
  token: string
}

type CalendarTodoInput = Omit<Todo, 'id' | 'subtasks' | 'endOfDay' | 'createdAt' | 'labelIds'> & {
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
  textSize: normalizeTextSizePreference(preferences?.textSize),
  spacing: normalizeSpacingPreference(preferences?.spacing),
  timelineStartHour: normalizeTimelineHourPreference(preferences?.timelineStartHour, fallbackPreferences.timelineStartHour),
  timelineEndHour: normalizeTimelineHourPreference(preferences?.timelineEndHour, fallbackPreferences.timelineEndHour),
  autoMoveUndoneToToday: preferences?.autoMoveUndoneToToday ?? fallbackPreferences.autoMoveUndoneToToday,
  colorPalette: preferences?.colorPalette ?? fallbackPreferences.colorPalette,
  showDotGridBackground: preferences?.showDotGridBackground ?? fallbackPreferences.showDotGridBackground,
  defaultLabelId:
    typeof preferences?.defaultLabelId === "string" ? preferences.defaultLabelId : null,
})

const clampWeekCount = (value: unknown, fallback: number) =>
  typeof value === "number" ? Math.min(4, Math.max(1, value)) : fallback

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

export const migratePersistedLemonadeState = (
  persistedState: unknown,
  fallbackState?: LemonadeStore
): PersistedLemonadeStore => {
  const persisted = (persistedState && typeof persistedState === "object"
    ? persistedState
    : {}) as PersistedLemonadeStore

  const fallbackPreferences = fallbackState?.preferences ?? {
    columns: 5,
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
  }

  const isLegacyVersion = typeof fallbackState === "undefined"

  return {
    ...persisted,
    preferences: normalizePersistedPreferences(persisted.preferences, fallbackPreferences),
    calendarTodos: Array.isArray(persisted.calendarTodos)
      ? persisted.calendarTodos.map((todo, index) =>
          isLegacyVersion ? normalizeLegacyTodo(todo, index) : normalizeTodo(todo, index)
        )
      : [],
    listTabs: ensureFixedTabs(Array.isArray(persisted.listTabs) ? persisted.listTabs : []),
    lists: ensureFixedLists(
      Array.isArray(persisted.lists)
      ? persisted.lists.map((list, listIndex) => ({
          ...list,
          todos: Array.isArray(list.todos)
            ? list.todos.map((todo, todoIndex) =>
                isLegacyVersion
                  ? normalizeLegacyTodo(todo, listIndex * 1000 + todoIndex)
                  : normalizeTodo(todo, listIndex * 1000 + todoIndex)
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
    weekCount: clampWeekCount(persisted.weekCount, fallbackState?.weekCount ?? 2),
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

const monthLookup: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

const weekdayLookup: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

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

const toIsoDate = (date: Date) => formatLocalDateKey(date)

const normalizeTodoDate = (value: string | null | undefined) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return toIsoDate(new Date())
  }

  return value
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

const normalizeTimeValue = (raw: string) =>
  raw.replace(/\s+/g, '').toLowerCase()

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

const buildUpcomingWeekday = (weekday: number, referenceDate: Date) => {
  const reference = startOfDay(referenceDate)
  const next = new Date(reference)
  let delta = (weekday - reference.getDay() + 7) % 7
  if (delta === 0) {
    delta = 7
  }
  next.setDate(reference.getDate() + delta)
  return next
}

const resolveMonthDayDate = (month: number, day: number, referenceDate: Date) => {
  const reference = startOfDay(referenceDate)
  const candidate = new Date(reference.getFullYear(), month, day)
  if (candidate < reference) {
    candidate.setFullYear(candidate.getFullYear() + 1)
  }
  return candidate
}

const hasOverlap = (ranges: TokenRange[], start: number, end: number) =>
  ranges.some((range) => start < range.end && end > range.start)

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
  const [taskInput = "", ...subtaskParts] = input
    .split(/\s*>\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  const referenceDate = options.referenceDate ?? new Date()
  const ranges: TokenRange[] = []
  let selectedDateValue: string | undefined
  let selectedDatePreview: NaturalLanguagePreviewToken | undefined
  let selectedDateIndex = -1
  let recurrenceSelection: ParsedNaturalLanguageTask["recurrence"] | null = null
  let recurrencePreview: NaturalLanguagePreviewToken | null = null
  let recurrenceIndex = -1
  let prioritySelection: Todo["priority"] | undefined
  let priorityPreview: NaturalLanguagePreviewToken | null = null
  let priorityIndex = -1
  let timeSelection: string | undefined
  let timePreview: NaturalLanguagePreviewToken | null = null
  let timeIndex = -1
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

  const registerDate = (match: RegExpExecArray, date: Date, label: string) => {
    const value = toIsoDate(date)
    const preview = { key: `date-${match.index}`, label: `📅 ${label}` }
    if (pushRange({ start: match.index, end: match.index + match[0].length, type: "date", preview, payload: value })) {
      if (match.index >= selectedDateIndex) {
        selectedDateValue = value
        selectedDatePreview = preview
        selectedDateIndex = match.index
      }
    }
  }

  const registerTime = (match: RegExpExecArray, value: string, label: string) => {
    const preview = { key: `time-${match.index}`, label: `🕒 ${label}` }
    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "time", preview, payload: value })) {
      if (match.index! >= timeIndex) {
        timeSelection = value
        timePreview = preview
        timeIndex = match.index!
      }
    }
  }

  const setTimeFromOverlappingToken = (match: RegExpExecArray, value: string, label: string) => {
    if (match.index! >= timeIndex) {
      timeSelection = value
      timePreview = { key: `time-${match.index}`, label: `🕒 ${label}` }
      timeIndex = match.index!
    }
  }

  const formatRecurringDaysLabel = (days: number[]) =>
    days
      .map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day])
      .join("/")

  for (const match of taskInput.matchAll(/\bday after tomorrow\b/gi)) {
    registerDate(match as RegExpExecArray, addDays(referenceDate, 2), "Day After Tomorrow")
  }

  for (const match of taskInput.matchAll(/\btonight\b/gi)) {
    registerDate(match as RegExpExecArray, referenceDate, "Tonight")
    setTimeFromOverlappingToken(match as RegExpExecArray, "9pm", "Tonight")
  }

  for (const match of taskInput.matchAll(/\bin\s+(\d+)\s+days?\b/gi)) {
    const dayCount = Number.parseInt(match[1], 10)
    if (Number.isNaN(dayCount)) {
      continue
    }
    registerDate(match as RegExpExecArray, addDays(referenceDate, dayCount), `In ${dayCount} Day${dayCount === 1 ? "" : "s"}`)
  }

  for (const match of taskInput.matchAll(/\b(today|tomorrow)\b/gi)) {
    const keyword = match[0].toLowerCase()
    const resolved = keyword === "tomorrow" ? addDays(referenceDate, 1) : referenceDate
    registerDate(match as RegExpExecArray, resolved, titleCase(keyword))
  }

  for (const match of taskInput.matchAll(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const weekday = weekdayLookup[match[1].toLowerCase()]
    registerDate(match as RegExpExecArray, buildUpcomingWeekday(weekday, referenceDate), `Next ${titleCase(match[1])}`)
  }

  for (const match of taskInput.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const matchIndex = match.index ?? 0
    const before = taskInput.slice(Math.max(0, matchIndex - 6), matchIndex).toLowerCase()
    if (/\b(next|every)\s*$/.test(before)) {
      continue
    }
    const weekday = weekdayLookup[match[1].toLowerCase()]
    registerDate(match as RegExpExecArray, buildUpcomingWeekday(weekday, referenceDate), titleCase(match[1]))
  }

  for (const match of taskInput.matchAll(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const month = monthLookup[match[1].toLowerCase()]
    const day = Number.parseInt(match[2], 10)
    if (Number.isNaN(day)) {
      continue
    }
    registerDate(match as RegExpExecArray, resolveMonthDayDate(month, day, referenceDate), `${titleCase(match[1])} ${day}`)
  }

  for (const match of taskInput.matchAll(/\bevery\s+(day|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const value = match[1].toLowerCase()
    const preview = {
      key: `recurrence-${match.index}`,
      label: `🔁 Every ${value === "day" ? "Day" : titleCase(value)}`,
    }

    let recurrence: ParsedNaturalLanguageTask["recurrence"]

    if (value === "day") {
      recurrence = { isRecurring: true, recurringFrequency: "daily", label: "Every Day" }
    } else if (value === "weekday") {
      recurrence = { isRecurring: true, recurringFrequency: "weekday", label: "Every Weekday" }
    } else {
      recurrence = {
        isRecurring: true,
        recurringDays: [weekdayLookup[value]],
        label: `Every ${titleCase(value)}`,
      }
    }

    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "recurrence", preview, payload: recurrence })) {
      if (match.index! >= recurrenceIndex) {
        recurrenceSelection = recurrence
        recurrencePreview = preview
        recurrenceIndex = match.index!
      }
    }
  }

  for (const match of taskInput.matchAll(/\bevery\s+((?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:\s*\/\s*(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat))*)\b/gi)) {
    const aliases = match[1]
      .split("/")
      .map((value) => normalizeTagName(value))
      .map((value) => weekdayLookup[value])
      .filter((value): value is number => typeof value === "number")

    const uniqueDays = [...new Set(aliases)]
    if (uniqueDays.length === 0) {
      continue
    }

    const recurrence: ParsedNaturalLanguageTask["recurrence"] = {
      isRecurring: true,
      recurringDays: uniqueDays,
      label: `Every ${formatRecurringDaysLabel(uniqueDays)}`,
    }
    const preview = {
      key: `recurrence-${match.index}`,
      label: `🔁 Every ${formatRecurringDaysLabel(uniqueDays)}`,
    }

    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "recurrence", preview, payload: recurrence })) {
      if (match.index! >= recurrenceIndex) {
        recurrenceSelection = recurrence
        recurrencePreview = preview
        recurrenceIndex = match.index!
      }
    }
  }

  for (const match of taskInput.matchAll(/\bweekly\b/gi)) {
    const recurrence: ParsedNaturalLanguageTask["recurrence"] = {
      isRecurring: true,
      recurringFrequency: "weekly",
      label: "Weekly",
    }
    const preview = {
      key: `recurrence-${match.index}`,
      label: "🔁 Weekly",
    }

    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "recurrence", preview, payload: recurrence })) {
      if (match.index! >= recurrenceIndex) {
        recurrenceSelection = recurrence
        recurrencePreview = preview
        recurrenceIndex = match.index!
      }
    }
  }

  for (const match of taskInput.matchAll(/!(high|medium|low)\b/gi)) {
    const value = match[1].toLowerCase() as NonNullable<Todo["priority"]>
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

  for (const match of taskInput.matchAll(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi)) {
    const normalized = normalizeTimeValue(match[0])
    registerTime(match as RegExpExecArray, normalized.replace(/^at/, ""), normalized)
  }

  for (const match of taskInput.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi)) {
    const normalized = normalizeTimeValue(match[0])
    registerTime(match as RegExpExecArray, normalized, normalized)
  }

  for (const match of taskInput.matchAll(/\b(?:at\s+)?noon\b/gi)) {
    registerTime(match as RegExpExecArray, "12pm", "Noon")
  }

  for (const match of taskInput.matchAll(/\b(?:this\s+)?(morning|evening)\b/gi)) {
    const normalized = match[1].toLowerCase()
    const value = normalized === "evening" ? "6pm" : normalized
    registerTime(match as RegExpExecArray, value, titleCase(normalized))
  }

  const previewTokens: NaturalLanguagePreviewToken[] = []

  if (selectedDatePreview) {
    previewTokens.push(selectedDatePreview)
  }
  if (recurrenceSelection && recurrencePreview && recurrenceIndex >= 0) {
    previewTokens.push(recurrencePreview)
  }
  if (prioritySelection && priorityPreview && priorityIndex >= 0) {
    previewTokens.push(priorityPreview)
  }
  previewTokens.push(...labelPreviews)
  if (timeSelection && timePreview && timeIndex >= 0) {
    previewTokens.push(timePreview)
  }

  previewTokens.sort((left, right) => {
    const leftIndex = Number.parseInt(left.key.split("-").at(-1) || "0", 10)
    const rightIndex = Number.parseInt(right.key.split("-").at(-1) || "0", 10)
    return leftIndex - rightIndex
  })

  const scheduledDate = selectedDateValue

  return {
    cleanText: stripTokenRanges(taskInput, ranges),
    scheduledDate,
    subtaskTitles: subtaskParts,
    recurrence: recurrenceSelection ?? undefined,
    priority: prioritySelection,
    labelIds,
    newLabelNames,
    time: timeSelection,
    previewTokens,
  }
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
        columns: 5,
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
        const id = generateId()
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

          const updatedTodo = { ...targetTodo, ...updates }
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
      weekCount: 2,
      lastSessionDate: null,
      incrementWeekCount: () => set((state) => ({ weekCount: Math.min(4, state.weekCount + 1) })),
      decrementWeekCount: () => set((state) => ({ weekCount: Math.max(1, state.weekCount - 1) })),

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
        weekCount: state.weekCount,
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
          weekCount: persisted.weekCount ?? currentState.weekCount,
          lastSessionDate: persisted.lastSessionDate ?? currentState.lastSessionDate,
        }
      },
    }
  )
)

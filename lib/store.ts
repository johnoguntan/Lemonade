"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeColor = 
  | 'green' | 'lime' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'violet' | 'purple'
  | 'pink' | 'red' | 'orange' | 'yellow' | 'slate' | 'zinc'

export type BulletStyle = 'none' | 'dot' | 'dash' | 'arrow'

export interface SubTask {
  id: string
  text: string
  completed: boolean
}

export interface Tag {
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
  parentId?: string // For recurring instances
  priority?: 'high' | 'medium' | 'low' | 'none'
  tags?: string[] // Array of tag IDs
}

export interface List {
  id: string
  name: string
  todos: Todo[]
  type: 'list' | 'planning'
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
  showCompleted: boolean
  bulletStyle: BulletStyle
  startOnYesterday: boolean
  theme: 'light' | 'dark'
  accentColor: string
  showCelebrations: boolean
  colorPalette: string[]
  showDotGridBackground: boolean
}

export interface NaturalLanguagePreviewToken {
  key: string
  label: string
}

export interface ParsedNaturalLanguageTask {
  cleanText: string
  scheduledDate?: string
  recurrence?: {
    isRecurring: boolean
    recurringFrequency?: 'daily' | 'weekday' | 'weekly' | 'monthly'
    recurringDays?: number[]
    label: string
  }
  priority?: Todo['priority']
  tagIds: string[]
  newTagNames: string[]
  time?: string
  previewTokens: NaturalLanguagePreviewToken[]
}



interface LemonadeStore {
  // Preferences
  preferences: UserPreferences
  setPreferences: (prefs: Partial<UserPreferences>) => void
  
  // Calendar todos
  calendarTodos: Todo[]
  lastCreatedTodoId: string | null
  addCalendarTodo: (todo: Omit<Todo, 'id' | 'subtasks' | 'endOfDay' | 'createdAt'> & { endOfDay?: boolean; createdAt?: number }) => string
  clearLastCreatedTodoId: () => void
  updateCalendarTodo: (id: string, updates: Partial<Todo>) => void
  deleteCalendarTodo: (id: string) => void
  toggleCalendarTodo: (id: string) => void
  toggleEndOfDay: (id: string) => void
  addSubtask: (todoId: string, text: string) => void
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
  deleteListTodo: (listId: string, todoId: string) => void
  toggleListTodo: (listId: string, todoId: string) => void
  
 
  
  // Tags
  tags: Tag[]
  addTag: (name: string, color: string) => void
  ensureTagIds: (names: string[]) => string[]
  editTag: (id: string, name: string, color: string) => void
  deleteTag: (id: string) => void
  
  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  
  // Filter
  tagFilterId: string | null
  activeFilterColor: string | null
  setActiveFilterColor: (color: string | null) => void
  
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Calendar selection
  selectedCalendarDate: string
  setSelectedCalendarDate: (date: string) => void

    // Calendar expansion
    isCalendarExpanded: boolean
    toggleCalendar: () => void

    // Recurring todos
    generateRecurringInstances: () => void

    // Auto-rollover
    autoRollover: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

const normalizeTodo = (todo: Todo, fallbackCreatedAt: number): Todo => ({
  ...todo,
  createdAt: typeof todo.createdAt === "number" ? todo.createdAt : fallbackCreatedAt,
  endOfDay: typeof todo.endOfDay === "boolean" ? todo.endOfDay : false,
})

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
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase())

const normalizeTagName = (value: string) => value.trim().toLowerCase()

const normalizeTimeValue = (raw: string) =>
  raw.replace(/\s+/g, '').toLowerCase()

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
  const sorted = [...ranges].sort((left, right) => left.start - right.start)
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
  options: { tags: Tag[]; referenceDate?: Date }
): ParsedNaturalLanguageTask {
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
  const tagIds: string[] = []
  const newTagNames: string[] = []
  const tagPreviews: NaturalLanguagePreviewToken[] = []

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

  for (const match of input.matchAll(/\b(today|tomorrow)\b/gi)) {
    const keyword = match[0].toLowerCase()
    const resolved = startOfDay(referenceDate)
    if (keyword === "tomorrow") {
      resolved.setDate(resolved.getDate() + 1)
    }
    registerDate(match as RegExpExecArray, resolved, titleCase(keyword))
  }

  for (const match of input.matchAll(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const weekday = weekdayLookup[match[1].toLowerCase()]
    registerDate(match as RegExpExecArray, buildUpcomingWeekday(weekday, referenceDate), `Next ${titleCase(match[1])}`)
  }

  for (const match of input.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const matchIndex = match.index ?? 0
    const before = input.slice(Math.max(0, matchIndex - 6), matchIndex).toLowerCase()
    if (/\b(next|every)\s*$/.test(before)) {
      continue
    }
    const weekday = weekdayLookup[match[1].toLowerCase()]
    registerDate(match as RegExpExecArray, buildUpcomingWeekday(weekday, referenceDate), titleCase(match[1]))
  }

  for (const match of input.matchAll(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const month = monthLookup[match[1].toLowerCase()]
    const day = Number.parseInt(match[2], 10)
    if (Number.isNaN(day)) {
      continue
    }
    registerDate(match as RegExpExecArray, resolveMonthDayDate(month, day, referenceDate), `${titleCase(match[1])} ${day}`)
  }

  for (const match of input.matchAll(/\bevery\s+(day|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
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

  for (const match of input.matchAll(/!(high|medium|low)\b/gi)) {
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

  for (const match of input.matchAll(/#([a-z0-9_-]+)/gi)) {
    const tagName = normalizeTagName(match[1])
    const existingTag = options.tags.find((tag) => normalizeTagName(tag.name) === tagName)
    if (!pushRange({
      start: match.index!,
      end: match.index! + match[0].length,
      type: "tag",
      preview: {
        key: `tag-${match.index}`,
        label: existingTag ? `#${tagName}` : `#${tagName} (new)`,
      },
      payload: tagName,
    })) {
      continue
    }

    if (existingTag) {
      tagIds.push(existingTag.id)
    } else if (!newTagNames.includes(tagName)) {
      newTagNames.push(tagName)
    }

    tagPreviews.push({
      key: `tag-${match.index}`,
      label: existingTag ? `#${tagName}` : `#${tagName} (new)`,
    })
  }

  for (const match of input.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi)) {
    const normalized = normalizeTimeValue(match[0])
    const preview = { key: `time-${match.index}`, label: `🕒 ${normalized}` }
    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "time", preview, payload: normalized })) {
      if (match.index! >= timeIndex) {
        timeSelection = normalized
        timePreview = preview
        timeIndex = match.index!
      }
    }
  }

  for (const match of input.matchAll(/\b(morning|evening)\b/gi)) {
    const normalized = match[1].toLowerCase()
    const preview = { key: `time-${match.index}`, label: `🕒 ${titleCase(normalized)}` }
    if (pushRange({ start: match.index!, end: match.index! + match[0].length, type: "time", preview, payload: normalized })) {
      if (match.index! >= timeIndex) {
        timeSelection = normalized
        timePreview = preview
        timeIndex = match.index!
      }
    }
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
  previewTokens.push(...tagPreviews)
  if (timeSelection && timePreview && timeIndex >= 0) {
    previewTokens.push(timePreview)
  }

  previewTokens.sort((left, right) => {
    const leftIndex = Number.parseInt(left.key.split("-").at(-1) || "0", 10)
    const rightIndex = Number.parseInt(right.key.split("-").at(-1) || "0", 10)
    return leftIndex - rightIndex
  })

  return {
    cleanText: stripTokenRanges(input, ranges),
    scheduledDate: selectedDateValue,
    recurrence: recurrenceSelection ?? undefined,
    priority: prioritySelection,
    tagIds,
    newTagNames,
    time: timeSelection,
    previewTokens,
  }
}

const removeRecurringChildren = (todos: Todo[], parentId: string) =>
  todos.filter((todo) => todo.parentId !== parentId)

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
        showCompleted: true,
        bulletStyle: 'none',
        startOnYesterday: false,
        theme: 'light',
        accentColor: '#852CE6',
        showCelebrations: false,
        colorPalette: DEFAULT_COLOR_PALETTE,
        showDotGridBackground: true,
      },
      
      setPreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),
      
      // Calendar todos
      calendarTodos: [],
      lastCreatedTodoId: null,
      
      addCalendarTodo: (todo) => {
        const id = generateId()
        set((state) => ({
          calendarTodos: [...state.calendarTodos, {
            ...todo,
            id,
            createdAt: todo.createdAt ?? Date.now(),
            endOfDay: todo.endOfDay ?? false,
            subtasks: [],
          }],
          lastCreatedTodoId: id,
        }))
        get().generateRecurringInstances()
        return id
      },
      clearLastCreatedTodoId: () => set({ lastCreatedTodoId: null }),
      
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
            ? removeRecurringChildren(state.calendarTodos, id)
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
      
      deleteCalendarTodo: (id) => set((state) => ({
        calendarTodos: removeRecurringChildren(
          state.calendarTodos.filter((todo) => todo.id !== id),
          id
        )
      })),
      
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
      
      addSubtask: (todoId, text) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                subtasks: [...todo.subtasks, { id: generateId(), text, completed: false }]
              }
            : todo
        )
      })),
      
      toggleSubtask: (todoId, subtaskId) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                subtasks: todo.subtasks.map((st) =>
                  st.id === subtaskId ? { ...st, completed: !st.completed } : st
                )
              }
            : todo
        )
      })),
      
      deleteSubtask: (todoId, subtaskId) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                subtasks: todo.subtasks.filter((st) => st.id !== subtaskId)
              }
            : todo
        )
      })),
      
      moveTodoToDate: (todoId, newDate) => set((state) => ({
        calendarTodos: state.calendarTodos.map((todo) =>
          todo.id === todoId ? { ...todo, date: newDate } : todo
        )
      })),
      
      // Lists
      listTabs: [
        { id: 'planning-tab', name: 'PLANNING' },
        { id: 'my-lists-tab', name: 'MY LISTS' },
      ],

      addListTab: (name) => set((state) => ({
        listTabs: [...state.listTabs, { id: generateId(), name }]
      })),

      renameListTab: (id, name) => set((state) => ({
        listTabs: state.listTabs.map((tab) =>
          tab.id === id ? { ...tab, name } : tab
        )
      })),

      deleteListsInTab: (tabId) => set((state) => ({
        lists: state.lists.filter((list) => {
          const listTabId = list.tabId ?? (list.type === 'planning' ? 'planning-tab' : 'my-lists-tab')
          return listTabId !== tabId
        })
      })),

      lists: [
        { id: 'brain-dump', name: 'BRAIN DUMP', todos: [], type: 'list', tabId: 'my-lists-tab' },
        { id: 'grocery', name: 'GROCERY LIST', todos: [], type: 'list', tabId: 'my-lists-tab' },
        { id: 'to-buy', name: 'TO BUY', todos: [], type: 'list', tabId: 'my-lists-tab' },
        { id: 'shopping-returns', name: 'SHOPPING RETURNS', todos: [], type: 'list', tabId: 'my-lists-tab' },
        { id: 'to-read', name: 'TO READ', todos: [], type: 'list', tabId: 'my-lists-tab' },
        { id: 'goals', name: 'GOALS', todos: [], type: 'planning', tabId: 'planning-tab' },
        { id: 'someday', name: 'SOMEDAY', todos: [], type: 'planning', tabId: 'planning-tab' },
        { id: 'ideas', name: 'IDEAS', todos: [], type: 'planning', tabId: 'planning-tab' },
      ],
      
      addList: (name, type, tabId) => set((state) => ({
        lists: [...state.lists, {
          id: generateId(),
          name,
          todos: [],
          type,
          tabId: tabId ?? (type === 'planning' ? 'planning-tab' : 'my-lists-tab')
        }]
      })),
      
      deleteList: (id) => set((state) => ({
        lists: state.lists.filter((list) => list.id !== id)
      })),
      
      renameList: (id, name) => set((state) => ({
        lists: state.lists.map((list) =>
          list.id === id ? { ...list, name } : list
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
      
      addListTodo: (listId, text) => set((state) => ({
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
                }]
              }
            : list
        )
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
      tagFilterId: null,
      activeFilterColor: null,
      setActiveFilterColor: (color) => set({ activeFilterColor: color }),

      // Tags
      tags: [],
      addTag: (name, color) => set((state) => ({
        tags: [...state.tags, { id: generateId(), name, color }]
      })),
      ensureTagIds: (names) => {
        const state = get()
        const resolvedIds: string[] = []
        const existingByName = new Map(
          state.tags.map((tag) => [normalizeTagName(tag.name), tag])
        )
        const nextTags = [...state.tags]

        for (const rawName of names) {
          const normalized = normalizeTagName(rawName)
          const existing = existingByName.get(normalized)

          if (existing) {
            resolvedIds.push(existing.id)
            continue
          }

          const newTag = {
            id: generateId(),
            name: normalized,
            color: state.preferences.accentColor,
          }

          existingByName.set(normalized, newTag)
          nextTags.push(newTag)
          resolvedIds.push(newTag.id)
        }

        if (nextTags.length !== state.tags.length) {
          set({ tags: nextTags })
        }

        return resolvedIds
      },
      editTag: (id, name, color) => set((state) => ({
        tags: state.tags.map((tag) => tag.id === id ? { ...tag, name, color } : tag)
      })),
      deleteTag: (id) => set((state) => ({
        tags: state.tags.filter((tag) => tag.id !== id),
        calendarTodos: state.calendarTodos.map(todo => ({
          ...todo,
          tags: todo.tags?.filter(tagId => tagId !== id)
        })),
        lists: state.lists.map(list => ({
          ...list,
          todos: list.todos.map(todo => ({
            ...todo,
            tags: todo.tags?.filter(tagId => tagId !== id)
          }))
        }))
      })),

      // Sidebar
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Calendar selection
      selectedCalendarDate: getInitialCalendarDate(false),
      setSelectedCalendarDate: (date) => set({ selectedCalendarDate: date }),

      // Calendar expansion
      isCalendarExpanded: false,
      toggleCalendar: () => set((state) => ({ isCalendarExpanded: !state.isCalendarExpanded })),

      // Recurring todos
      generateRecurringInstances: () => {
        const state = get()
        const recurringParents = state.calendarTodos.filter(t => t.isRecurring && !t.parentId)
        let currentTodos = [...state.calendarTodos]
        let changed = false

        for (const parent of recurringParents) {
          const startDate = new Date(parent.date)
          startDate.setHours(0, 0, 0, 0)

          for (let i = 1; i <= 30; i++) {
            const nextDate = new Date(startDate)
            nextDate.setDate(startDate.getDate() + i)
            const nextDateStr = formatLocalDateKey(nextDate)

            // Check if instance already exists
            const exists = currentTodos.find(t => t.parentId === parent.id && t.date === nextDateStr)
            if (exists) continue

            // Check frequency
            let shouldAdd = false
            if (parent.recurringFrequency === 'daily') {
              shouldAdd = true
            } else if (parent.recurringFrequency === 'weekday') {
              const day = nextDate.getDay()
              if (day >= 1 && day <= 5) shouldAdd = true
            } else if (parent.recurringFrequency === 'weekly') {
              if (nextDate.getDay() === startDate.getDay()) shouldAdd = true
            } else if (parent.recurringFrequency === 'monthly') {
              if (nextDate.getDate() === startDate.getDate()) shouldAdd = true
            } else if (parent.recurringDays && parent.recurringDays.includes(nextDate.getDay())) {
              shouldAdd = true
            }

            if (shouldAdd) {
              currentTodos.push({
                ...parent,
                id: generateId(),
                date: nextDateStr,
                createdAt: parent.createdAt,
                completed: false,
                parentId: parent.id,
                isRecurring: false,
                subtasks: parent.subtasks.map(s => ({ ...s, id: generateId(), completed: false }))
              })
              changed = true
            }
          }
        }

        if (changed) {
          set({ calendarTodos: currentTodos })
        }
      },

      // Auto-rollover
      autoRollover: () => {
        const todayStr = formatLocalDateKey(new Date())
        const lastOpenedDate = localStorage.getItem('lemonade-last-opened')
        
        if (lastOpenedDate && lastOpenedDate < todayStr) {
          set((state) => {
            const updatedTodos = state.calendarTodos.map(todo => {
              // If todo is not completed, not recurring, not a heading, and is from a previous date
              if (!todo.completed && !todo.isRecurring && !todo.parentId && !todo.isHeading && todo.date < todayStr) {
                return { ...todo, date: todayStr }
              }
              return todo
            })
            return { calendarTodos: updatedTodos }
          })
        }
        
        localStorage.setItem('lemonade-last-opened', todayStr)
      },
    }),
    {
      name: 'lemonade-storage',
      partialize: (state) => ({
        preferences: state.preferences,
        calendarTodos: state.calendarTodos,
        listTabs: state.listTabs,
        lists: state.lists,
        tags: state.tags,
        searchQuery: state.searchQuery,
        tagFilterId: state.tagFilterId,
        sidebarOpen: state.sidebarOpen,
        isCalendarExpanded: state.isCalendarExpanded,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<LemonadeStore> | undefined
        const mergedPreferences = {
          ...currentState.preferences,
          ...persisted?.preferences,
          textSize: normalizeTextSizePreference(persisted?.preferences?.textSize),
          spacing: normalizeSpacingPreference(persisted?.preferences?.spacing),
          colorPalette: persisted?.preferences?.colorPalette ?? currentState.preferences.colorPalette,
          showDotGridBackground: persisted?.preferences?.showDotGridBackground ?? currentState.preferences.showDotGridBackground,
        }

        return {
          ...currentState,
          ...persisted,
          calendarTodos: (persisted?.calendarTodos ?? currentState.calendarTodos).map((todo, index) =>
            normalizeTodo(todo, index)
          ),
          lists: (persisted?.lists ?? currentState.lists).map((list, listIndex) => ({
            ...list,
            todos: list.todos.map((todo, todoIndex) =>
              normalizeTodo(todo, listIndex * 1000 + todoIndex)
            ),
          })),
          preferences: mergedPreferences,
          selectedCalendarDate: getInitialCalendarDate(mergedPreferences.startOnYesterday),
        }
      },
    }
  )
)

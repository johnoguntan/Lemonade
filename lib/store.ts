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
  textSize: 'S' | 'M' | 'L'
  spacing: 'S' | 'M' | 'L'
  showCompleted: boolean
  bulletStyle: BulletStyle
  startOnYesterday: boolean
  showLines: boolean
  theme: 'light' | 'dark'
  accentColor: string
  showCelebrations: boolean
}



interface LemonadeStore {
  // Preferences
  preferences: UserPreferences
  setPreferences: (prefs: Partial<UserPreferences>) => void
  
  // Calendar todos
  calendarTodos: Todo[]
  addCalendarTodo: (todo: Omit<Todo, 'id' | 'subtasks'>) => void
  updateCalendarTodo: (id: string, updates: Partial<Todo>) => void
  deleteCalendarTodo: (id: string) => void
  toggleCalendarTodo: (id: string) => void
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
  updateListTodo: (listId: string, todoId: string, updates: Partial<Todo>) => void
  deleteListTodo: (listId: string, todoId: string) => void
  toggleListTodo: (listId: string, todoId: string) => void
  moveListTodoToCalendar: (listId: string, todoId: string, date: string) => void
  
 
  
  // Tags
  tags: Tag[]
  addTag: (name: string, color: string) => void
  editTag: (id: string, name: string, color: string) => void
  deleteTag: (id: string) => void
  
  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  
  // Filter
  tagFilterId: string | null
  setTagFilterId: (id: string | null) => void
  
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

    // Calendar expansion
    isCalendarExpanded: boolean
    toggleCalendar: () => void

    // Recurring todos
    generateRecurringInstances: () => void

    // Auto-rollover
    autoRollover: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

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
        textSize: 'M',
        spacing: 'M',
        showCompleted: true,
        bulletStyle: 'none',
        startOnYesterday: false,
        showLines: true,
        theme: 'light',
        accentColor: '#852CE6',
        showCelebrations: false,
      },
      
      setPreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),
      
      // Calendar todos
      calendarTodos: [],
      
      addCalendarTodo: (todo) => {
        set((state) => ({
          calendarTodos: [...state.calendarTodos, {
            ...todo,
            id: generateId(),
            subtasks: [],
          }]
        }))
        get().generateRecurringInstances()
      },
      
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
                  date: '',
                  subtasks: [],
                }]
              }
            : list
        )
      })),
      
      updateListTodo: (listId, todoId, updates) => set((state) => ({
        lists: state.lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                todos: list.todos.map((todo) =>
                  todo.id === todoId ? { ...todo, ...updates } : todo
                )
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
      
      moveListTodoToCalendar: (listId, todoId, date) => {
        const state = get()
        const list = state.lists.find((l) => l.id === listId)
        const todo = list?.todos.find((t) => t.id === todoId)
        if (todo) {
          set((state) => ({
            calendarTodos: [...state.calendarTodos, { ...todo, date }],
            lists: state.lists.map((l) =>
              l.id === listId
                ? { ...l, todos: l.todos.filter((t) => t.id !== todoId) }
                : l
            )
          }))
        }
      },
      

      
      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      // Filter
      tagFilterId: null,
      setTagFilterId: (id) => set({ tagFilterId: id }),

      // Tags
      tags: [],
      addTag: (name, color) => set((state) => ({
        tags: [...state.tags, { id: generateId(), name, color }]
      })),
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
            const nextDateStr = nextDate.toISOString().split('T')[0]

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
        const todayStr = new Date().toISOString().split('T')[0]
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
    }
  )
)

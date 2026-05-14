import {
  FIXED_LIST_TABS,
  LEMONADE_STORAGE_KEY,
  ensureFixedLists,
  ensureFixedTabs,
  normalizeTodoPriority,
  type Label,
  type List,
  type ListTab,
  type SubTask,
  type Todo,
  useLemonadeStore,
} from "@/lib/store"

export const ALESSANDRO_SYNC_QUEUE_KEY = "alessandro-sync-queue"
export const ALESSANDRO_IMPORT_PROMPT_KEY = "alessandro-import-prompt"

export type CloudUserProfile = {
  email: string | null
  displayName: string | null
}

export type CloudTaskRecord = {
  id: string
  title: string
  date: string | null
  time: string | null
  priority: string
  completed: boolean
  completedAt: string | null
  notes: string | null
  location: string | null
  duration: number | null
  url: string | null
  photoUrl: string | null
  color: string | null
  icon: string | null
  recurring: string | null
  recurringDay: string | null
  reminder: number | null
  scheduledNotificationId: string | null
  snoozedUntil: string | null
  parentTaskId: string | null
  orderIndex: number
  whenAdded: string | null
  createdAt: string | null
  updatedAt: string | null
  endOfDay: boolean
  isHeading: boolean
  recurringDays: number[] | null
  recurringInterval: number | null
  recurringCustomText: string | null
  subtasks: SubTask[]
}

export type CloudLabelRecord = {
  id: string
  name: string
  color: string | null
  createdAt: string | null
}

export type CloudTaskLabelRecord = {
  taskId: string
  labelId: string
}

export type CloudListRecord = {
  id: string
  name: string
  tab: string
  type: string
  orderIndex: number
  createdAt: string | null
  updatedAt: string | null
}

export type CloudListItemRecord = {
  id: string
  listId: string
  content: string
  completed: boolean
  orderIndex: number
  createdAt: string | null
  notes: string | null
  updatedAt: string | null
}

export type CloudShoppingReturnRecord = {
  id: string
  item: string
  store: string | null
  deadline: string | null
  notes: string | null
  returned: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type CloudSnapshot = {
  profile: CloudUserProfile
  tasks: CloudTaskRecord[]
  labels: CloudLabelRecord[]
  taskLabels: CloudTaskLabelRecord[]
  lists: CloudListRecord[]
  listItems: CloudListItemRecord[]
  shoppingReturns: CloudShoppingReturnRecord[]
  latestUpdatedAt: string | null
}

export type PendingCloudQueue = {
  localUpdatedAt: string
  snapshot: Omit<CloudSnapshot, "latestUpdatedAt">
}

type LocalUserSlice = {
  calendarTodos: Todo[]
  lists: List[]
  listTabs: ListTab[]
  labels: Label[]
  preferences: {
    displayName: string
  }
}

const FIXED_TAB_LOOKUP = new Map(FIXED_LIST_TABS.map((tab) => [tab.id, tab.name]))

const coalesceDate = (value: number | string | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  if (typeof value === "string" && value.trim()) {
    return value
  }

  return null
}

const serializeTab = (tabId: string | undefined, tabs: ListTab[]) => {
  if (!tabId) {
    return "planning-tab"
  }

  if (FIXED_TAB_LOOKUP.has(tabId)) {
    return tabId
  }

  const customTab = tabs.find((tab) => tab.id === tabId)
  if (!customTab) {
    return tabId
  }

  return `custom:${customTab.id}:${encodeURIComponent(customTab.name)}`
}

const parseTab = (value: string) => {
  if (value.startsWith("custom:")) {
    const [, id, ...nameParts] = value.split(":")
    return {
      id,
      name: decodeURIComponent(nameParts.join(":") || "CUSTOM"),
    }
  }

  return {
    id: value,
    name: FIXED_TAB_LOOKUP.get(value) ?? value.toUpperCase(),
  }
}

export function buildCloudSnapshotFromState(state: LocalUserSlice): Omit<CloudSnapshot, "latestUpdatedAt"> {
  const taskLabels: CloudTaskLabelRecord[] = []
  const lists: CloudListRecord[] = []
  const listItems: CloudListItemRecord[] = []
  const shoppingReturns: CloudShoppingReturnRecord[] = []

  state.calendarTodos.forEach((todo) => {
    todo.labelIds.forEach((labelId) => {
      taskLabels.push({ taskId: todo.id, labelId })
    })
  })

  const tasks: CloudTaskRecord[] = state.calendarTodos.map((todo, index) => ({
    id: todo.id,
    title: todo.text,
    date: todo.date,
    time: todo.time ?? null,
    priority: normalizeTodoPriority(todo.priority),
    completed: todo.completed,
    completedAt: todo.completed ? coalesceDate(todo.createdAt) : null,
    notes: todo.notes ?? null,
    location: todo.location ?? null,
    duration: typeof todo.durationMinutes === "number" ? todo.durationMinutes : null,
    url: todo.url ?? null,
    photoUrl: todo.photoDataUrl ?? null,
    color: todo.color ?? null,
    icon: todo.icon ?? null,
    recurring: todo.isRecurring ? todo.recurringFrequency ?? "custom" : null,
    recurringDay: todo.recurringDays?.[0] != null ? String(todo.recurringDays[0]) : null,
    reminder: typeof todo.reminderOffsetMinutes === "number" ? todo.reminderOffsetMinutes : null,
    scheduledNotificationId: typeof todo.scheduledNotificationId === "string" ? todo.scheduledNotificationId : null,
    snoozedUntil: null,
    parentTaskId: todo.parentId ?? null,
    orderIndex: index,
    whenAdded: coalesceDate(todo.createdAt),
    createdAt: coalesceDate(todo.createdAt),
    updatedAt: new Date().toISOString(),
    endOfDay: todo.endOfDay,
    isHeading: Boolean(todo.isHeading),
    recurringDays: todo.recurringDays ?? null,
    recurringInterval: todo.recurringInterval ?? null,
    recurringCustomText: todo.recurringCustomText ?? null,
    subtasks: todo.subtasks,
  }))

  const labels: CloudLabelRecord[] = state.labels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
    createdAt: new Date().toISOString(),
  }))

  state.lists.forEach((list, listIndex) => {
    if (list.id === "shopping-returns" || list.type === "shopping-returns") {
      list.todos.forEach((todo) => {
        shoppingReturns.push({
          id: todo.id,
          item: todo.text,
          store: todo.storeName ?? null,
          deadline: todo.returnDeadline ?? null,
          notes: todo.notes ?? null,
          returned: todo.completed,
          createdAt: coalesceDate(todo.createdAt),
          updatedAt: new Date().toISOString(),
        })
      })
      return
    }

    lists.push({
      id: list.id,
      name: list.name,
      tab: serializeTab(list.tabId, state.listTabs),
      type: list.type,
      orderIndex: listIndex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    list.todos.forEach((todo, itemIndex) => {
      listItems.push({
        id: todo.id,
        listId: list.id,
        content: todo.text,
        completed: todo.completed,
        orderIndex: itemIndex,
        createdAt: coalesceDate(todo.createdAt),
        notes: todo.notes ?? null,
        updatedAt: new Date().toISOString(),
      })
    })
  })

  return {
    profile: {
      email: null,
      displayName: state.preferences.displayName ?? null,
    },
    tasks,
    labels,
    taskLabels,
    lists,
    listItems,
    shoppingReturns,
  }
}

export function getCloudSnapshotFromStore() {
  const state = useLemonadeStore.getState()
  return buildCloudSnapshotFromState({
    calendarTodos: state.calendarTodos,
    lists: state.lists,
    listTabs: state.listTabs,
    labels: state.labels,
    preferences: state.preferences,
  })
}

export function hasMeaningfulLocalData() {
  const state = useLemonadeStore.getState()

  const hasTasks = state.calendarTodos.length > 0
  const hasLabels = state.labels.length > 0
  const hasListItems = state.lists.some((list) => list.todos.length > 0)

  return hasTasks || hasLabels || hasListItems
}

function buildListTabsFromRemote(lists: CloudListRecord[]) {
  const remoteTabs = new Map<string, ListTab>()

  lists.forEach((list) => {
    const parsed = parseTab(list.tab)
    remoteTabs.set(parsed.id, parsed)
  })

  return ensureFixedTabs([...FIXED_LIST_TABS, ...remoteTabs.values()].filter((tab, index, items) => items.findIndex((item) => item.id === tab.id) === index))
}

export function applyCloudSnapshotToStore(snapshot: CloudSnapshot) {
  const nextLabels: Label[] = snapshot.labels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color ?? "#bbf7d0",
  }))

  const labelsByTaskId = new Map<string, string[]>()
  snapshot.taskLabels.forEach((entry) => {
    const existing = labelsByTaskId.get(entry.taskId) ?? []
    existing.push(entry.labelId)
    labelsByTaskId.set(entry.taskId, existing)
  })

  const nextCalendarTodos: Todo[] = snapshot.tasks
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((task) => ({
      id: task.id,
      text: task.title,
      completed: task.completed,
      date: task.date,
      createdAt: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
      endOfDay: task.endOfDay,
      time: task.time ?? undefined,
      reminderOffsetMinutes: typeof task.reminder === "number" ? task.reminder : null,
      scheduledNotificationId: task.scheduledNotificationId ?? null,
      durationMinutes: typeof task.duration === "number" ? task.duration : undefined,
      color: task.color ?? undefined,
      icon: task.icon ?? undefined,
      photoDataUrl: task.photoUrl ?? undefined,
      url: task.url ?? undefined,
      location: task.location ?? undefined,
      isHeading: task.isHeading,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      isRecurring: Boolean(task.recurring),
      recurringFrequency:
        task.recurring === "daily" ||
        task.recurring === "weekday" ||
        task.recurring === "weekly" ||
        task.recurring === "monthly"
          ? task.recurring
          : undefined,
      recurringDays: task.recurringDays ?? undefined,
      recurringInterval: task.recurringInterval ?? undefined,
      recurringCustomText: task.recurringCustomText ?? undefined,
      parentId: task.parentTaskId ?? null,
      priority: normalizeTodoPriority(task.priority),
      labelIds: labelsByTaskId.get(task.id) ?? [],
      notes: task.notes ?? undefined,
    }))

  const nextListTabs = buildListTabsFromRemote(snapshot.lists)
  const nextListsById = new Map<string, List>()

  snapshot.lists.forEach((list) => {
    const parsedTab = parseTab(list.tab)
    nextListsById.set(list.id, {
      id: list.id,
      name: list.name,
      todos: [],
      type: list.type === "planning" ? "planning" : "list",
      tabId: parsedTab.id,
    })
  })

  snapshot.listItems
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .forEach((item) => {
      const list = nextListsById.get(item.listId)
      if (!list) return

      list.todos.push({
        id: item.id,
        text: item.content,
        completed: item.completed,
        date: null,
        createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
        endOfDay: false,
        subtasks: [],
        priority: "normal",
        labelIds: [],
        notes: item.notes ?? undefined,
      })
    })

  const shoppingReturnsList: List = {
    id: "shopping-returns",
    name: "SHOPPING RETURNS",
    tabId: "shopping-returns-tab",
    type: "shopping-returns",
    todos: snapshot.shoppingReturns
      .slice()
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
        return leftTime - rightTime
      })
      .map((item) => ({
        id: item.id,
        text: item.item,
        completed: item.returned,
        date: null,
        createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
        endOfDay: false,
        subtasks: [],
        priority: "normal",
        labelIds: [],
        storeName: item.store ?? undefined,
        returnDeadline: item.deadline ?? undefined,
        notes: item.notes ?? undefined,
      })),
  }

  const nextLists = ensureFixedLists([
    ...Array.from(nextListsById.values()),
    shoppingReturnsList,
  ]).map((list) => {
    if (list.id === "shopping-returns") {
      return shoppingReturnsList
    }

    return nextListsById.get(list.id) ?? list
  })

  useLemonadeStore.setState((state) => {
    const nextDisplayName = snapshot.profile.displayName || state.preferences.displayName
    const noDataChanges =
      JSON.stringify(state.calendarTodos) === JSON.stringify(nextCalendarTodos) &&
      JSON.stringify(state.labels) === JSON.stringify(nextLabels) &&
      JSON.stringify(state.listTabs) === JSON.stringify(nextListTabs) &&
      JSON.stringify(state.lists) === JSON.stringify(nextLists) &&
      state.preferences.displayName === nextDisplayName &&
      state.lastCreatedTodoId === null &&
      state.taskHistoryPast.length === 0 &&
      state.taskHistoryFuture.length === 0 &&
      state.canUndoTaskAction === false &&
      state.canRedoTaskAction === false

    if (noDataChanges) {
      return state
    }

    return {
      ...state,
      calendarTodos: nextCalendarTodos,
      labels: nextLabels,
      listTabs: nextListTabs,
      lists: nextLists,
      preferences: {
        ...state.preferences,
        displayName: nextDisplayName,
      },
      taskHistoryPast: [],
      taskHistoryFuture: [],
      canUndoTaskAction: false,
      canRedoTaskAction: false,
      lastCreatedTodoId: null,
    }
  })

  // Remote snapshots may contain only the recurring parent tasks.
  // Always regenerate derived future instances after applying server state.
  useLemonadeStore.getState().generateRecurringInstances()
}

export function readPendingCloudQueue(): PendingCloudQueue | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(ALESSANDRO_SYNC_QUEUE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as PendingCloudQueue
  } catch {
    return null
  }
}

export function writePendingCloudQueue(value: PendingCloudQueue | null) {
  if (typeof window === "undefined") {
    return
  }

  if (!value) {
    window.localStorage.removeItem(ALESSANDRO_SYNC_QUEUE_KEY)
    return
  }

  window.localStorage.setItem(ALESSANDRO_SYNC_QUEUE_KEY, JSON.stringify(value))
}

export function getImportPromptStorageKey(userId: string) {
  return `${ALESSANDRO_IMPORT_PROMPT_KEY}:${userId}`
}

export function resetPersistedLocalStore() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(LEMONADE_STORAGE_KEY)
  useLemonadeStore.setState((state) => ({ ...state }))
}

export function getLatestTimestamp(snapshot: CloudSnapshot | Omit<CloudSnapshot, "latestUpdatedAt">) {
  const timestamps = [
    ...snapshot.tasks.map((task) => task.updatedAt),
    ...snapshot.labels.map((label) => label.createdAt),
    ...snapshot.lists.map((list) => list.updatedAt),
    ...snapshot.listItems.map((item) => item.updatedAt),
    ...snapshot.shoppingReturns.map((item) => item.updatedAt),
  ].filter((value): value is string => Boolean(value))

  if (timestamps.length === 0) {
    return null
  }

  return timestamps.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null
}

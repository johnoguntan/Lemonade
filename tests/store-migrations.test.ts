import test from "node:test"
import assert from "node:assert/strict"

import { STORAGE_VERSION, migratePersistedLemonadeState } from "../lib/store"

test("legacy preferences are normalized during migration", () => {
  const migrated = migratePersistedLemonadeState({
    preferences: {
      textSize: "S",
      spacing: "L",
    },
  })

  assert.equal(STORAGE_VERSION, 2)
  assert.equal(migrated.preferences?.textSize, "sm")
  assert.equal(migrated.preferences?.spacing, "comfortable")
  assert.equal(migrated.preferences?.showDotGridBackground, true)
})

test("legacy todos gain normalized createdAt and endOfDay values", () => {
  const migrated = migratePersistedLemonadeState({
    calendarTodos: [
      {
        id: "todo-1",
        text: "Legacy todo",
        completed: false,
        date: "2026-03-24",
        priority: "high",
        subtasks: [{ id: "sub-1", text: "Legacy subtask", completed: false }],
      },
    ],
  })

  assert.equal(migrated.calendarTodos?.length, 1)
  assert.equal(migrated.calendarTodos?.[0]?.createdAt, 0)
  assert.equal(migrated.calendarTodos?.[0]?.endOfDay, false)
  assert.equal(migrated.calendarTodos?.[0]?.parentId, null)
  assert.equal(migrated.calendarTodos?.[0]?.priority, "urgent")
  assert.deepEqual(migrated.calendarTodos?.[0]?.subtasks, [
    { id: "sub-1", title: "Legacy subtask", completed: false, parentId: "todo-1" },
  ])
})

test("tasks without a priority are normalized to normal", () => {
  const migrated = migratePersistedLemonadeState({
    calendarTodos: [
      {
        id: "todo-1",
        text: "No priority",
        completed: false,
        date: "2026-03-24",
        subtasks: [],
      },
    ],
  })

  assert.equal(migrated.calendarTodos?.[0]?.priority, "normal")
})

test("legacy list todos are normalized during migration", () => {
  const migrated = migratePersistedLemonadeState({
    lists: [
      {
        id: "list-1",
        name: "Legacy list",
        type: "list",
        todos: [
          {
            id: "todo-1",
            text: "Legacy list todo",
            completed: false,
            date: "2026-03-24",
            subtasks: [{ id: "sub-1", text: "Legacy subtask", completed: true }],
          },
        ],
      },
    ],
  })

  const legacyList = migrated.lists?.find((list) => list.id === "list-1")

  assert.equal(legacyList?.todos[0]?.createdAt, 0)
  assert.equal(legacyList?.todos[0]?.endOfDay, false)
  assert.equal(legacyList?.todos[0]?.parentId, null)
  assert.deepEqual(legacyList?.todos[0]?.subtasks, [
    { id: "sub-1", title: "Legacy subtask", completed: true, parentId: "todo-1" },
  ])
})

test("weekCount is locked to the one-week layout", () => {
  const lowWeekCount = migratePersistedLemonadeState({ weekCount: 0 })
  const highWeekCount = migratePersistedLemonadeState({ weekCount: 99 })

  assert.equal(lowWeekCount.weekCount, 1)
  assert.equal(highWeekCount.weekCount, 1)
})

test("invalid persisted arrays fall back safely", () => {
  const migrated = migratePersistedLemonadeState({
    calendarTodos: null,
    lists: null,
    listTabs: null,
    labels: null,
  })

  assert.deepEqual(migrated.calendarTodos, [])
  assert.ok(Array.isArray(migrated.lists))
  assert.ok(Array.isArray(migrated.listTabs))
  assert.deepEqual(migrated.labels, [])
})

test("fixed shopping returns tab and list are present after migration", () => {
  const migrated = migratePersistedLemonadeState({
    listTabs: [{ id: "my-lists-tab", name: "MY LISTS" }],
    lists: [],
  })

  assert.ok(migrated.listTabs?.some((tab) => tab.id === "shopping-returns-tab"))
  assert.ok(
    migrated.lists?.some(
      (list) => list.id === "shopping-returns" && list.tabId === "shopping-returns-tab"
    )
  )
})

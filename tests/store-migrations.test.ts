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

  assert.equal(STORAGE_VERSION, 1)
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
        subtasks: [],
      },
    ],
  })

  assert.equal(migrated.calendarTodos?.length, 1)
  assert.equal(migrated.calendarTodos?.[0]?.createdAt, 0)
  assert.equal(migrated.calendarTodos?.[0]?.endOfDay, false)
  assert.equal(migrated.calendarTodos?.[0]?.parentId, null)
  assert.deepEqual(migrated.calendarTodos?.[0]?.subtasks, [])
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
            subtasks: [],
          },
        ],
      },
    ],
  })

  assert.equal(migrated.lists?.[0]?.todos[0]?.createdAt, 0)
  assert.equal(migrated.lists?.[0]?.todos[0]?.endOfDay, false)
  assert.equal(migrated.lists?.[0]?.todos[0]?.parentId, null)
  assert.deepEqual(migrated.lists?.[0]?.todos[0]?.subtasks, [])
})

test("weekCount is clamped into the supported range", () => {
  const lowWeekCount = migratePersistedLemonadeState({ weekCount: 0 })
  const highWeekCount = migratePersistedLemonadeState({ weekCount: 99 })

  assert.equal(lowWeekCount.weekCount, 1)
  assert.equal(highWeekCount.weekCount, 4)
})

test("invalid persisted arrays fall back safely", () => {
  const migrated = migratePersistedLemonadeState({
    calendarTodos: null,
    lists: null,
    listTabs: null,
    tags: null,
  })

  assert.deepEqual(migrated.calendarTodos, [])
  assert.deepEqual(migrated.lists, [])
  assert.deepEqual(migrated.listTabs, [])
  assert.deepEqual(migrated.tags, [])
})

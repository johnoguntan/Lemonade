import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { addDays, addMonths, endOfMonth } from "date-fns"

import { formatLocalDateKey, useLemonadeStore } from "../lib/store"

const resetRecurringTestState = () => {
  useLemonadeStore.setState({
    calendarTodos: [],
    lastCreatedTodoId: null,
    searchQuery: "",
    tagFilterId: null,
    activeFilterColor: null,
  })
}

beforeEach(() => {
  resetRecurringTestState()
})

test("daily recurring tasks generate a long future window without duplicates", () => {
  const today = new Date()
  const todayKey = formatLocalDateKey(today)
  const parentId = useLemonadeStore.getState().addCalendarTodo({
    text: "Daily test",
    completed: false,
    date: todayKey,
    isRecurring: true,
    recurringFrequency: "daily",
  })

  let state = useLemonadeStore.getState()
  const initialChildren = state.calendarTodos.filter((todo) => todo.parentId === parentId)
  const uniqueDates = new Set(initialChildren.map((todo) => todo.date))

  assert.equal(initialChildren.length, 730)
  assert.equal(uniqueDates.size, 730)
  assert.ok(initialChildren.every((todo) => todo.text === "Daily test"))
  assert.ok(initialChildren.every((todo) => todo.completed === false))
  assert.ok(initialChildren.every((todo) => todo.isRecurring === true))

  state.generateRecurringInstances()
  state = useLemonadeStore.getState()

  const regeneratedChildren = state.calendarTodos.filter((todo) => todo.parentId === parentId)
  assert.equal(regeneratedChildren.length, 730)
})

test("monthly recurring tasks roll over month-end correctly", () => {
  const parentDate = endOfMonth(new Date())
  const parentId = useLemonadeStore.getState().addCalendarTodo({
    text: "Month end",
    completed: false,
    date: formatLocalDateKey(parentDate),
    isRecurring: true,
    recurringFrequency: "monthly",
  })

  const state = useLemonadeStore.getState()
  const childDates = state.calendarTodos
    .filter((todo) => todo.parentId === parentId)
    .map((todo) => todo.date)

  assert.ok(childDates.includes(formatLocalDateKey(addMonths(parentDate, 1))))
  assert.ok(childDates.includes(formatLocalDateKey(addMonths(parentDate, 2))))
})

test("updating a recurring parent clears old incomplete children but keeps completed ones", () => {
  const today = new Date()
  const tomorrowKey = formatLocalDateKey(addDays(today, 1))
  const dayAfterTomorrowKey = formatLocalDateKey(addDays(today, 2))
  const nextMonthKey = formatLocalDateKey(addMonths(today, 1))

  const parentId = useLemonadeStore.getState().addCalendarTodo({
    text: "Recurring cleanup",
    completed: false,
    date: formatLocalDateKey(today),
    isRecurring: true,
    recurringFrequency: "daily",
  })

  const tomorrowChild = useLemonadeStore
    .getState()
    .calendarTodos.find((todo) => todo.parentId === parentId && todo.date === tomorrowKey)
  const dayAfterTomorrowChild = useLemonadeStore
    .getState()
    .calendarTodos.find((todo) => todo.parentId === parentId && todo.date === dayAfterTomorrowKey)

  assert.ok(tomorrowChild)
  assert.ok(dayAfterTomorrowChild)

  useLemonadeStore.getState().toggleCalendarTodo(dayAfterTomorrowChild!.id)
  useLemonadeStore.getState().updateCalendarTodo(parentId, {
    recurringFrequency: "monthly",
  })

  const state = useLemonadeStore.getState()
  const remainingTomorrowChild = state.calendarTodos.find((todo) => todo.id === tomorrowChild!.id)
  const remainingCompletedChild = state.calendarTodos.find((todo) => todo.id === dayAfterTomorrowChild!.id)
  const nextMonthChild = state.calendarTodos.find((todo) => todo.parentId === parentId && todo.date === nextMonthKey)

  assert.equal(remainingTomorrowChild, undefined)
  assert.ok(remainingCompletedChild)
  assert.equal(remainingCompletedChild?.completed, true)
  assert.ok(nextMonthChild)
})


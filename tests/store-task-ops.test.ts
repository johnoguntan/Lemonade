import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"

import { useLemonadeStore } from "../lib/store"

const reset = () => {
  useLemonadeStore.setState({
    calendarTodos: [],
    selectedTaskIds: [],
    collapsedSubtasks: {},
    lastCreatedTodoId: null,
    searchQuery: "",
    labelFilterIds: [],
    activeFilterColor: null,
    taskHistoryPast: [],
    taskHistoryFuture: [],
  })
}

beforeEach(reset)

const addTodo = (text: string) =>
  useLemonadeStore.getState().addCalendarTodo({ text, completed: false, date: "2026-06-05", labelIds: [] })

test("splitCalendarTodo replaces one task with several", () => {
  const id = addTodo("Buy milk, eggs, bread")
  useLemonadeStore.getState().splitCalendarTodo(id, ["Buy milk", "Buy eggs", "Buy bread"])

  const texts = useLemonadeStore.getState().calendarTodos.map((todo) => todo.text)
  assert.ok(!texts.includes("Buy milk, eggs, bread"))
  assert.ok(texts.includes("Buy milk"))
  assert.ok(texts.includes("Buy eggs"))
  assert.ok(texts.includes("Buy bread"))
})

test("mergeSelectedTasks combines selected tasks into one", () => {
  const a = addTodo("Task A")
  const b = addTodo("Task B")
  useLemonadeStore.getState().toggleTaskSelection(a)
  useLemonadeStore.getState().toggleTaskSelection(b)
  useLemonadeStore.getState().mergeSelectedTasks("Merged task")

  const texts = useLemonadeStore.getState().calendarTodos.map((todo) => todo.text)
  assert.ok(texts.includes("Merged task"))
  assert.ok(!texts.includes("Task A"))
  assert.ok(!texts.includes("Task B"))
  assert.equal(useLemonadeStore.getState().selectedTaskIds.length, 0)
})

test("mergeSelectedTasks needs at least two tasks", () => {
  const a = addTodo("Only one")
  useLemonadeStore.getState().toggleTaskSelection(a)
  useLemonadeStore.getState().mergeSelectedTasks("Should not merge")

  const texts = useLemonadeStore.getState().calendarTodos.map((todo) => todo.text)
  assert.ok(texts.includes("Only one"))
  assert.ok(!texts.includes("Should not merge"))
})

test("promoteSubtaskToTask turns a subtask into a top-level task", () => {
  const id = useLemonadeStore.getState().addCalendarTodo({
    text: "Parent",
    completed: false,
    date: "2026-06-05",
    labelIds: [],
    subtasks: [{ title: "Child task", completed: false }],
  })

  const parent = useLemonadeStore.getState().calendarTodos.find((todo) => todo.id === id)
  if (!parent) throw new Error("parent not found")
  const subtaskId = parent.subtasks[0]?.id
  if (!subtaskId) throw new Error("subtask not found")

  useLemonadeStore.getState().promoteSubtaskToTask(id, subtaskId)

  const todos = useLemonadeStore.getState().calendarTodos
  const promoted = todos.find((todo) => todo.text === "Child task")
  assert.ok(promoted, "promoted task should exist")
  assert.equal(promoted?.parentId, undefined)

  const updatedParent = todos.find((todo) => todo.id === id)
  assert.equal(updatedParent?.subtasks.length, 0)
})

// Regression tests: the task edit form has no Save button — Enter saves from
// anywhere in the form (even when focus escaped to <body> via a picker), and
// Escape cancels.
import "./helpers/register-test-env"

import { test, beforeEach, afterEach } from "node:test"
import * as assert from "node:assert/strict"
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { TaskRow } from "@/components/daily/TaskRow"
import { useLemonadeStore } from "@/lib/store"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
  })
}

const pressKey = (target: EventTarget, key: string) => {
  act(() => {
    target.dispatchEvent(
      new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    )
  })
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

/** Create a fresh todo in the store and render its TaskRow in edit mode. */
const renderEditingRow = (text: string) => {
  const id = useLemonadeStore.getState().addCalendarTodo({ text, completed: false, date: null })
  const todo = useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)!
  act(() => {
    root.render(React.createElement(TaskRow, { todo }))
  })
  // Enter edit mode via double-click on the title.
  const title = Array.from(container.querySelectorAll("p")).find((p) => p.textContent === text)!
  act(() => {
    title.dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }))
  })
  const input = container.querySelector("input")! as HTMLInputElement
  assert.equal(input.value, text, "edit form should open with the title input")
  return { id, input }
}

const todoText = (id: string) =>
  useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)?.text

test("TaskRow edit: the Save button is gone", () => {
  renderEditingRow("Check no save button")
  const saveButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Save"
  )
  assert.equal(saveButton, undefined)
})

test("TaskRow edit: Enter in the title input saves and closes the form", async () => {
  const { id, input } = renderEditingRow("Old title")
  setInputValue(input, "New title")
  pressKey(input, "Enter")
  // The input is committed via blur + deferred save.
  await act(tick)
  assert.equal(todoText(id), "New title")
  assert.equal(container.querySelector("input"), null, "edit form should close")
})

test("TaskRow edit: Enter saves while a picker is open and focus is on <body>", async () => {
  const { id, input } = renderEditingRow("Call john")
  setInputValue(input, "Call john updated")

  // Open the time wheel (the date picker now opens on field focus and closes
  // on blur, so the wheel is the picker that can be open with focus on <body>).
  act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Open time picker"]')!.click())
  act(() => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  })
  assert.equal(document.activeElement, document.body)

  pressKey(document.body, "Enter")
  await act(tick)
  assert.equal(todoText(id), "Call john updated")
  assert.equal(container.querySelector("input"), null, "edit form should close")
})

test("TaskRow edit: time wheel closes when clicking anywhere else", () => {
  renderEditingRow("Pick a time")

  act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Open time picker"]')!.click())
  assert.ok(container.querySelector("[data-time-picker]"), "time wheel is open")

  // Click INSIDE the wheel — stays open.
  act(() => {
    container.querySelector("[data-time-picker]")!.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true })
    )
  })
  assert.ok(container.querySelector("[data-time-picker]"), "wheel stays open for clicks inside it")

  // Click anywhere else — closes.
  act(() => {
    document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }))
  })
  assert.equal(container.querySelector("[data-time-picker]"), null, "wheel closes on outside click")
})

test("TaskRow edit: Escape cancels without saving", () => {
  const { id, input } = renderEditingRow("Keep me")
  setInputValue(input, "Discard me")
  pressKey(input, "Escape")
  assert.equal(todoText(id), "Keep me")
  assert.equal(container.querySelector("input"), null, "edit form should close")
})

test("TaskRow edit: Enter in the add-subtask input adds a subtask, does not close the form", () => {
  const { id } = renderEditingRow("Task with subtasks")
  const subtaskInput = container.querySelector<HTMLInputElement>('input[placeholder="+ Add subtask…"]')!
  setInputValue(subtaskInput, "First subtask")
  pressKey(subtaskInput, "Enter")

  const todo = useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)!
  assert.equal(todo.subtasks?.length, 1)
  assert.equal(todo.subtasks?.[0].title, "First subtask")
  assert.notEqual(container.querySelector("input"), null, "edit form should stay open")
})

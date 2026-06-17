// Regression tests: Enter must add the task no matter what dropdown is open,
// even when focus has escaped the quick-add container (e.g. the user clicked a
// non-focusable spot inside a dropdown and focus jumped to <body>).
import "./helpers/register-test-env"

import { test, beforeEach, afterEach } from "node:test"
import * as assert from "node:assert/strict"
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { SectionLines } from "@/components/daily/SectionLines"
import { QuickInputBar } from "@/components/task-creation/QuickInputBar"
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

// ── helpers ──────────────────────────────────────────────────────────────────

const setInputValue = (input: HTMLInputElement, value: string) => {
  // Go through the native setter so React's onChange sees the update.
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

const click = (el: HTMLElement) => act(() => el.click())

const byLabel = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!

// ── SectionLines (inline section quick-add rows) ─────────────────────────────

const renderSectionRow = (onAdd: (text: string) => void) => {
  act(() => {
    root.render(
      React.createElement(SectionLines, {
        count: 1,
        onAdd,
        placeholder: "Add a task…",
      })
    )
  })
  // Activate the row.
  click(byLabel("Add a task"))
  return container.querySelector<HTMLInputElement>('input[placeholder="Add a task…"]')!
}

test("SectionLines: Enter on the input adds the task", () => {
  const added: string[] = []
  const input = renderSectionRow((text) => added.push(text))
  setInputValue(input, "Buy milk")
  pressKey(input, "Enter")
  assert.deepEqual(added, ["Buy milk"])
})

test("SectionLines: Enter adds the task while a dropdown is open and focus is on <body>", () => {
  const added: string[] = []
  const input = renderSectionRow((text) => added.push(text))
  setInputValue(input, "Call Sam")

  // Open the Priority dropdown (icon row appears once the input has focus).
  act(() => input.focus())
  click(byLabel("Priority"))
  assert.ok(container.textContent!.includes("Priority"), "priority dropdown should be open")

  // Simulate clicking a non-focusable spot inside the dropdown: focus escapes
  // the container to <body>. This is the exact case that used to swallow Enter.
  act(() => input.blur())
  assert.equal(document.activeElement, document.body)

  pressKey(document.body, "Enter")
  assert.deepEqual(added, ["Call Sam"])
})

test("SectionLines: Escape on <body> with a dropdown open cancels the row", () => {
  let cancelled = false
  act(() => {
    root.render(
      React.createElement(SectionLines, {
        count: 1,
        onAdd: () => {},
        placeholder: "Add a task…",
      })
    )
  })
  click(byLabel("Add a task"))
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Add a task…"]')!
  act(() => input.focus())
  click(byLabel("Priority"))
  act(() => input.blur())

  // Row unmounts on cancel (empty text → onCancel), so watch the DOM.
  pressKey(document.body, "Escape")
  cancelled = container.querySelector('input[placeholder="Add a task…"]') === null
  assert.ok(cancelled, "row should close on Escape")
})

test("SectionLines: Enter in an unrelated input elsewhere is NOT hijacked", () => {
  const added: string[] = []
  const input = renderSectionRow((text) => added.push(text))
  setInputValue(input, "Should not submit")
  act(() => input.focus())
  click(byLabel("Priority"))

  const outside = document.createElement("input")
  document.body.appendChild(outside)
  act(() => outside.focus())
  pressKey(outside, "Enter")
  assert.deepEqual(added, [], "typing Enter in an unrelated field must not add the task")
  outside.remove()
})

// ── QuickInputBar (top-level "Add New Task" bar, store-backed) ───────────────

test("QuickInputBar: Enter adds the task while a dropdown is open and focus is on <body>", () => {
  act(() => {
    root.render(React.createElement(QuickInputBar))
  })
  const input = container.querySelector<HTMLInputElement>('input[data-quick-task-input="true"]')!
  const before = useLemonadeStore.getState().calendarTodos.length

  act(() => input.focus())
  setInputValue(input, "Quick task via global enter")
  click(byLabel("Priority"))

  act(() => input.blur())
  assert.equal(document.activeElement, document.body)

  pressKey(document.body, "Enter")

  const todos = useLemonadeStore.getState().calendarTodos
  assert.equal(todos.length, before + 1)
  assert.equal(todos[todos.length - 1].text, "Quick task via global enter")
})

// Tests for quick-add interaction rules:
//   • + toggles the options row only — it never submits
//   • hover-opened dropdowns persist after the cursor leaves; outside click closes
//   • time sub-picker closes when another element in the panel is clicked
//   • the draft resets to defaults (today) after a task is added
//   • task chips: url/phone/location are clickable; attachment has preview + download
//   • snooze icon opens an options menu instead of instantly snoozing
import "./helpers/register-test-env"

import { test, beforeEach, afterEach } from "node:test"
import * as assert from "node:assert/strict"
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { QuickInputBar, createDefaultDraft, type TaskDraftState } from "@/components/task-creation/QuickInputBar"
import { CalendarDropdown } from "@/components/task-creation/CalendarDropdown"
import { AttachmentDropdown } from "@/components/task-creation/AttachmentDropdown"
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
    target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
  })
}

const mouse = (el: Element, type: string) => {
  act(() => {
    el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }))
  })
}

// React implements onMouseEnter/onMouseLeave on top of mouseover/mouseout
// with relatedTarget — raw "mouseenter" dispatches don't reach it.
const hoverEnter = (el: Element) => {
  act(() => {
    el.dispatchEvent(
      new window.MouseEvent("mouseover", { bubbles: true, cancelable: true, relatedTarget: document.body })
    )
  })
}
const hoverLeave = (el: Element) => {
  act(() => {
    el.dispatchEvent(
      new window.MouseEvent("mouseout", { bubbles: true, cancelable: true, relatedTarget: document.body })
    )
  })
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

const byLabel = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)

// ── QuickInputBar interaction rules ──────────────────────────────────────────

const renderBar = () => {
  act(() => {
    root.render(React.createElement(QuickInputBar))
  })
  return container.querySelector<HTMLInputElement>('input[data-quick-task-input="true"]')!
}

test("+ never submits — it only toggles the options row", () => {
  const input = renderBar()
  const before = useLemonadeStore.getState().calendarTodos.length

  setInputValue(input, "Should not be added by plus")
  act(() => input.focus()) // focus shows the icon row
  const plus = byLabel("Show task options")!
  act(() => plus.click())

  assert.equal(useLemonadeStore.getState().calendarTodos.length, before, "plus must not add a task")
  assert.equal(input.value, "Should not be added by plus", "draft text stays")
})

test("hover-opened dropdown stays open after the cursor leaves; outside click closes it", () => {
  const input = renderBar()
  act(() => input.focus())

  const priorityBtn = byLabel("Priority")!
  hoverEnter(priorityBtn)
  assert.ok(container.textContent!.includes("URGENT"), "priority dropdown opens on hover")

  // Cursor leaves the icon AND the panel — dropdown must stay.
  hoverLeave(priorityBtn)
  assert.ok(container.textContent!.includes("URGENT"), "dropdown persists after hover leaves")

  // Click somewhere else on the page — dropdown closes.
  act(() => {
    document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }))
  })
  assert.ok(!container.textContent!.includes("URGENT"), "dropdown closes on outside click")
})

test("draft resets to default (today) after a task is added", async () => {
  const input = renderBar()
  act(() => input.focus())
  // Plain title (no date words) so the NLP parser is skipped and the add is sync.
  setInputValue(input, "Buy stamps")

  // Open the calendar dropdown and pick Tomorrow.
  act(() => byLabel("Schedule")!.click())
  const tomorrowBtn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Tomorrow"
  )!
  act(() => tomorrowBtn.click())

  pressKey(input, "Enter")
  await act(tick)

  const todos = useLemonadeStore.getState().calendarTodos
  const added = todos[todos.length - 1]
  assert.equal(added.text, "Buy stamps")

  // Re-open the calendar dropdown: schedule input is back to its default
  // (empty = today), not stuck on the previously picked date.
  act(() => input.focus())
  act(() => byLabel("Schedule")!.click())
  const scheduleInput = container.querySelector<HTMLInputElement>(
    'input[placeholder="e.g. 2/10/2026 or 4th of July"]'
  )!
  assert.equal(scheduleInput.value, "", "schedule date resets after adding")
  assert.equal(input.value, "", "title resets after adding")
})

test("Enter inside the Repeat picker adds the task WITH the chosen repeat", async () => {
  const input = renderBar()
  act(() => input.focus())
  setInputValue(input, "Water the plants")

  // Open calendar dropdown → open the Repeat picker (its toggle reads "Never").
  act(() => byLabel("Schedule")!.click())
  const repeatToggle = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().startsWith("Never")
  )!
  act(() => repeatToggle.click())

  // Pick Weekly + Wednesday — selections commit to the draft immediately.
  const weekly = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Weekly" || b.textContent?.trim() === "Weekly✓"
  )!
  act(() => weekly.click())
  const wednesday = Array.from(container.querySelectorAll("button")).filter(
    (b) => b.textContent?.trim() === "W"
  )[0]!
  act(() => wednesday.click())

  // Enter from inside the picker (focus on the day button in Chrome, or on
  // <body> in Safari — test both paths end in a submit).
  pressKey(wednesday, "Enter")
  await act(tick)

  const todos = useLemonadeStore.getState().calendarTodos
  const added = todos[todos.length - 1]
  assert.equal(added.text, "Water the plants")
  assert.equal(added.isRecurring, true, "task is recurring")
  assert.equal(added.recurringFrequency, "weekly")
})

test("AttachmentDropdown: typed URL gets an open-in-new-tab link", () => {
  let draft: TaskDraftState = { ...createDefaultDraft(), url: "example.com/path" }
  const onChange = (updates: Partial<TaskDraftState>) => {
    draft = { ...draft, ...updates }
    act(() => root.render(React.createElement(AttachmentDropdown, { value: draft, onChange })))
  }
  act(() => root.render(React.createElement(AttachmentDropdown, { value: draft, onChange })))

  const openLink = container.querySelector<HTMLAnchorElement>('a[aria-label="Open link in new tab"]')
  assert.ok(openLink, "open-in-new-tab link is shown while adding a URL")
  assert.equal(openLink!.getAttribute("href"), "https://example.com/path", "URL is normalized with scheme")
  assert.equal(openLink!.getAttribute("target"), "_blank")
  assert.equal(openLink!.getAttribute("rel"), "noopener noreferrer")
})

test("AttachmentDropdown: no open link until something URL-like is typed", () => {
  const draft: TaskDraftState = createDefaultDraft()
  act(() => root.render(React.createElement(AttachmentDropdown, { value: draft, onChange: () => {} })))
  assert.equal(container.querySelector('a[aria-label="Open link in new tab"]'), null)
})

// ── CalendarDropdown: time picker dismissal ──────────────────────────────────

test("time wheel closes when another element in the panel is clicked", () => {
  let draft: TaskDraftState = createDefaultDraft()
  const onChange = (updates: Partial<TaskDraftState>) => {
    draft = { ...draft, ...updates }
    rerender()
  }
  const rerender = () => {
    act(() => {
      root.render(React.createElement(CalendarDropdown, { value: draft, onChange }))
    })
  }
  rerender()

  const openPopovers = () => container.querySelectorAll("[data-floating-picker]").length
  assert.equal(openPopovers(), 0, "no sub-picker open initially")

  // Open the "Today at <time>" wheel.
  const todayTimeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("10:00 AM")
  )!
  act(() => todayTimeBtn.click())
  assert.equal(openPopovers(), 1, "time wheel is open")

  // Mousedown on another element in the panel (the "Next Week" row).
  const nextWeek = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Next Week"
  )!
  mouse(nextWeek, "mousedown")
  assert.equal(openPopovers(), 0, "time wheel closed after clicking another element")
})

// ── TaskRow: snooze menu + functional chips ──────────────────────────────────

const renderRow = (todoInput: Record<string, unknown>) => {
  const id = useLemonadeStore.getState().addCalendarTodo({ text: "Chip task", completed: false, date: null, ...todoInput })
  const todo = useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)!
  act(() => {
    root.render(React.createElement(TaskRow, { todo }))
  })
  return id
}

test("snooze icon opens an options menu and snoozing picks the chosen option", () => {
  const id = renderRow({})
  const before = useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)!.date

  act(() => byLabel("Snooze task")!.click())
  const options = ["Later today", "Tomorrow", "This weekend", "Next week"]
  for (const label of options) {
    assert.ok(
      Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === label),
      `menu shows "${label}"`
    )
  }

  const tomorrow = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Tomorrow"
  )!
  act(() => tomorrow.click())

  const after = useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)!.date
  assert.notEqual(after, before, "task was snoozed to a new date")
  assert.ok(
    !Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Later today"),
    "menu closes after choosing"
  )
})

test("url, phone and location render as functional chips", () => {
  renderRow({ url: "example.com/some/very/long/path?with=query", phone: "+1 (555) 010-7788", location: "12 Main St" })

  const links = Array.from(container.querySelectorAll("a"))
  const urlChip = links.find((a) => a.getAttribute("href") === "https://example.com/some/very/long/path?with=query")
  assert.ok(urlChip, "url chip links to the normalized URL")
  assert.equal(urlChip!.textContent!.includes("example.com"), true, "url chip shows compact hostname")
  assert.equal(urlChip!.getAttribute("target"), "_blank")

  const telChip = links.find((a) => a.getAttribute("href") === "tel:+15550107788")
  assert.ok(telChip, "phone chip is a tel: link")

  const mapChip = links.find((a) => a.getAttribute("href")?.startsWith("https://maps.google.com/?q="))
  assert.ok(mapChip, "location chip links to maps")
})

test("attachment chip has a view element that opens preview with a download option", () => {
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
  renderRow({
    attachments: [
      { id: "att-1", name: "receipt.png", type: "image/png", size: 10, dataUrl, createdAt: Date.now() },
    ],
  })

  assert.ok(container.textContent!.includes("receipt.png"), "attachment name is shown")
  act(() => byLabel("View attachment")!.click())

  // Dialog content portals to document.body.
  const img = document.body.querySelector<HTMLImageElement>(`img[src="${dataUrl}"]`)
  assert.ok(img, "preview shows the image")
  const download = Array.from(document.body.querySelectorAll("a")).find(
    (a) => a.getAttribute("download") === "receipt.png"
  )
  assert.ok(download, "download option present")
  assert.equal(download!.getAttribute("href"), dataUrl)
})

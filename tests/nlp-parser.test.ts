import test from "node:test"
import assert from "node:assert/strict"

import { localTaskParser, parseNaturalLanguageTaskEntries } from "../lib/store"

const parse = (input: string) =>
  localTaskParser(input, {
    labels: [{ id: "label-health", name: "health", color: "#84cc16" }],
    referenceDate: new Date("2026-03-24T09:00:00"),
  })

test("extracts label and priority tokens while fast-pathing obvious dates", () => {
  const result = parse("call dentist tomorrow at 3pm #health high priority")

  assert.equal(result.cleanText, "call dentist tomorrow at 3pm")
  assert.equal(result.priority, "urgent")
  assert.deepEqual(result.labelIds, ["label-health"])
  assert.equal(result.scheduledDate, "2026-03-25")
  assert.equal(result.time, undefined)
  assert.equal(result.recurrence, undefined)
})

test("supports shorthand priorities like p1 and p2", () => {
  assert.equal(parse("Ship invoice p1").priority, "urgent")
  assert.equal(parse("Review notes p2").priority, "important")
  assert.equal(parse("Organize desk p3").priority, "normal")
})

test("keeps > subtasks as structural syntax", () => {
  const result = parse("Plan launch p1 > draft brief > send review")

  assert.equal(result.cleanText, "Plan launch")
  assert.deepEqual(result.subtaskTitles, ["draft brief", "send review"])
})

test("marks new labels distinctly in preview metadata", () => {
  const result = parse("Email vendor #ops")

  assert.deepEqual(result.newLabelNames, ["ops"])
  assert.equal(result.previewTokens.at(0)?.label, "#ops (new)")
})

test("keeps noun phrases with and together as a single task", () => {
  const result = parseNaturalLanguageTaskEntries("buy bread and milk tomorrow", {
    labels: [],
    referenceDate: new Date("2026-03-24T09:00:00"),
  })

  assert.equal(result.length, 1)
  assert.equal(result[0]?.cleanText, "buy bread and milk tomorrow")
  assert.equal(result[0]?.scheduledDate, "2026-03-25")
})

test("splits separate actions joined by and into multiple tasks", () => {
  const result = parseNaturalLanguageTaskEntries("call sam on wednesday and run to the gym on friday", {
    labels: [],
    referenceDate: new Date("2026-03-24T09:00:00"),
  })

  assert.equal(result.length, 2)
  assert.equal(result[0]?.scheduledDate, "2026-03-25")
  assert.equal(result[1]?.scheduledDate, "2026-03-27")
})

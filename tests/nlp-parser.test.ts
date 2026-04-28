import test from "node:test"
import assert from "node:assert/strict"

import { localTaskParser, parseNaturalLanguageTaskEntries } from "../lib/store"
import {
  buildHeuristicParsedTask,
  detectFallbackDate,
  extractExplicitSignals,
} from "../lib/task-shortcuts"

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

test("keeps contextual deadline blockers as one urgent task", () => {
  const result = parseNaturalLanguageTaskEntries(
    "tax return — my accountant sent something with 3 attachments and said sign the second one not the first dont touch the third and send back before the 31st but i cant open attachment 2 its a weird file type",
    {
      labels: [],
      referenceDate: new Date("2026-03-24T09:00:00"),
    }
  )

  assert.equal(result.length, 1)
  assert.equal(result[0]?.priority, "urgent")
  assert.match(result[0]?.cleanText ?? "", /tax return/i)
  assert.match(result[0]?.cleanText ?? "", /send back before the 31st/i)
})

test("extracts phone shortcut without eating the date phrase", () => {
  const result = extractExplicitSignals("Call Ricardo call: 212-555-1234 tomorrow")

  assert.equal(result.explicit.phone, "212-555-1234")
  assert.equal(result.inputForModel, "Call Ricardo tomorrow")
})

test("extracts location shortcut while keeping weekday and time context", () => {
  const result = extractExplicitSignals("Lunch at: Nobu Tribeca Thursday at 1pm")

  assert.equal(result.explicit.location, "Nobu Tribeca")
  assert.equal(result.inputForModel, "Lunch Thursday at 1pm")
})

test("supports this/next weekday fallback dates", () => {
  assert.equal(detectFallbackDate("Lunch this thursday", "2026-04-28"), "2026-04-30")
  assert.equal(detectFallbackDate("Lunch next thursday", "2026-04-28"), "2026-05-07")
})

test("builds a heuristic parsed task from explicit shortcut input", () => {
  const extracted = extractExplicitSignals("Lunch at: Nobu Tribeca Thursday at 1pm")
  const result = buildHeuristicParsedTask(
    extracted.inputForModel,
    "2026-04-28",
    extracted.explicit
  )

  assert.equal(result?.title, "Lunch")
  assert.equal(result?.location, "Nobu Tribeca")
  assert.equal(result?.date, "2026-04-30")
  assert.equal(result?.time, "13:00")
})

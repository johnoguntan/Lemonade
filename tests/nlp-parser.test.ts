import test from "node:test"
import assert from "node:assert/strict"

import { localTaskParser, parseNaturalLanguageTaskEntries } from "../lib/store"
import {
  buildHeuristicParsedTask,
  detectFallbackDate,
  detectRecurringPattern,
  extractExplicitSignals,
  resolveParsedRecurringTodoFields,
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

test("marks tasks due today as important", () => {
  const result = parse("Submit Cloud Engineering Lab: Due Today.")

  assert.equal(result.scheduledDate, "2026-03-24")
  assert.equal(result.priority, "important")
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

test("keeps comma-separated tag metadata attached to one task", () => {
  const result = parseNaturalLanguageTaskEntries("Buy New Monitor: Tag: Tech, Budget, Home.", {
    labels: [],
    referenceDate: new Date("2026-03-24T09:00:00"),
  })

  assert.equal(result.length, 1)
  assert.equal(result[0]?.cleanText, "Buy New Monitor")
  assert.deepEqual(result[0]?.newLabelNames, ["Tech", "Budget", "Home"])
})

test("matches explicit tag metadata to existing labels case-insensitively", () => {
  const result = localTaskParser("Buy New Monitor: Tags: Tech, Health.", {
    labels: [{ id: "label-tech", name: "Tech", color: "#2563eb" }],
    referenceDate: new Date("2026-03-24T09:00:00"),
  })

  assert.equal(result.cleanText, "Buy New Monitor")
  assert.deepEqual(result.labelIds, ["label-tech"])
  assert.deepEqual(result.newLabelNames, ["Health"])
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

test("builds an important heuristic task for due today language", () => {
  const result = buildHeuristicParsedTask(
    "Submit Cloud Engineering Lab: Due Today.",
    "2026-05-13",
    {
      phone: null,
      url: null,
      location: null,
      duration: null,
      reminder: null,
      notes: null,
      attachment: null,
    }
  )

  assert.equal(result?.title, "Submit Cloud Engineering Lab")
  assert.equal(result?.date, "2026-05-13")
  assert.equal(result?.priority, "important")
})

test("detects weekly recurrence on a named weekday", () => {
  const recurrence = detectRecurringPattern("Monday Morning Stand-up: Set to repeat every Monday at 9:00 AM.")

  assert.equal(recurrence.recurring, "weekly")
  assert.equal(recurrence.recurringDay, 1)
})

test("builds a recurring weekly task from natural language", () => {
  const result = buildHeuristicParsedTask(
    "Monday Morning Stand-up: Set to repeat every Monday at 9:00 AM.",
    "2026-05-12",
    {
      phone: null,
      url: null,
      location: null,
      duration: null,
      reminder: null,
      notes: null,
      attachment: null,
    }
  )

  assert.equal(result?.title, "Monday Morning Stand-up")
  assert.equal(result?.date, "2026-05-18")
  assert.equal(result?.time, "09:00")
  assert.equal(result?.recurring, "weekly")
  assert.equal(result?.recurringDay, 1)
})

test("builds a recurring monthly task from an ordinal date phrase", () => {
  const result = buildHeuristicParsedTask(
    "Pay Rent: Set to repeat on the 1st of every month.",
    "2026-05-12",
    {
      phone: null,
      url: null,
      location: null,
      duration: null,
      reminder: null,
      notes: null,
      attachment: null,
    }
  )

  assert.equal(result?.title, "Pay Rent")
  assert.equal(result?.date, "2026-06-01")
  assert.equal(result?.recurring, "monthly")
  assert.equal(result?.recurringDay, 1)
})

test("builds a recurring daily task from natural language", () => {
  const result = buildHeuristicParsedTask(
    "Take vitamins daily",
    "2026-05-12",
    {
      phone: null,
      url: null,
      location: null,
      duration: null,
      reminder: null,
      notes: null,
      attachment: null,
    }
  )

  assert.equal(result?.title, "Take vitamins")
  assert.equal(result?.recurring, "daily")
  assert.equal(result?.recurringDay, null)
})

test("treats everyday as a daily recurrence trigger", () => {
  const result = buildHeuristicParsedTask(
    "call john everyday",
    "2026-05-12",
    {
      phone: null,
      url: null,
      location: null,
      duration: null,
      reminder: null,
      notes: null,
      attachment: null,
    }
  )

  assert.equal(result?.title, "call john")
  assert.equal(result?.date, "2026-05-12")
  assert.equal(result?.recurring, "daily")
  assert.equal(result?.recurringDay, null)
})

test("builds a multi-day weekly recurring task from natural language", () => {
  const result = buildHeuristicParsedTask(
    "Water Plants: Set to repeat every Thursday and Sunday.",
    "2026-05-12",
    {
      phone: null,
      url: null,
      location: null,
      duration: null,
      reminder: null,
      notes: null,
      attachment: null,
    }
  )

  assert.equal(result?.title, "Water Plants")
  assert.equal(result?.date, "2026-05-14")
  assert.equal(result?.recurring, "weekly")
  assert.equal(result?.recurringDay, 4)
  assert.deepEqual(result?.recurringDays, [4, 0])

  const storeFields = resolveParsedRecurringTodoFields(result ?? {})
  assert.deepEqual(storeFields.recurringDays, [4, 0])
})

test("maps API recurring fields into store recurring fields", () => {
  const monthly = resolveParsedRecurringTodoFields({
    recurring: "monthly",
    recurringDay: 1,
  })
  assert.equal(monthly.isRecurring, true)
  assert.equal(monthly.recurringFrequency, "monthly")
  assert.equal(monthly.recurringCustomText, "every month on day 1")

  const weekly = resolveParsedRecurringTodoFields({
    recurring: "weekly",
    recurringDay: 1,
  })
  assert.equal(weekly.isRecurring, true)
  assert.equal(weekly.recurringFrequency, "weekly")
  assert.deepEqual(weekly.recurringDays, [1])

  const daily = resolveParsedRecurringTodoFields({
    recurring: "daily",
  })
  assert.equal(daily.isRecurring, true)
  assert.equal(daily.recurringFrequency, "daily")
})

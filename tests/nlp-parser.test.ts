import test from "node:test"
import assert from "node:assert/strict"

import { parseNaturalLanguageTaskInput } from "../lib/store"

const referenceDate = new Date("2026-03-24T09:00:00")

const parse = (input: string) =>
  parseNaturalLanguageTaskInput(input, {
    labels: [],
    referenceDate,
  })

test("does not invent a date when no date is found", () => {
  const result = parse("Plain task with no date")

  assert.equal(result.cleanText, "Plain task with no date")
  assert.equal(result.scheduledDate, undefined)
})

test("parses relative day phrases", () => {
  assert.equal(parse("Meeting in 3 days").scheduledDate, "2026-03-27")
  assert.equal(parse("Call mom day after tomorrow").scheduledDate, "2026-03-26")
  assert.equal(parse("Task tomorrow").scheduledDate, "2026-03-25")
})

test("parses next weekday with rollover", () => {
  const result = parse("Review next Tuesday")

  assert.equal(result.cleanText, "Review")
  assert.equal(result.scheduledDate, "2026-03-31")
})

test("parses time-specific phrases", () => {
  assert.equal(parse("Dinner at 7pm").time, "7pm")
  assert.equal(parse("Breakfast 8:30am").time, "8:30am")
  assert.equal(parse("Lunch at noon").time, "12pm")
  assert.equal(parse("Tonight plan").time, "9pm")
  assert.equal(parse("Read this evening").time, "6pm")
})

test("strips joining prepositions around detected date and time phrases", () => {
  assert.equal(parse("Call John for tomorrow").cleanText, "Call John")
  assert.equal(parse("Submit report by Friday").cleanText, "Submit report")
  assert.equal(parse("Meeting at 5pm").cleanText, "Meeting")
  assert.equal(parse("Plan in 3 days").cleanText, "Plan")
  assert.equal(parse("Meeting from next Tuesday").cleanText, "Meeting")
})

test("does not strip bridge words when no date or time token is found", () => {
  const result = parse("Search for gold")

  assert.equal(result.cleanText, "Search for gold")
  assert.equal(result.scheduledDate, undefined)
})

test("preserves numeric nouns that are not time commands", () => {
  const result = parse("Buy 4 apples")

  assert.equal(result.cleanText, "Buy 4 apples")
  assert.equal(result.time, undefined)
})

test("parses recurring shortcuts", () => {
  const weekday = parse("Exercise every weekday")
  const mixedDays = parse("Class every Mon/Wed/Fri")
  const weekly = parse("Rent weekly")

  assert.deepEqual(weekday.recurrence, {
    isRecurring: true,
    recurringFrequency: "weekday",
    label: "Every Weekday",
  })
  assert.deepEqual(mixedDays.recurrence, {
    isRecurring: true,
    recurringDays: [1, 3, 5],
    label: "Every Mon/Wed/Fri",
  })
  assert.deepEqual(weekly.recurrence, {
    isRecurring: true,
    recurringFrequency: "weekly",
    label: "Weekly",
  })
})

test("cleans title while keeping parsed time and date data together", () => {
  const result = parse("Review next Tuesday at 5pm")

  assert.equal(result.cleanText, "Review")
  assert.equal(result.scheduledDate, "2026-03-31")
  assert.equal(result.time, "5pm")
})

test("parses > separated subtasks", () => {
  const result = parse("Call Marco > confirm venue > send invite")

  assert.equal(result.cleanText, "Call Marco")
  assert.deepEqual(result.subtaskTitles, ["confirm venue", "send invite"])
})

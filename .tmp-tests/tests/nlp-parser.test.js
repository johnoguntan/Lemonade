"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const store_1 = require("../lib/store");
const task_shortcuts_1 = require("../lib/task-shortcuts");
const parse = (input) => (0, store_1.localTaskParser)(input, {
    labels: [{ id: "label-health", name: "health", color: "#84cc16" }],
    referenceDate: new Date("2026-03-24T09:00:00"),
});
(0, node_test_1.default)("extracts label and priority tokens while fast-pathing obvious dates", () => {
    const result = parse("call dentist tomorrow at 3pm #health high priority");
    strict_1.default.equal(result.cleanText, "call dentist tomorrow at 3pm");
    strict_1.default.equal(result.priority, "urgent");
    strict_1.default.deepEqual(result.labelIds, ["label-health"]);
    strict_1.default.equal(result.scheduledDate, "2026-03-25");
    strict_1.default.equal(result.time, undefined);
    strict_1.default.equal(result.recurrence, undefined);
});
(0, node_test_1.default)("supports shorthand priorities like p1 and p2", () => {
    strict_1.default.equal(parse("Ship invoice p1").priority, "urgent");
    strict_1.default.equal(parse("Review notes p2").priority, "important");
    strict_1.default.equal(parse("Organize desk p3").priority, "normal");
});
(0, node_test_1.default)("marks tasks due today as important", () => {
    const result = parse("Submit Cloud Engineering Lab: Due Today.");
    strict_1.default.equal(result.scheduledDate, "2026-03-24");
    strict_1.default.equal(result.priority, "important");
});
(0, node_test_1.default)("keeps > subtasks as structural syntax", () => {
    const result = parse("Plan launch p1 > draft brief > send review");
    strict_1.default.equal(result.cleanText, "Plan launch");
    strict_1.default.deepEqual(result.subtaskTitles, ["draft brief", "send review"]);
});
(0, node_test_1.default)("marks new labels distinctly in preview metadata", () => {
    const result = parse("Email vendor #ops");
    strict_1.default.deepEqual(result.newLabelNames, ["ops"]);
    strict_1.default.equal(result.previewTokens.at(0)?.label, "#ops (new)");
});
(0, node_test_1.default)("keeps comma-separated tag metadata attached to one task", () => {
    const result = (0, store_1.parseNaturalLanguageTaskEntries)("Buy New Monitor: Tag: Tech, Budget, Home.", {
        labels: [],
        referenceDate: new Date("2026-03-24T09:00:00"),
    });
    strict_1.default.equal(result.length, 1);
    strict_1.default.equal(result[0]?.cleanText, "Buy New Monitor");
    strict_1.default.deepEqual(result[0]?.newLabelNames, ["Tech", "Budget", "Home"]);
});
(0, node_test_1.default)("matches explicit tag metadata to existing labels case-insensitively", () => {
    const result = (0, store_1.localTaskParser)("Buy New Monitor: Tags: Tech, Health.", {
        labels: [{ id: "label-tech", name: "Tech", color: "#2563eb" }],
        referenceDate: new Date("2026-03-24T09:00:00"),
    });
    strict_1.default.equal(result.cleanText, "Buy New Monitor");
    strict_1.default.deepEqual(result.labelIds, ["label-tech"]);
    strict_1.default.deepEqual(result.newLabelNames, ["Health"]);
});
(0, node_test_1.default)("keeps noun phrases with and together as a single task", () => {
    const result = (0, store_1.parseNaturalLanguageTaskEntries)("buy bread and milk tomorrow", {
        labels: [],
        referenceDate: new Date("2026-03-24T09:00:00"),
    });
    strict_1.default.equal(result.length, 1);
    strict_1.default.equal(result[0]?.cleanText, "buy bread and milk tomorrow");
    strict_1.default.equal(result[0]?.scheduledDate, "2026-03-25");
});
(0, node_test_1.default)("splits separate actions joined by and into multiple tasks", () => {
    const result = (0, store_1.parseNaturalLanguageTaskEntries)("call sam on wednesday and run to the gym on friday", {
        labels: [],
        referenceDate: new Date("2026-03-24T09:00:00"),
    });
    strict_1.default.equal(result.length, 2);
    strict_1.default.equal(result[0]?.scheduledDate, "2026-03-25");
    strict_1.default.equal(result[1]?.scheduledDate, "2026-03-27");
});
(0, node_test_1.default)("keeps contextual deadline blockers as one urgent task", () => {
    const result = (0, store_1.parseNaturalLanguageTaskEntries)("tax return — my accountant sent something with 3 attachments and said sign the second one not the first dont touch the third and send back before the 31st but i cant open attachment 2 its a weird file type", {
        labels: [],
        referenceDate: new Date("2026-03-24T09:00:00"),
    });
    strict_1.default.equal(result.length, 1);
    strict_1.default.equal(result[0]?.priority, "urgent");
    strict_1.default.match(result[0]?.cleanText ?? "", /tax return/i);
    strict_1.default.match(result[0]?.cleanText ?? "", /send back before the 31st/i);
});
(0, node_test_1.default)("extracts phone shortcut without eating the date phrase", () => {
    const result = (0, task_shortcuts_1.extractExplicitSignals)("Call Ricardo call: 212-555-1234 tomorrow");
    strict_1.default.equal(result.explicit.phone, "212-555-1234");
    strict_1.default.equal(result.inputForModel, "Call Ricardo tomorrow");
});
(0, node_test_1.default)("extracts location shortcut while keeping weekday and time context", () => {
    const result = (0, task_shortcuts_1.extractExplicitSignals)("Lunch at: Nobu Tribeca Thursday at 1pm");
    strict_1.default.equal(result.explicit.location, "Nobu Tribeca");
    strict_1.default.equal(result.inputForModel, "Lunch Thursday at 1pm");
});
(0, node_test_1.default)("keeps plain for month phrases as date context, not duration notes", () => {
    const result = (0, task_shortcuts_1.extractExplicitSignals)("buy Busch gardens tix for June");
    strict_1.default.equal(result.explicit.duration, null);
    strict_1.default.equal(result.explicit.notes, null);
    strict_1.default.equal(result.inputForModel, "buy Busch gardens tix for June");
});
(0, node_test_1.default)("supports this/next weekday fallback dates", () => {
    strict_1.default.equal((0, task_shortcuts_1.detectFallbackDate)("Lunch this thursday", "2026-04-28"), "2026-04-30");
    strict_1.default.equal((0, task_shortcuts_1.detectFallbackDate)("Lunch next thursday", "2026-04-28"), "2026-05-07");
});
(0, node_test_1.default)("builds a heuristic parsed task from explicit shortcut input", () => {
    const extracted = (0, task_shortcuts_1.extractExplicitSignals)("Lunch at: Nobu Tribeca Thursday at 1pm");
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)(extracted.inputForModel, "2026-04-28", extracted.explicit);
    strict_1.default.equal(result?.title, "Lunch");
    strict_1.default.equal(result?.location, "Nobu Tribeca");
    strict_1.default.equal(result?.date, "2026-04-30");
    strict_1.default.equal(result?.time, "13:00");
});
(0, node_test_1.default)("builds an important heuristic task for due today language", () => {
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)("Submit Cloud Engineering Lab: Due Today.", "2026-05-13", {
        phone: null,
        url: null,
        location: null,
        duration: null,
        reminder: null,
        notes: null,
        attachment: null,
    });
    strict_1.default.equal(result?.title, "Submit Cloud Engineering Lab");
    strict_1.default.equal(result?.date, "2026-05-13");
    strict_1.default.equal(result?.priority, "important");
});
(0, node_test_1.default)("detects weekly recurrence on a named weekday", () => {
    const recurrence = (0, task_shortcuts_1.detectRecurringPattern)("Monday Morning Stand-up: Set to repeat every Monday at 9:00 AM.");
    strict_1.default.equal(recurrence.recurring, "weekly");
    strict_1.default.equal(recurrence.recurringDay, 1);
});
(0, node_test_1.default)("builds a recurring weekly task from natural language", () => {
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)("Monday Morning Stand-up: Set to repeat every Monday at 9:00 AM.", "2026-05-12", {
        phone: null,
        url: null,
        location: null,
        duration: null,
        reminder: null,
        notes: null,
        attachment: null,
    });
    strict_1.default.equal(result?.title, "Monday Morning Stand-up");
    strict_1.default.equal(result?.date, "2026-05-18");
    strict_1.default.equal(result?.time, "09:00");
    strict_1.default.equal(result?.recurring, "weekly");
    strict_1.default.equal(result?.recurringDay, 1);
});
(0, node_test_1.default)("builds a recurring monthly task from an ordinal date phrase", () => {
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)("Pay Rent: Set to repeat on the 1st of every month.", "2026-05-12", {
        phone: null,
        url: null,
        location: null,
        duration: null,
        reminder: null,
        notes: null,
        attachment: null,
    });
    strict_1.default.equal(result?.title, "Pay Rent");
    strict_1.default.equal(result?.date, "2026-06-01");
    strict_1.default.equal(result?.recurring, "monthly");
    strict_1.default.equal(result?.recurringDay, 1);
});
(0, node_test_1.default)("builds a recurring daily task from natural language", () => {
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)("Take vitamins daily", "2026-05-12", {
        phone: null,
        url: null,
        location: null,
        duration: null,
        reminder: null,
        notes: null,
        attachment: null,
    });
    strict_1.default.equal(result?.title, "Take vitamins");
    strict_1.default.equal(result?.recurring, "daily");
    strict_1.default.equal(result?.recurringDay, null);
});
(0, node_test_1.default)("treats everyday as a daily recurrence trigger", () => {
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)("call john everyday", "2026-05-12", {
        phone: null,
        url: null,
        location: null,
        duration: null,
        reminder: null,
        notes: null,
        attachment: null,
    });
    strict_1.default.equal(result?.title, "call john");
    strict_1.default.equal(result?.date, "2026-05-12");
    strict_1.default.equal(result?.recurring, "daily");
    strict_1.default.equal(result?.recurringDay, null);
});
(0, node_test_1.default)("builds a multi-day weekly recurring task from natural language", () => {
    const result = (0, task_shortcuts_1.buildHeuristicParsedTask)("Water Plants: Set to repeat every Thursday and Sunday.", "2026-05-12", {
        phone: null,
        url: null,
        location: null,
        duration: null,
        reminder: null,
        notes: null,
        attachment: null,
    });
    strict_1.default.equal(result?.title, "Water Plants");
    strict_1.default.equal(result?.date, "2026-05-14");
    strict_1.default.equal(result?.recurring, "weekly");
    strict_1.default.equal(result?.recurringDay, 4);
    strict_1.default.deepEqual(result?.recurringDays, [4, 0]);
    const storeFields = (0, task_shortcuts_1.resolveParsedRecurringTodoFields)(result ?? {});
    strict_1.default.deepEqual(storeFields.recurringDays, [4, 0]);
});
(0, node_test_1.default)("maps API recurring fields into store recurring fields", () => {
    const monthly = (0, task_shortcuts_1.resolveParsedRecurringTodoFields)({
        recurring: "monthly",
        recurringDay: 1,
    });
    strict_1.default.equal(monthly.isRecurring, true);
    strict_1.default.equal(monthly.recurringFrequency, "monthly");
    strict_1.default.equal(monthly.recurringCustomText, "every month on day 1");
    const weekly = (0, task_shortcuts_1.resolveParsedRecurringTodoFields)({
        recurring: "weekly",
        recurringDay: 1,
    });
    strict_1.default.equal(weekly.isRecurring, true);
    strict_1.default.equal(weekly.recurringFrequency, "weekly");
    strict_1.default.deepEqual(weekly.recurringDays, [1]);
    const daily = (0, task_shortcuts_1.resolveParsedRecurringTodoFields)({
        recurring: "daily",
    });
    strict_1.default.equal(daily.isRecurring, true);
    strict_1.default.equal(daily.recurringFrequency, "daily");
});

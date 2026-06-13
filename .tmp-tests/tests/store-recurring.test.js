"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importStar(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const date_fns_1 = require("date-fns");
const store_1 = require("../lib/store");
const resetRecurringTestState = () => {
    store_1.useLemonadeStore.setState({
        calendarTodos: [],
        lastCreatedTodoId: null,
        searchQuery: "",
        labelFilterIds: [],
        activeFilterColor: null,
    });
};
(0, node_test_1.beforeEach)(() => {
    resetRecurringTestState();
});
(0, node_test_1.default)("daily recurring tasks generate a long future window without duplicates", () => {
    const today = new Date();
    const todayKey = (0, store_1.formatLocalDateKey)(today);
    const parentId = store_1.useLemonadeStore.getState().addCalendarTodo({
        text: "Daily test",
        completed: false,
        date: todayKey,
        labelIds: [],
        isRecurring: true,
        recurringFrequency: "daily",
    });
    let state = store_1.useLemonadeStore.getState();
    const initialChildren = state.calendarTodos.filter((todo) => todo.parentId === parentId);
    const uniqueDates = new Set(initialChildren.map((todo) => todo.date));
    // Matches RECURRING_GENERATION_DAYS in lib/store.ts.
    const WINDOW = 180;
    strict_1.default.equal(initialChildren.length, WINDOW);
    strict_1.default.equal(uniqueDates.size, WINDOW);
    strict_1.default.ok(initialChildren.every((todo) => todo.text === "Daily test"));
    strict_1.default.ok(initialChildren.every((todo) => todo.completed === false));
    strict_1.default.ok(initialChildren.every((todo) => todo.isRecurring === true));
    state.generateRecurringInstances();
    state = store_1.useLemonadeStore.getState();
    const regeneratedChildren = state.calendarTodos.filter((todo) => todo.parentId === parentId);
    strict_1.default.equal(regeneratedChildren.length, WINDOW);
});
(0, node_test_1.default)("monthly recurring tasks roll over month-end correctly", () => {
    const parentDate = (0, date_fns_1.endOfMonth)(new Date());
    const parentId = store_1.useLemonadeStore.getState().addCalendarTodo({
        text: "Month end",
        completed: false,
        date: (0, store_1.formatLocalDateKey)(parentDate),
        labelIds: [],
        isRecurring: true,
        recurringFrequency: "monthly",
    });
    const state = store_1.useLemonadeStore.getState();
    const childDates = state.calendarTodos
        .filter((todo) => todo.parentId === parentId)
        .map((todo) => todo.date);
    strict_1.default.ok(childDates.includes((0, store_1.formatLocalDateKey)((0, date_fns_1.addMonths)(parentDate, 1))));
    strict_1.default.ok(childDates.includes((0, store_1.formatLocalDateKey)((0, date_fns_1.addMonths)(parentDate, 2))));
});
(0, node_test_1.default)("updating a recurring parent clears old incomplete children but keeps completed ones", () => {
    const today = new Date();
    const tomorrowKey = (0, store_1.formatLocalDateKey)((0, date_fns_1.addDays)(today, 1));
    const dayAfterTomorrowKey = (0, store_1.formatLocalDateKey)((0, date_fns_1.addDays)(today, 2));
    const nextMonthKey = (0, store_1.formatLocalDateKey)((0, date_fns_1.addMonths)(today, 1));
    const parentId = store_1.useLemonadeStore.getState().addCalendarTodo({
        text: "Recurring cleanup",
        completed: false,
        date: (0, store_1.formatLocalDateKey)(today),
        labelIds: [],
        isRecurring: true,
        recurringFrequency: "daily",
    });
    const tomorrowChild = store_1.useLemonadeStore
        .getState()
        .calendarTodos.find((todo) => todo.parentId === parentId && todo.date === tomorrowKey);
    const dayAfterTomorrowChild = store_1.useLemonadeStore
        .getState()
        .calendarTodos.find((todo) => todo.parentId === parentId && todo.date === dayAfterTomorrowKey);
    strict_1.default.ok(tomorrowChild);
    strict_1.default.ok(dayAfterTomorrowChild);
    store_1.useLemonadeStore.getState().toggleCalendarTodo(dayAfterTomorrowChild.id);
    store_1.useLemonadeStore.getState().updateCalendarTodo(parentId, {
        recurringFrequency: "monthly",
    });
    const state = store_1.useLemonadeStore.getState();
    const remainingTomorrowChild = state.calendarTodos.find((todo) => todo.id === tomorrowChild.id);
    const remainingCompletedChild = state.calendarTodos.find((todo) => todo.id === dayAfterTomorrowChild.id);
    const nextMonthChild = state.calendarTodos.find((todo) => todo.parentId === parentId && todo.date === nextMonthKey);
    strict_1.default.equal(remainingTomorrowChild, undefined);
    strict_1.default.ok(remainingCompletedChild);
    strict_1.default.equal(remainingCompletedChild?.completed, true);
    strict_1.default.ok(nextMonthChild);
});
(0, node_test_1.default)("updating an optimistic task into a future monthly recurring task generates later months", () => {
    const baseDate = new Date();
    const parentId = store_1.useLemonadeStore.getState().addCalendarTodo({
        text: "Pay Rent",
        completed: false,
        date: (0, store_1.formatLocalDateKey)(baseDate),
        labelIds: [],
    });
    const nextMonth = (0, date_fns_1.addMonths)(baseDate, 1);
    const firstOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    const secondOccurrence = (0, date_fns_1.addMonths)(firstOfNextMonth, 1);
    store_1.useLemonadeStore.getState().updateCalendarTodo(parentId, {
        date: (0, store_1.formatLocalDateKey)(firstOfNextMonth),
        isRecurring: true,
        recurringFrequency: "monthly",
    });
    const state = store_1.useLemonadeStore.getState();
    const childDates = state.calendarTodos
        .filter((todo) => todo.parentId === parentId)
        .map((todo) => todo.date);
    strict_1.default.ok(childDates.includes((0, store_1.formatLocalDateKey)(secondOccurrence)));
});
(0, node_test_1.default)("weekly recurring tasks can generate on multiple selected weekdays", () => {
    // Use dates relative to "now" so the test doesn't rot: generation only emits
    // instances on/after today, so hardcoded past dates would always fail.
    const parentDate = new Date();
    parentDate.setHours(12, 0, 0, 0);
    // Two distinct weekdays that are not today (offset start is 1, so today is
    // never generated anyway).
    const dayA = (parentDate.getDay() + 2) % 7;
    const dayB = (parentDate.getDay() + 4) % 7;
    const parentId = store_1.useLemonadeStore.getState().addCalendarTodo({
        text: "Water Plants",
        completed: false,
        date: (0, store_1.formatLocalDateKey)(parentDate),
        labelIds: [],
        isRecurring: true,
        recurringFrequency: "weekly",
        recurringDays: [dayA, dayB],
    });
    const nextOccurrence = (weekday) => {
        for (let offset = 1; offset <= 14; offset += 1) {
            const candidate = (0, date_fns_1.addDays)(parentDate, offset);
            if (candidate.getDay() === weekday)
                return (0, store_1.formatLocalDateKey)(candidate);
        }
        throw new Error(`no upcoming occurrence found for weekday ${weekday}`);
    };
    const state = store_1.useLemonadeStore.getState();
    const childDates = state.calendarTodos
        .filter((todo) => todo.parentId === parentId)
        .map((todo) => todo.date);
    strict_1.default.ok(childDates.includes(nextOccurrence(dayA)));
    strict_1.default.ok(childDates.includes(nextOccurrence(dayB)));
});

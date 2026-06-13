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
const store_1 = require("../lib/store");
const reset = () => {
    store_1.useLemonadeStore.setState({
        calendarTodos: [],
        selectedTaskIds: [],
        collapsedSubtasks: {},
        lastCreatedTodoId: null,
        searchQuery: "",
        labelFilterIds: [],
        activeFilterColor: null,
        taskHistoryPast: [],
        taskHistoryFuture: [],
    });
};
(0, node_test_1.beforeEach)(reset);
const addTodo = (text) => store_1.useLemonadeStore.getState().addCalendarTodo({ text, completed: false, date: "2026-06-05", labelIds: [] });
(0, node_test_1.default)("splitCalendarTodo replaces one task with several", () => {
    const id = addTodo("Buy milk, eggs, bread");
    store_1.useLemonadeStore.getState().splitCalendarTodo(id, ["Buy milk", "Buy eggs", "Buy bread"]);
    const texts = store_1.useLemonadeStore.getState().calendarTodos.map((todo) => todo.text);
    strict_1.default.ok(!texts.includes("Buy milk, eggs, bread"));
    strict_1.default.ok(texts.includes("Buy milk"));
    strict_1.default.ok(texts.includes("Buy eggs"));
    strict_1.default.ok(texts.includes("Buy bread"));
});
(0, node_test_1.default)("mergeSelectedTasks combines selected tasks into one", () => {
    const a = addTodo("Task A");
    const b = addTodo("Task B");
    store_1.useLemonadeStore.getState().toggleTaskSelection(a);
    store_1.useLemonadeStore.getState().toggleTaskSelection(b);
    store_1.useLemonadeStore.getState().mergeSelectedTasks("Merged task");
    const texts = store_1.useLemonadeStore.getState().calendarTodos.map((todo) => todo.text);
    strict_1.default.ok(texts.includes("Merged task"));
    strict_1.default.ok(!texts.includes("Task A"));
    strict_1.default.ok(!texts.includes("Task B"));
    strict_1.default.equal(store_1.useLemonadeStore.getState().selectedTaskIds.length, 0);
});
(0, node_test_1.default)("mergeSelectedTasks needs at least two tasks", () => {
    const a = addTodo("Only one");
    store_1.useLemonadeStore.getState().toggleTaskSelection(a);
    store_1.useLemonadeStore.getState().mergeSelectedTasks("Should not merge");
    const texts = store_1.useLemonadeStore.getState().calendarTodos.map((todo) => todo.text);
    strict_1.default.ok(texts.includes("Only one"));
    strict_1.default.ok(!texts.includes("Should not merge"));
});
(0, node_test_1.default)("promoteSubtaskToTask turns a subtask into a top-level task", () => {
    const id = store_1.useLemonadeStore.getState().addCalendarTodo({
        text: "Parent",
        completed: false,
        date: "2026-06-05",
        labelIds: [],
        subtasks: [{ title: "Child task", completed: false }],
    });
    const parent = store_1.useLemonadeStore.getState().calendarTodos.find((todo) => todo.id === id);
    if (!parent)
        throw new Error("parent not found");
    const subtaskId = parent.subtasks[0]?.id;
    if (!subtaskId)
        throw new Error("subtask not found");
    store_1.useLemonadeStore.getState().promoteSubtaskToTask(id, subtaskId);
    const todos = store_1.useLemonadeStore.getState().calendarTodos;
    const promoted = todos.find((todo) => todo.text === "Child task");
    strict_1.default.ok(promoted, "promoted task should exist");
    strict_1.default.equal(promoted?.parentId, undefined);
    const updatedParent = todos.find((todo) => todo.id === id);
    strict_1.default.equal(updatedParent?.subtasks.length, 0);
});

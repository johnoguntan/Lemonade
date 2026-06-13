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
Object.defineProperty(exports, "__esModule", { value: true });
// Regression tests: the task edit form has no Save button — Enter saves from
// anywhere in the form (even when focus escaped to <body> via a picker), and
// Escape cancels.
require("./helpers/register-test-env");
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const React = __importStar(require("react"));
const react_1 = require("react");
const client_1 = require("react-dom/client");
const TaskRow_1 = require("@/components/daily/TaskRow");
const store_1 = require("@/lib/store");
let container;
let root;
(0, node_test_1.beforeEach)(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = (0, client_1.createRoot)(container);
});
(0, node_test_1.afterEach)(() => {
    (0, react_1.act)(() => root.unmount());
    container.remove();
});
const setInputValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    (0, react_1.act)(() => {
        setter.call(input, value);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
};
const pressKey = (target, key) => {
    (0, react_1.act)(() => {
        target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
/** Create a fresh todo in the store and render its TaskRow in edit mode. */
const renderEditingRow = (text) => {
    const id = store_1.useLemonadeStore.getState().addCalendarTodo({ text, completed: false, date: null });
    const todo = store_1.useLemonadeStore.getState().calendarTodos.find((t) => t.id === id);
    (0, react_1.act)(() => {
        root.render(React.createElement(TaskRow_1.TaskRow, { todo }));
    });
    // Enter edit mode via double-click on the title.
    const title = Array.from(container.querySelectorAll("p")).find((p) => p.textContent === text);
    (0, react_1.act)(() => {
        title.dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    });
    const input = container.querySelector("input");
    assert.equal(input.value, text, "edit form should open with the title input");
    return { id, input };
};
const todoText = (id) => store_1.useLemonadeStore.getState().calendarTodos.find((t) => t.id === id)?.text;
(0, node_test_1.test)("TaskRow edit: the Save button is gone", () => {
    renderEditingRow("Check no save button");
    const saveButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Save");
    assert.equal(saveButton, undefined);
});
(0, node_test_1.test)("TaskRow edit: Enter in the title input saves and closes the form", async () => {
    const { id, input } = renderEditingRow("Old title");
    setInputValue(input, "New title");
    pressKey(input, "Enter");
    // The input is committed via blur + deferred save.
    await (0, react_1.act)(tick);
    assert.equal(todoText(id), "New title");
    assert.equal(container.querySelector("input"), null, "edit form should close");
});
(0, node_test_1.test)("TaskRow edit: Enter saves while a picker is open and focus is on <body>", async () => {
    const { id, input } = renderEditingRow("Call john");
    setInputValue(input, "Call john updated");
    // Open the time wheel (the date picker now opens on field focus and closes
    // on blur, so the wheel is the picker that can be open with focus on <body>).
    (0, react_1.act)(() => container.querySelector('button[aria-label="Open time picker"]').click());
    (0, react_1.act)(() => {
        ;
        document.activeElement?.blur?.();
    });
    assert.equal(document.activeElement, document.body);
    pressKey(document.body, "Enter");
    await (0, react_1.act)(tick);
    assert.equal(todoText(id), "Call john updated");
    assert.equal(container.querySelector("input"), null, "edit form should close");
});
(0, node_test_1.test)("TaskRow edit: time wheel closes when clicking anywhere else", () => {
    renderEditingRow("Pick a time");
    (0, react_1.act)(() => container.querySelector('button[aria-label="Open time picker"]').click());
    assert.ok(container.querySelector("[data-time-picker]"), "time wheel is open");
    // Click INSIDE the wheel — stays open.
    (0, react_1.act)(() => {
        container.querySelector("[data-time-picker]").dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    });
    assert.ok(container.querySelector("[data-time-picker]"), "wheel stays open for clicks inside it");
    // Click anywhere else — closes.
    (0, react_1.act)(() => {
        document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    });
    assert.equal(container.querySelector("[data-time-picker]"), null, "wheel closes on outside click");
});
(0, node_test_1.test)("TaskRow edit: Escape cancels without saving", () => {
    const { id, input } = renderEditingRow("Keep me");
    setInputValue(input, "Discard me");
    pressKey(input, "Escape");
    assert.equal(todoText(id), "Keep me");
    assert.equal(container.querySelector("input"), null, "edit form should close");
});
(0, node_test_1.test)("TaskRow edit: Enter in the add-subtask input adds a subtask, does not close the form", () => {
    const { id } = renderEditingRow("Task with subtasks");
    const subtaskInput = container.querySelector('input[placeholder="+ Add subtask…"]');
    setInputValue(subtaskInput, "First subtask");
    pressKey(subtaskInput, "Enter");
    const todo = store_1.useLemonadeStore.getState().calendarTodos.find((t) => t.id === id);
    assert.equal(todo.subtasks?.length, 1);
    assert.equal(todo.subtasks?.[0].title, "First subtask");
    assert.notEqual(container.querySelector("input"), null, "edit form should stay open");
});

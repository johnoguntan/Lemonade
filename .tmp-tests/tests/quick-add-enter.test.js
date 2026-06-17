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
// Regression tests: Enter must add the task no matter what dropdown is open,
// even when focus has escaped the quick-add container (e.g. the user clicked a
// non-focusable spot inside a dropdown and focus jumped to <body>).
require("./helpers/register-test-env");
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const React = __importStar(require("react"));
const react_1 = require("react");
const client_1 = require("react-dom/client");
const SectionLines_1 = require("@/components/daily/SectionLines");
const QuickInputBar_1 = require("@/components/task-creation/QuickInputBar");
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
// ── helpers ──────────────────────────────────────────────────────────────────
const setInputValue = (input, value) => {
    // Go through the native setter so React's onChange sees the update.
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
const click = (el) => (0, react_1.act)(() => el.click());
const byLabel = (label) => container.querySelector(`button[aria-label="${label}"]`);
// ── SectionLines (inline section quick-add rows) ─────────────────────────────
const renderSectionRow = (onAdd) => {
    (0, react_1.act)(() => {
        root.render(React.createElement(SectionLines_1.SectionLines, {
            count: 1,
            onAdd,
            placeholder: "Add a task…",
        }));
    });
    // Activate the row.
    click(byLabel("Add a task"));
    return container.querySelector('input[placeholder="Add a task…"]');
};
(0, node_test_1.test)("SectionLines: Enter on the input adds the task", () => {
    const added = [];
    const input = renderSectionRow((text) => added.push(text));
    setInputValue(input, "Buy milk");
    pressKey(input, "Enter");
    assert.deepEqual(added, ["Buy milk"]);
});
(0, node_test_1.test)("SectionLines: Enter adds the task while a dropdown is open and focus is on <body>", () => {
    const added = [];
    const input = renderSectionRow((text) => added.push(text));
    setInputValue(input, "Call Sam");
    // Open the Priority dropdown (icon row appears once the input has focus).
    (0, react_1.act)(() => input.focus());
    click(byLabel("Priority"));
    assert.ok(container.textContent.includes("Priority"), "priority dropdown should be open");
    // Simulate clicking a non-focusable spot inside the dropdown: focus escapes
    // the container to <body>. This is the exact case that used to swallow Enter.
    (0, react_1.act)(() => input.blur());
    assert.equal(document.activeElement, document.body);
    pressKey(document.body, "Enter");
    assert.deepEqual(added, ["Call Sam"]);
});
(0, node_test_1.test)("SectionLines: Escape on <body> with a dropdown open cancels the row", () => {
    let cancelled = false;
    (0, react_1.act)(() => {
        root.render(React.createElement(SectionLines_1.SectionLines, {
            count: 1,
            onAdd: () => { },
            placeholder: "Add a task…",
        }));
    });
    click(byLabel("Add a task"));
    const input = container.querySelector('input[placeholder="Add a task…"]');
    (0, react_1.act)(() => input.focus());
    click(byLabel("Priority"));
    (0, react_1.act)(() => input.blur());
    // Row unmounts on cancel (empty text → onCancel), so watch the DOM.
    pressKey(document.body, "Escape");
    cancelled = container.querySelector('input[placeholder="Add a task…"]') === null;
    assert.ok(cancelled, "row should close on Escape");
});
(0, node_test_1.test)("SectionLines: Enter in an unrelated input elsewhere is NOT hijacked", () => {
    const added = [];
    const input = renderSectionRow((text) => added.push(text));
    setInputValue(input, "Should not submit");
    (0, react_1.act)(() => input.focus());
    click(byLabel("Priority"));
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    (0, react_1.act)(() => outside.focus());
    pressKey(outside, "Enter");
    assert.deepEqual(added, [], "typing Enter in an unrelated field must not add the task");
    outside.remove();
});
// ── QuickInputBar (top-level "Add New Task" bar, store-backed) ───────────────
(0, node_test_1.test)("QuickInputBar: Enter adds the task while a dropdown is open and focus is on <body>", () => {
    (0, react_1.act)(() => {
        root.render(React.createElement(QuickInputBar_1.QuickInputBar));
    });
    const input = container.querySelector('input[data-quick-task-input="true"]');
    const before = store_1.useLemonadeStore.getState().calendarTodos.length;
    (0, react_1.act)(() => input.focus());
    setInputValue(input, "Quick task via global enter");
    click(byLabel("Priority"));
    (0, react_1.act)(() => input.blur());
    assert.equal(document.activeElement, document.body);
    pressKey(document.body, "Enter");
    const todos = store_1.useLemonadeStore.getState().calendarTodos;
    assert.equal(todos.length, before + 1);
    assert.equal(todos[todos.length - 1].text, "Quick task via global enter");
});

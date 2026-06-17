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
// Tests for quick-add interaction rules:
//   • + toggles the options row only — it never submits
//   • hover-opened dropdowns persist after the cursor leaves; outside click closes
//   • time sub-picker closes when another element in the panel is clicked
//   • the draft resets to defaults (today) after a task is added
//   • task chips: url/phone/location are clickable; attachment has preview + download
//   • snooze icon opens an options menu instead of instantly snoozing
require("./helpers/register-test-env");
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const React = __importStar(require("react"));
const react_1 = require("react");
const client_1 = require("react-dom/client");
const QuickInputBar_1 = require("@/components/task-creation/QuickInputBar");
const CalendarDropdown_1 = require("@/components/task-creation/CalendarDropdown");
const AttachmentDropdown_1 = require("@/components/task-creation/AttachmentDropdown");
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
const mouse = (el, type) => {
    (0, react_1.act)(() => {
        el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
    });
};
// React implements onMouseEnter/onMouseLeave on top of mouseover/mouseout
// with relatedTarget — raw "mouseenter" dispatches don't reach it.
const hoverEnter = (el) => {
    (0, react_1.act)(() => {
        el.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true, cancelable: true, relatedTarget: document.body }));
    });
};
const hoverLeave = (el) => {
    (0, react_1.act)(() => {
        el.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true, cancelable: true, relatedTarget: document.body }));
    });
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
const byLabel = (label) => container.querySelector(`button[aria-label="${label}"]`);
// ── QuickInputBar interaction rules ──────────────────────────────────────────
const renderBar = () => {
    (0, react_1.act)(() => {
        root.render(React.createElement(QuickInputBar_1.QuickInputBar));
    });
    return container.querySelector('input[data-quick-task-input="true"]');
};
(0, node_test_1.test)("+ never submits — it only toggles the options row", () => {
    const input = renderBar();
    const before = store_1.useLemonadeStore.getState().calendarTodos.length;
    setInputValue(input, "Should not be added by plus");
    (0, react_1.act)(() => input.focus()); // focus shows the icon row
    const plus = byLabel("Show task options");
    (0, react_1.act)(() => plus.click());
    assert.equal(store_1.useLemonadeStore.getState().calendarTodos.length, before, "plus must not add a task");
    assert.equal(input.value, "Should not be added by plus", "draft text stays");
});
(0, node_test_1.test)("hover-opened dropdown stays open after the cursor leaves; outside click closes it", () => {
    const input = renderBar();
    (0, react_1.act)(() => input.focus());
    const priorityBtn = byLabel("Priority");
    hoverEnter(priorityBtn);
    assert.ok(container.textContent.includes("URGENT"), "priority dropdown opens on hover");
    // Cursor leaves the icon AND the panel — dropdown must stay.
    hoverLeave(priorityBtn);
    assert.ok(container.textContent.includes("URGENT"), "dropdown persists after hover leaves");
    // Click somewhere else on the page — dropdown closes.
    (0, react_1.act)(() => {
        document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
    });
    assert.ok(!container.textContent.includes("URGENT"), "dropdown closes on outside click");
});
(0, node_test_1.test)("draft resets to default (today) after a task is added", async () => {
    const input = renderBar();
    (0, react_1.act)(() => input.focus());
    // Plain title (no date words) so the NLP parser is skipped and the add is sync.
    setInputValue(input, "Buy stamps");
    // Open the calendar dropdown and pick Tomorrow.
    (0, react_1.act)(() => byLabel("Schedule").click());
    const tomorrowBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Tomorrow");
    (0, react_1.act)(() => tomorrowBtn.click());
    pressKey(input, "Enter");
    await (0, react_1.act)(tick);
    const todos = store_1.useLemonadeStore.getState().calendarTodos;
    const added = todos[todos.length - 1];
    assert.equal(added.text, "Buy stamps");
    // Re-open the calendar dropdown: schedule input is back to its default
    // (empty = today), not stuck on the previously picked date.
    (0, react_1.act)(() => input.focus());
    (0, react_1.act)(() => byLabel("Schedule").click());
    const scheduleInput = container.querySelector('input[placeholder="e.g. 2/10/2026 or 4th of July"]');
    assert.equal(scheduleInput.value, "", "schedule date resets after adding");
    assert.equal(input.value, "", "title resets after adding");
});
(0, node_test_1.test)("Enter inside the Repeat picker adds the task WITH the chosen repeat", async () => {
    const input = renderBar();
    (0, react_1.act)(() => input.focus());
    setInputValue(input, "Water the plants");
    // Open calendar dropdown → open the Repeat picker (its toggle reads "Never").
    (0, react_1.act)(() => byLabel("Schedule").click());
    const repeatToggle = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim().startsWith("Never"));
    (0, react_1.act)(() => repeatToggle.click());
    // Pick Weekly + Wednesday — selections commit to the draft immediately.
    const weekly = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Weekly" || b.textContent?.trim() === "Weekly✓");
    (0, react_1.act)(() => weekly.click());
    const wednesday = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "W")[0];
    (0, react_1.act)(() => wednesday.click());
    // Enter from inside the picker (focus on the day button in Chrome, or on
    // <body> in Safari — test both paths end in a submit).
    pressKey(wednesday, "Enter");
    await (0, react_1.act)(tick);
    const todos = store_1.useLemonadeStore.getState().calendarTodos;
    const added = todos[todos.length - 1];
    assert.equal(added.text, "Water the plants");
    assert.equal(added.isRecurring, true, "task is recurring");
    assert.equal(added.recurringFrequency, "weekly");
});
(0, node_test_1.test)("AttachmentDropdown: typed URL gets an open-in-new-tab link", () => {
    let draft = { ...(0, QuickInputBar_1.createDefaultDraft)(), url: "example.com/path" };
    const onChange = (updates) => {
        draft = { ...draft, ...updates };
        (0, react_1.act)(() => root.render(React.createElement(AttachmentDropdown_1.AttachmentDropdown, { value: draft, onChange })));
    };
    (0, react_1.act)(() => root.render(React.createElement(AttachmentDropdown_1.AttachmentDropdown, { value: draft, onChange })));
    const openLink = container.querySelector('a[aria-label="Open link in new tab"]');
    assert.ok(openLink, "open-in-new-tab link is shown while adding a URL");
    assert.equal(openLink.getAttribute("href"), "https://example.com/path", "URL is normalized with scheme");
    assert.equal(openLink.getAttribute("target"), "_blank");
    assert.equal(openLink.getAttribute("rel"), "noopener noreferrer");
});
(0, node_test_1.test)("AttachmentDropdown: no open link until something URL-like is typed", () => {
    const draft = (0, QuickInputBar_1.createDefaultDraft)();
    (0, react_1.act)(() => root.render(React.createElement(AttachmentDropdown_1.AttachmentDropdown, { value: draft, onChange: () => { } })));
    assert.equal(container.querySelector('a[aria-label="Open link in new tab"]'), null);
});
// ── CalendarDropdown: time picker dismissal ──────────────────────────────────
(0, node_test_1.test)("time wheel closes when another element in the panel is clicked", () => {
    let draft = (0, QuickInputBar_1.createDefaultDraft)();
    const onChange = (updates) => {
        draft = { ...draft, ...updates };
        rerender();
    };
    const rerender = () => {
        (0, react_1.act)(() => {
            root.render(React.createElement(CalendarDropdown_1.CalendarDropdown, { value: draft, onChange }));
        });
    };
    rerender();
    const openPopovers = () => container.querySelectorAll("[data-floating-picker]").length;
    assert.equal(openPopovers(), 0, "no sub-picker open initially");
    // Open the "Today at <time>" wheel.
    const todayTimeBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("10:00 AM"));
    (0, react_1.act)(() => todayTimeBtn.click());
    assert.equal(openPopovers(), 1, "time wheel is open");
    // Mousedown on another element in the panel (the "Next Week" row).
    const nextWeek = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Next Week");
    mouse(nextWeek, "mousedown");
    assert.equal(openPopovers(), 0, "time wheel closed after clicking another element");
});
// ── TaskRow: snooze menu + functional chips ──────────────────────────────────
const renderRow = (todoInput) => {
    const id = store_1.useLemonadeStore.getState().addCalendarTodo({ text: "Chip task", completed: false, date: null, ...todoInput });
    const todo = store_1.useLemonadeStore.getState().calendarTodos.find((t) => t.id === id);
    (0, react_1.act)(() => {
        root.render(React.createElement(TaskRow_1.TaskRow, { todo }));
    });
    return id;
};
(0, node_test_1.test)("snooze icon opens an options menu and snoozing picks the chosen option", () => {
    const id = renderRow({});
    const before = store_1.useLemonadeStore.getState().calendarTodos.find((t) => t.id === id).date;
    (0, react_1.act)(() => byLabel("Snooze task").click());
    const options = ["Later today", "Tomorrow", "This weekend", "Next week"];
    for (const label of options) {
        assert.ok(Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === label), `menu shows "${label}"`);
    }
    const tomorrow = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Tomorrow");
    (0, react_1.act)(() => tomorrow.click());
    const after = store_1.useLemonadeStore.getState().calendarTodos.find((t) => t.id === id).date;
    assert.notEqual(after, before, "task was snoozed to a new date");
    assert.ok(!Array.from(container.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Later today"), "menu closes after choosing");
});
(0, node_test_1.test)("url, phone and location render as functional chips", () => {
    renderRow({ url: "example.com/some/very/long/path?with=query", phone: "+1 (555) 010-7788", location: "12 Main St" });
    const links = Array.from(container.querySelectorAll("a"));
    const urlChip = links.find((a) => a.getAttribute("href") === "https://example.com/some/very/long/path?with=query");
    assert.ok(urlChip, "url chip links to the normalized URL");
    assert.equal(urlChip.textContent.includes("example.com"), true, "url chip shows compact hostname");
    assert.equal(urlChip.getAttribute("target"), "_blank");
    const telChip = links.find((a) => a.getAttribute("href") === "tel:+15550107788");
    assert.ok(telChip, "phone chip is a tel: link");
    const mapChip = links.find((a) => a.getAttribute("href")?.startsWith("https://maps.google.com/?q="));
    assert.ok(mapChip, "location chip links to maps");
});
(0, node_test_1.test)("attachment chip has a view element that opens preview with a download option", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    renderRow({
        attachments: [
            { id: "att-1", name: "receipt.png", type: "image/png", size: 10, dataUrl, createdAt: Date.now() },
        ],
    });
    assert.ok(container.textContent.includes("receipt.png"), "attachment name is shown");
    (0, react_1.act)(() => byLabel("View attachment").click());
    // Dialog content portals to document.body.
    const img = document.body.querySelector(`img[src="${dataUrl}"]`);
    assert.ok(img, "preview shows the image");
    const download = Array.from(document.body.querySelectorAll("a")).find((a) => a.getAttribute("download") === "receipt.png");
    assert.ok(download, "download option present");
    assert.equal(download.getAttribute("href"), dataUrl);
});

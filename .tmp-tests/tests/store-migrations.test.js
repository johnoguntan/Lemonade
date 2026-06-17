"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const store_1 = require("../lib/store");
(0, node_test_1.default)("legacy preferences are normalized during migration", () => {
    const migrated = (0, store_1.migratePersistedLemonadeState)({
        preferences: {
            textSize: "S",
            spacing: "L",
        },
    });
    strict_1.default.equal(store_1.STORAGE_VERSION, 3);
    strict_1.default.equal(migrated.preferences?.textSize, "sm");
    strict_1.default.equal(migrated.preferences?.spacing, "comfortable");
    strict_1.default.equal(migrated.preferences?.showDotGridBackground, true);
});
(0, node_test_1.default)("legacy todos gain normalized createdAt and endOfDay values", () => {
    const migrated = (0, store_1.migratePersistedLemonadeState)({
        calendarTodos: [
            {
                id: "todo-1",
                text: "Legacy todo",
                completed: false,
                date: "2026-03-24",
                priority: "high",
                subtasks: [{ id: "sub-1", text: "Legacy subtask", completed: false }],
            },
        ],
    });
    strict_1.default.equal(migrated.calendarTodos?.length, 1);
    strict_1.default.equal(migrated.calendarTodos?.[0]?.createdAt, 0);
    strict_1.default.equal(migrated.calendarTodos?.[0]?.endOfDay, false);
    strict_1.default.equal(migrated.calendarTodos?.[0]?.parentId, null);
    strict_1.default.equal(migrated.calendarTodos?.[0]?.priority, "urgent");
    strict_1.default.deepEqual(migrated.calendarTodos?.[0]?.subtasks, [
        { id: "sub-1", title: "Legacy subtask", completed: false, parentId: "todo-1" },
    ]);
});
(0, node_test_1.default)("tasks without a priority are normalized to normal", () => {
    const migrated = (0, store_1.migratePersistedLemonadeState)({
        calendarTodos: [
            {
                id: "todo-1",
                text: "No priority",
                completed: false,
                date: "2026-03-24",
                subtasks: [],
            },
        ],
    });
    strict_1.default.equal(migrated.calendarTodos?.[0]?.priority, "normal");
});
(0, node_test_1.default)("legacy list todos are normalized during migration", () => {
    const migrated = (0, store_1.migratePersistedLemonadeState)({
        lists: [
            {
                id: "list-1",
                name: "Legacy list",
                type: "list",
                todos: [
                    {
                        id: "todo-1",
                        text: "Legacy list todo",
                        completed: false,
                        date: "2026-03-24",
                        subtasks: [{ id: "sub-1", text: "Legacy subtask", completed: true }],
                    },
                ],
            },
        ],
    });
    const legacyList = migrated.lists?.find((list) => list.id === "list-1");
    strict_1.default.equal(legacyList?.todos[0]?.createdAt, 0);
    strict_1.default.equal(legacyList?.todos[0]?.endOfDay, false);
    strict_1.default.equal(legacyList?.todos[0]?.parentId, null);
    strict_1.default.deepEqual(legacyList?.todos[0]?.subtasks, [
        { id: "sub-1", title: "Legacy subtask", completed: true, parentId: "todo-1" },
    ]);
});
(0, node_test_1.default)("weekCount is locked to the one-week layout", () => {
    const lowWeekCount = (0, store_1.migratePersistedLemonadeState)({ weekCount: 0 });
    const highWeekCount = (0, store_1.migratePersistedLemonadeState)({ weekCount: 99 });
    strict_1.default.equal(lowWeekCount.weekCount, 1);
    strict_1.default.equal(highWeekCount.weekCount, 1);
});
(0, node_test_1.default)("invalid persisted arrays fall back safely", () => {
    const migrated = (0, store_1.migratePersistedLemonadeState)({
        calendarTodos: null,
        lists: null,
        listTabs: null,
        labels: null,
    });
    strict_1.default.deepEqual(migrated.calendarTodos, []);
    strict_1.default.ok(Array.isArray(migrated.lists));
    strict_1.default.ok(Array.isArray(migrated.listTabs));
    strict_1.default.deepEqual(migrated.labels, []);
});
(0, node_test_1.default)("fixed shopping returns tab and list are present after migration", () => {
    const migrated = (0, store_1.migratePersistedLemonadeState)({
        listTabs: [{ id: "my-lists-tab", name: "MY LISTS" }],
        lists: [],
    });
    strict_1.default.ok(migrated.listTabs?.some((tab) => tab.id === "shopping-returns-tab"));
    strict_1.default.ok(migrated.lists?.some((list) => list.id === "shopping-returns" && list.tabId === "shopping-returns-tab"));
});

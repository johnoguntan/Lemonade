"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionLines = SectionLines;
exports.buildCalendarAddHandler = buildCalendarAddHandler;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const CalendarDropdown_1 = require("@/components/task-creation/CalendarDropdown");
const PriorityDropdown_1 = require("@/components/task-creation/PriorityDropdown");
const AttachmentDropdown_1 = require("@/components/task-creation/AttachmentDropdown");
const QuickInputBar_1 = require("@/components/task-creation/QuickInputBar");
const store_1 = require("@/lib/store");
// Identical design to the top QuickInputBar:
//   Row 1: [input] [CalendarDays] [+]
//   Row 2 (only after pressing + with empty input, or when a panel is open):
//          [CalendarDays] [Flag] [Paperclip]
// Hovering any icon opens its dropdown; it stays open until a click elsewhere.
function SectionInputRow({ onAdd, onCancel, placeholder = "Add a task…" }) {
    const [text, setText] = (0, react_1.useState)("");
    const [draft, setDraft] = (0, react_1.useState)(() => (0, QuickInputBar_1.createDefaultDraft)());
    const [openPanel, setOpenPanel] = (0, react_1.useState)(null);
    const [iconsVisible, setIconsVisible] = (0, react_1.useState)(false);
    const containerRef = (0, react_1.useRef)(null);
    const inputRef = (0, react_1.useRef)(null);
    const lockedPanelRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => { inputRef.current?.focus(); }, []);
    (0, react_1.useEffect)(() => {
        const handler = (e) => {
            const target = e.target;
            if (target?.closest?.(".color-picker-panel"))
                return;
            if (!containerRef.current?.contains(e.target)) {
                lockedPanelRef.current = null;
                setOpenPanel(null);
                setIconsVisible(false);
                // Cancel if the user clicked outside without typing anything.
                if (!text.trim())
                    onCancel();
            }
        };
        window.addEventListener("mousedown", handler);
        return () => window.removeEventListener("mousedown", handler);
    }, [onCancel, text]);
    const updateDraft = (updates) => setDraft((curr) => ({ ...curr, ...updates }));
    const submit = () => {
        const trimmed = text.trim();
        if (!trimmed) {
            onCancel();
            return;
        }
        onAdd(trimmed, {
            scheduleDate: draft.scheduleDate,
            scheduleWhenever: draft.scheduleWhenever,
            scheduleTime: draft.scheduleTime,
            priority: draft.priority !== "none" ? draft.priority : undefined,
            collections: draft.collections.length ? draft.collections : undefined,
            color: draft.color,
            attachmentName: draft.attachmentName,
            attachmentDataUrl: draft.attachmentDataUrl,
        });
        setText("");
        setDraft((0, QuickInputBar_1.createDefaultDraft)());
        lockedPanelRef.current = null;
        setOpenPanel(null);
        setIconsVisible(false);
        onCancel();
    };
    // Window-level fallback: Enter submits even when focus has escaped the row
    // (clicking a non-focusable spot in a dropdown moves focus to <body>, and the
    // ColorPicker is portaled outside the container). Active whenever this row is
    // mounted — the row only exists while the user is mid-add.
    (0, QuickInputBar_1.useQuickAddGlobalKeys)({
        containerRef,
        isActive: () => true,
        onSubmit: submit,
        onEscape: () => {
            lockedPanelRef.current = null;
            setOpenPanel(null);
            setIconsVisible(false);
            setText("");
            onCancel();
        },
    });
    // Container-level keydown — catches Enter/Escape when focus is inside a dropdown
    // (CalendarDropdown, PriorityDropdown, etc.) rather than the main input.
    const handleContainerKey = (e) => {
        if (e.key === "Escape") {
            lockedPanelRef.current = null;
            setOpenPanel(null);
            setIconsVisible(false);
            setText("");
            onCancel();
            return;
        }
        if (e.key !== "Enter" || e.shiftKey)
            return;
        const target = e.target;
        if (target.tagName === "TEXTAREA")
            return;
        // If focus is on an input inside a dropdown (not the main text input), blur it
        // so its value is committed, then submit on the next tick.
        if (target.tagName === "INPUT" && target !== inputRef.current) {
            e.preventDefault();
            target.blur();
            window.setTimeout(() => submit(), 0);
            return;
        }
        e.preventDefault();
        submit();
    };
    // Hover opens a dropdown and it STAYS open after the cursor leaves —
    // it only closes on a click somewhere else (outside mousedown above)
    // or by clicking the same icon again. Same behavior as QuickInputBar.
    const handleIconHoverEnter = (panel) => {
        setOpenPanel(panel);
    };
    const handleIconClick = (panel) => {
        setOpenPanel((p) => {
            if (p === panel) {
                lockedPanelRef.current = null;
                return null;
            }
            lockedPanelRef.current = panel;
            return panel;
        });
    };
    const showIconRow = iconsVisible || openPanel !== null;
    const iconCls = "text-[#8e8e8e] transition-all duration-200 hover:text-[#3d3d3d]";
    return ((0, jsx_runtime_1.jsxs)("div", { ref: containerRef, className: "relative", onKeyDown: handleContainerKey, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3 text-[#8e8e8e]", children: [(0, jsx_runtime_1.jsx)("input", { ref: inputRef, value: text, onFocus: () => setIconsVisible(true), onChange: (e) => setText(e.target.value), placeholder: placeholder, className: "h-7 flex-1 bg-transparent text-[15px] font-normal text-[#111] outline-none placeholder:font-light placeholder:text-[#b9b9b9]" }), !showIconRow ? ((0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("calendar"), onMouseEnter: () => handleIconHoverEnter("calendar"), className: iconCls, "aria-label": "Schedule", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarDays, { size: 17 }) }), openPanel === "calendar" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(CalendarDropdown_1.CalendarDropdown, { value: draft, onChange: updateDraft }) })) : null] })) : null, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                            setIconsVisible((v) => !v);
                            setOpenPanel(null);
                        }, className: iconCls, "aria-label": "Show task options", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 17 }) })] }), showIconRow ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center justify-end gap-4 pt-1 text-[#8e8e8e]", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("calendar"), onMouseEnter: () => handleIconHoverEnter("calendar"), className: iconCls, "aria-label": "Schedule", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarDays, { size: 17 }) }), openPanel === "calendar" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(CalendarDropdown_1.CalendarDropdown, { value: draft, onChange: updateDraft }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("priority"), onMouseEnter: () => handleIconHoverEnter("priority"), className: iconCls, "aria-label": "Priority", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Flag, { size: 17 }) }), openPanel === "priority" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(PriorityDropdown_1.PriorityDropdown, { value: draft, onChange: updateDraft }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("attachment"), onMouseEnter: () => handleIconHoverEnter("attachment"), className: iconCls, "aria-label": "Attachment", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Paperclip, { size: 17 }) }), openPanel === "attachment" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(AttachmentDropdown_1.AttachmentDropdown, { value: draft, onChange: updateDraft }) })) : null] })] })) : null] }));
}
const DEFAULT_LINE_HEIGHT = "h-9";
function SectionLines({ count = 5, onAdd, ariaLabel = "Add a task", placeholder = "Add a task…", className = "", lineHeightClass = DEFAULT_LINE_HEIGHT, }) {
    const [activeIndex, setActiveIndex] = (0, react_1.useState)(null);
    if (!onAdd) {
        return ((0, jsx_runtime_1.jsx)("div", { className: className, "aria-hidden": "true", children: Array.from({ length: count }).map((_, index) => ((0, jsx_runtime_1.jsx)("div", { className: lineHeightClass }, `line-${index}`))) }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: className, children: Array.from({ length: count }).map((_, index) => {
            if (activeIndex === index) {
                return ((0, jsx_runtime_1.jsx)(SectionInputRow, { onAdd: onAdd, onCancel: () => setActiveIndex(null), placeholder: placeholder }, `line-${index}`));
            }
            return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setActiveIndex(index), "aria-label": ariaLabel, className: `block w-full text-left ${lineHeightClass}` }, `line-${index}`));
        }) }));
}
// ─── buildCalendarAddHandler ──────────────────────────────────────────────────
// Returns a (text, opts?) handler that DailySection / DateCollection /
// TagCollection pass to SectionLines as `onAdd`.  The `opts` come from the
// inline icon bar so date, time, priority etc. picked there are respected.
function buildCalendarAddHandler(input) {
    return (text, opts) => {
        const { addCalendarTodo, ensureLabelIds, selectedCalendarDate, kind, tagNames, } = input;
        // Resolve date from opts (user picked) or context default.
        const resolveDate = () => {
            if (opts?.scheduleWhenever)
                return null;
            if (opts?.scheduleDate)
                return (0, store_1.formatLocalDateKey)(opts.scheduleDate);
            return selectedCalendarDate || null;
        };
        const extraLabelIds = opts?.collections ? ensureLabelIds(opts.collections) : [];
        if (kind === "overdue") {
            const past = new Date();
            past.setHours(0, 0, 0, 0);
            past.setDate(past.getDate() - 1);
            const pastKey = `${past.getFullYear()}-${`${past.getMonth() + 1}`.padStart(2, "0")}-${`${past.getDate()}`.padStart(2, "0")}`;
            addCalendarTodo({
                text,
                completed: false,
                date: pastKey,
                section: "allday",
                priority: "normal",
                endOfDay: true,
                rollover: true,
            });
            return;
        }
        if (kind === "collection") {
            const labelIds = tagNames ? ensureLabelIds(tagNames) : [];
            addCalendarTodo({
                text,
                completed: false,
                date: resolveDate(),
                time: opts?.scheduleTime ?? undefined,
                priority: opts?.priority ?? "normal",
                labelIds: [...labelIds, ...extraLabelIds],
                color: opts?.color ?? undefined,
                endOfDay: false,
            });
            return;
        }
        // "schedule" section: default to 12:00 PM so the task stays in SCHEDULE
        // (the DailyView filter requires a non-empty time for the schedule section).
        const defaultTime = kind === "schedule" ? "12:00 PM" : undefined;
        const time = opts?.scheduleTime ?? defaultTime;
        addCalendarTodo({
            text,
            completed: false,
            date: resolveDate(),
            time,
            section: kind,
            priority: opts?.priority ?? (kind === "urgent" ? "urgent" : "normal"),
            labelIds: extraLabelIds,
            color: opts?.color ?? undefined,
            endOfDay: kind === "allday",
        });
    };
}

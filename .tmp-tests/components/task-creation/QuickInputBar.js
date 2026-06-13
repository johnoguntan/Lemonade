"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultDraft = void 0;
exports.useQuickAddGlobalKeys = useQuickAddGlobalKeys;
exports.QuickInputBar = QuickInputBar;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const CalendarDropdown_1 = require("@/components/task-creation/CalendarDropdown");
const AttachmentDropdown_1 = require("@/components/task-creation/AttachmentDropdown");
const PriorityDropdown_1 = require("@/components/task-creation/PriorityDropdown");
const sonner_1 = require("sonner");
const ai_task_parser_1 = require("@/lib/ai-task-parser");
const task_shortcuts_1 = require("@/lib/task-shortcuts");
const store_1 = require("@/lib/store");
const createDefaultDraft = () => ({
    title: "",
    section: "allday",
    scheduleDate: null,
    scheduleWhenever: false,
    scheduleTime: null,
    dueDate: null,
    duration: null,
    repeat: null,
    alert: null,
    snooze: null,
    priority: "none",
    collections: [],
    color: null,
    icon: null,
    subtasks: [],
    url: "",
    phone: "",
    address: "",
    attachmentFile: null,
    attachmentName: null,
    attachmentDataUrl: null,
    notes: "",
});
exports.createDefaultDraft = createDefaultDraft;
// Cheap check for whether the text is worth parsing. Plain titles ("Buy milk")
// skip parsing entirely so they create instantly with no API round-trip.
const PARSE_SIGNAL_RE = /\b(today|tomorrow|tonight|tmr|tmrw|next|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|noon|midnight|every|daily|weekly|monthly|yearly)\b|\d{1,2}:\d{2}|\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\bin\s+\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b|[#!@]|https?:\/\//i;
const looksParseable = (text) => PARSE_SIGNAL_RE.test(text);
// ─── Global Enter/Escape fallback ────────────────────────────────────────────
// The container's own onKeyDown only fires while focus is INSIDE the bar. But
// clicking a non-focusable spot in a dropdown moves focus to <body> (and in
// Safari/Firefox even buttons don't take focus on click), and the ColorPicker
// is portaled onto <body> — in all those cases Enter went nowhere. This hook
// listens on window so Enter always adds the task while a quick-add surface is
// active, without stealing Enter from unrelated inputs elsewhere on the page.
function useQuickAddGlobalKeys({ containerRef, isActive, onSubmit, onEscape, }) {
    // Refs so the single window listener always sees the latest closures.
    const stateRef = (0, react_1.useRef)({ isActive, onSubmit, onEscape });
    (0, react_1.useEffect)(() => {
        stateRef.current = { isActive, onSubmit, onEscape };
    });
    (0, react_1.useEffect)(() => {
        const handler = (event) => {
            const { isActive, onSubmit, onEscape } = stateRef.current;
            if (!isActive())
                return;
            // Another quick-add surface (or the container handler) already took it.
            if (event.defaultPrevented)
                return;
            const target = event.target;
            // Focus inside the bar bubbles through the container's own onKeyDown.
            if (target && containerRef.current?.contains(target))
                return;
            const inPortal = Boolean(target?.closest?.(".color-picker-panel"));
            // Only act when focus is "nowhere" (body/html) or inside a portaled
            // quick-add surface — never hijack typing in unrelated fields.
            const focusIsFree = !target || target === document.body || target === document.documentElement || inPortal;
            if (!focusIsFree)
                return;
            if (event.key === "Escape") {
                onEscape();
                return;
            }
            if (event.key !== "Enter" || event.shiftKey)
                return;
            if (target?.tagName === "TEXTAREA")
                return;
            // A text field inside the portal: blur first so its onBlur commits the
            // value into the draft, then submit on the next tick.
            if (inPortal && target && (target.tagName === "INPUT" || target.tagName === "SELECT")) {
                event.preventDefault();
                target.blur();
                // Read through the ref at fire time: the blur above re-renders, and we
                // want the submit closure that sees the committed value.
                window.setTimeout(() => stateRef.current.onSubmit(), 0);
                return;
            }
            event.preventDefault();
            onSubmit();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [containerRef]);
}
// Map the Alert dropdown labels to reminder offsets (minutes before the event).
const ALERT_OFFSET_MINUTES = {
    "At time of event": 0,
    "5 min before": 5,
    "10 min before": 10,
    "15 min before": 15,
    "30 min before": 30,
    "1 hour before": 60,
    "1 day before": 1440,
};
function QuickInputBar() {
    const [draft, setDraft] = (0, react_1.useState)(() => (0, exports.createDefaultDraft)());
    const [openPanel, setOpenPanel] = (0, react_1.useState)(null);
    // iconsVisible: the 3-icon row is only shown after the user presses + with an empty input.
    const [iconsVisible, setIconsVisible] = (0, react_1.useState)(false);
    const [isParsing, setIsParsing] = (0, react_1.useState)(false);
    const containerRef = (0, react_1.useRef)(null);
    const inputRef = (0, react_1.useRef)(null);
    // when the user clicks an icon the panel is "locked" open; hover-away won't close it
    const lockedPanelRef = (0, react_1.useRef)(null);
    // Always points at the latest draft so submit works even when triggered from
    // a deferred handler (e.g. after committing a field on Enter).
    const draftRef = (0, react_1.useRef)(draft);
    draftRef.current = draft;
    const addCalendarTodoBase = (0, store_1.useLemonadeStore)((state) => state.addCalendarTodo);
    const addCalendarTodo = addCalendarTodoBase;
    const ensureLabelIds = (0, store_1.useLemonadeStore)((state) => state.ensureLabelIds);
    const selectedCalendarDate = (0, store_1.useLemonadeStore)((state) => state.selectedCalendarDate);
    (0, react_1.useEffect)(() => {
        const handleOutside = (event) => {
            const target = event.target;
            // Ignore clicks inside the portaled color picker (rendered on <body>).
            if (target?.closest?.(".color-picker-panel"))
                return;
            if (!containerRef.current?.contains(event.target)) {
                lockedPanelRef.current = null;
                setOpenPanel(null);
                setIconsVisible(false);
            }
        };
        const handleFocusRequest = () => {
            inputRef.current?.focus();
        };
        window.addEventListener("mousedown", handleOutside);
        window.addEventListener("allsenadro:new-task-focus", handleFocusRequest);
        return () => {
            window.removeEventListener("mousedown", handleOutside);
            window.removeEventListener("allsenadro:new-task-focus", handleFocusRequest);
        };
    }, []);
    const updateDraft = (updates) => {
        setDraft((current) => ({ ...current, ...updates }));
    };
    // The 3-icon row is visible when explicitly expanded OR when a panel is open.
    const showIconRow = iconsVisible || openPanel !== null;
    // Hovering an icon opens its dropdown, and the dropdown STAYS open when the
    // cursor leaves — it only closes on a click somewhere else (the outside
    // mousedown handler above) or by clicking the same icon again.
    const handleIconHoverEnter = (panel) => {
        setOpenPanel(panel);
    };
    const handleIconClick = (panel) => {
        setOpenPanel((current) => {
            if (current === panel) {
                lockedPanelRef.current = null;
                return null;
            }
            lockedPanelRef.current = panel;
            return panel;
        });
    };
    const handleSubmit = async () => {
        const draft = draftRef.current;
        const trimmed = draft.title.trim();
        if (!trimmed || isParsing)
            return;
        // Parse natural language ("call mom tomorrow 3pm #urgent") into fields.
        // Heuristic-first, AI fallback — only for inputs that actually carry signals.
        let parsed = null;
        if (looksParseable(trimmed)) {
            setIsParsing(true);
            try {
                parsed = await (0, ai_task_parser_1.aiParseSingleTask)(trimmed);
            }
            catch {
                parsed = null;
                // The task is still created as plain text — tell the user why the
                // date/time/priority weren't auto-filled instead of failing silently.
                sonner_1.toast.info("Added as a plain task — couldn't auto-detect details.");
            }
            finally {
                setIsParsing(false);
            }
        }
        // Explicit values picked via the dropdowns always win; parsed fills the gaps.
        const title = parsed?.title?.trim() || trimmed;
        // "Whenever" = user explicitly wants no date (null).
        // Unset (scheduleWhenever false, scheduleDate null) falls back to parsed date or selected calendar day.
        const dateKey = draft.scheduleWhenever
            ? null
            : draft.scheduleDate
                ? (0, store_1.formatLocalDateKey)(draft.scheduleDate)
                : parsed?.date ?? selectedCalendarDate;
        const time = draft.scheduleTime ?? parsed?.time ?? undefined;
        const effectivePriority = draft.priority !== "none" ? draft.priority : parsed?.priority ?? "normal";
        const url = draft.url || parsed?.url || "";
        const phone = draft.phone || parsed?.phone || "";
        const address = draft.address || parsed?.location || "";
        const labelIds = ensureLabelIds(Array.from(new Set([...draft.collections, ...(parsed?.labels ?? [])])));
        const recurringFields = parsed ? (0, task_shortcuts_1.resolveParsedRecurringTodoFields)(parsed) : {};
        // An explicit Repeat choice from the dropdown wins over NLP-detected recurrence.
        const repeatFields = draft.repeat
            ? {
                isRecurring: true,
                recurringFrequency: draft.repeat.frequency === "daily" ||
                    draft.repeat.frequency === "weekly" ||
                    draft.repeat.frequency === "monthly"
                    ? draft.repeat.frequency
                    : undefined,
                recurringInterval: draft.repeat.interval > 1 ? draft.repeat.interval : undefined,
                recurringDays: draft.repeat.daysOfWeek?.length ? draft.repeat.daysOfWeek : undefined,
                recurringCustomText: draft.repeat.frequency === "yearly" ? "yearly" : undefined,
            }
            : {};
        // Explicit Alert dropdown choice wins over NLP-detected reminder.
        const reminderOffset = draft.alert && draft.alert in ALERT_OFFSET_MINUTES
            ? ALERT_OFFSET_MINUTES[draft.alert]
            : parsed?.reminder ?? undefined;
        const dueDateKey = draft.dueDate ? (0, store_1.formatLocalDateKey)(draft.dueDate) : undefined;
        // Persist a chosen attachment (data URL captured by AttachmentDropdown).
        const attachments = draft.attachmentName && draft.attachmentDataUrl && draft.attachmentFile
            ? [
                {
                    id: globalThis.crypto.randomUUID(),
                    name: draft.attachmentName,
                    type: draft.attachmentFile.type || "application/octet-stream",
                    size: draft.attachmentFile.size,
                    dataUrl: draft.attachmentDataUrl,
                    createdAt: Date.now(),
                },
            ]
            : [];
        const attachmentPhoto = attachments[0] && attachments[0].type.startsWith("image/") ? attachments[0].dataUrl : undefined;
        const hasScheduledTime = Boolean(time);
        const resolvedSection = effectivePriority === "urgent" ? "urgent" : hasScheduledTime ? "schedule" : "allday";
        addCalendarTodo({
            text: title,
            completed: false,
            date: dateKey,
            time,
            durationMinutes: draft.duration ?? parsed?.duration ?? undefined,
            reminderOffsetMinutes: reminderOffset,
            dueDate: dueDateKey,
            attachments: attachments.length ? attachments : undefined,
            photoDataUrl: attachmentPhoto,
            // url/phone/address are real fields (rendered as functional chips on the
            // task) — they don't belong in the notes text.
            notes: [draft.notes, parsed?.notes].filter(Boolean).join("\n") || undefined,
            location: address || undefined,
            url: url || undefined,
            phone: phone || undefined,
            color: draft.color || undefined,
            icon: draft.icon || undefined,
            priority: effectivePriority,
            labelIds,
            subtasks: draft.subtasks.filter((item) => item.trim()).map((title) => ({
                id: globalThis.crypto.randomUUID(),
                title,
                completed: false,
                parentId: "",
            })),
            section: resolvedSection,
            endOfDay: resolvedSection === "allday",
            rollover: false,
            dismissed: false,
            ...recurringFields,
            ...repeatFields,
        });
        setDraft((0, exports.createDefaultDraft)());
        lockedPanelRef.current = null;
        setOpenPanel(null);
        setIconsVisible(false);
    };
    // Window-level fallback: Enter adds the task even when focus has escaped the
    // container (body, or the portaled ColorPicker) while a dropdown is open.
    useQuickAddGlobalKeys({
        containerRef,
        isActive: () => openPanel !== null,
        onSubmit: () => void handleSubmit(),
        onEscape: () => {
            lockedPanelRef.current = null;
            setOpenPanel(null);
            setIconsVisible(false);
        },
    });
    // Enter should add the task no matter where focus is inside the quick-add —
    // including while a dropdown (Schedule/Priority/etc.) is open.
    const handleContainerKeyDown = (event) => {
        if (event.key === "Escape") {
            lockedPanelRef.current = null;
            setOpenPanel(null);
            setIconsVisible(false);
            return;
        }
        if (event.key !== "Enter" || event.shiftKey)
            return;
        const target = event.target;
        const tag = target.tagName;
        // Let multi-line notes keep their newlines.
        if (tag === "TEXTAREA")
            return;
        // If a dropdown's own text field has focus (e.g. the Schedule date input),
        // commit it first (its onBlur parses the value), then submit on the next
        // tick so the parsed value is in the draft.
        if (tag === "INPUT" && target.getAttribute("data-quick-task-input") !== "true") {
            event.preventDefault();
            target.blur();
            window.setTimeout(() => void handleSubmit(), 0);
            return;
        }
        // Title input, a panel button, or the panel surface itself → just submit.
        event.preventDefault();
        void handleSubmit();
    };
    // flex centering kills the inline-SVG baseline gap that made icons sit at
    // slightly different heights depending on whether they had a wrapper div.
    const iconButtonClass = "flex items-center justify-center text-[#8e8e8e] transition-all duration-200 hover:text-[#3d3d3d]";
    return ((0, jsx_runtime_1.jsxs)("div", { ref: containerRef, className: "relative", onKeyDown: handleContainerKeyDown, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3 text-[#8e8e8e]", children: [(0, jsx_runtime_1.jsx)("input", { "data-quick-task-input": "true", ref: inputRef, value: draft.title, onFocus: () => setIconsVisible(true), onChange: (event) => updateDraft({ title: event.target.value }), placeholder: "Add New Task", className: "h-7 flex-1 bg-transparent text-[15px] font-normal text-[#111] outline-none placeholder:font-light placeholder:text-[#b9b9b9]" }), !showIconRow ? ((0, jsx_runtime_1.jsxs)("div", { className: "relative flex items-center", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", 
                                // Click-only by design: this compact icon must not open the
                                // dropdown (or show anything else) on hover.
                                onClick: () => handleIconClick("calendar"), className: iconButtonClass, "aria-label": "Schedule", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarDays, { size: 17 }) }), openPanel === "calendar" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(CalendarDropdown_1.CalendarDropdown, { value: draft, onChange: updateDraft }) })) : null] })) : null, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                            setIconsVisible((v) => !v);
                            setOpenPanel(null);
                        }, disabled: isParsing, className: iconButtonClass, "aria-label": "Show task options", children: isParsing ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { size: 17, className: "animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 17 }) })] }), showIconRow ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center justify-end gap-4 pt-1 text-[#8e8e8e]", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex items-center", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("calendar"), onMouseEnter: () => handleIconHoverEnter("calendar"), className: iconButtonClass, "aria-label": "Schedule", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarDays, { size: 17 }) }), openPanel === "calendar" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(CalendarDropdown_1.CalendarDropdown, { value: draft, onChange: updateDraft }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex items-center", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("priority"), onMouseEnter: () => handleIconHoverEnter("priority"), className: iconButtonClass, "aria-label": "Priority", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Flag, { size: 17 }) }), openPanel === "priority" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(PriorityDropdown_1.PriorityDropdown, { value: draft, onChange: updateDraft }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex items-center", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleIconClick("attachment"), onMouseEnter: () => handleIconHoverEnter("attachment"), className: iconButtonClass, "aria-label": "Attachment", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Paperclip, { size: 17 }) }), openPanel === "attachment" ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-[70] mt-2", children: (0, jsx_runtime_1.jsx)(AttachmentDropdown_1.AttachmentDropdown, { value: draft, onChange: updateDraft }) })) : null] })] })) : null] }));
}

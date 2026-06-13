"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRow = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
// ─── Saw-toothed circle checkbox ─────────────────────────────────────────────
// Paths are pre-computed polygons: 18 teeth (full size) and 12 teeth (small).
// Each tooth alternates between outer and inner radius with slight jitter so
// no two teeth are identical — giving an organic, hand-cut feel.
const SAW_PATH_18 = "M 10.00 1.50 L 11.26 3.62 L 12.80 2.29 L 13.22 4.01 L 15.53 3.41 L 14.98 5.99 L 17.01 5.95 L 16.25 7.58 L 18.27 8.54 L 16.80 10.20 L 18.47 11.49 L 16.15 12.10 L 17.10 14.10 L 15.17 14.42 L 15.46 16.51 L 13.42 15.53 L 12.77 17.61 L 11.05 16.72 L 10.00 18.60 L 8.95 16.31 L 7.13 17.89 L 6.48 15.70 L 4.73 16.28 L 4.88 14.47 L 2.64 14.25 L 3.85 12.10 L 2.12 11.39 L 3.20 10.20 L 1.73 8.54 L 3.91 7.72 L 2.55 5.70 L 5.22 5.74 L 4.79 3.80 L 6.48 4.18 L 7.13 2.11 L 8.94 3.59 Z";
const SAW_PATH_12 = "M 10.00 1.30 L 11.93 3.58 L 14.20 2.73 L 14.80 4.90 L 17.53 5.65 L 16.51 8.40 L 18.30 10.00 L 16.81 11.61 L 17.45 14.30 L 14.52 14.80 L 14.35 17.53 L 11.92 16.63 L 10.00 18.40 L 7.99 16.70 L 5.60 17.62 L 5.41 14.88 L 2.81 14.15 L 3.20 11.68 L 1.30 10.00 L 3.49 8.40 L 2.73 5.80 L 5.20 4.90 L 5.65 2.47 L 8.07 3.58 Z";
function RoughCircle({ completed, size = 22, color }) {
    const isSmall = size <= 16;
    const d = isSmall ? SAW_PATH_12 : SAW_PATH_18;
    const fillColor = completed ? (color ?? "rgba(0,0,0,0.68)") : "none";
    const strokeColor = completed ? "none" : "rgba(0,0,0,0.30)";
    return ((0, jsx_runtime_1.jsx)("svg", { width: size, height: size, viewBox: "0 0 20 20", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", style: { display: "block" }, children: (0, jsx_runtime_1.jsx)("path", { d: d, fill: fillColor, stroke: strokeColor, strokeWidth: isSmall ? 0.3 : 0.4, strokeLinejoin: "miter", style: { transition: "fill 0.12s ease, stroke 0.12s ease" } }) }));
}
const lucide_react_1 = require("lucide-react");
const sonner_1 = require("sonner");
const store_1 = require("@/lib/store");
const ics_1 = require("@/lib/ics");
const date_parse_1 = require("@/lib/date-parse");
const CalendarDropdown_1 = require("@/components/task-creation/CalendarDropdown");
const QuickInputBar_1 = require("@/components/task-creation/QuickInputBar");
const TimeWheelPicker_1 = require("@/components/task-creation/TimeWheelPicker");
const ColorPicker_1 = require("@/components/task-creation/ColorPicker");
const task_icons_1 = require("@/lib/task-icons");
const context_menu_1 = require("@/components/ui/context-menu");
const dialog_1 = require("@/components/ui/dialog");
const button_1 = require("@/components/ui/button");
const schedulePalette = ["#2f58d8", "#f04da2", "#74be5c", "#f29f3a", "#8a5cf6", "#14b8a6"];
const priorityMarkerColors = {
    urgent: "#ef4444",
    important: "#8b5cf6",
    normal: "#3f7df6",
};
// Make a typed URL openable: bare "example.com" needs an explicit scheme.
const normalizeUrl = (raw) => (/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
// Compact label for a link chip — the hostname, not the whole scrolling URL.
const urlChipLabel = (raw) => {
    try {
        return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "");
    }
    catch {
        return raw.length > 28 ? `${raw.slice(0, 28)}…` : raw;
    }
};
const formatOverdueLabel = (dateKey) => {
    if (!dateKey)
        return null;
    const [year, month, day] = dateKey.split("-").map(Number);
    const due = new Date(year, (month ?? 1) - 1, day ?? 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - due.getTime()) / 86400000);
    if (diffDays <= 0)
        return null;
    if (diffDays < 7)
        return `${diffDays} DAY${diffDays === 1 ? "" : "S"} OVERDUE`;
    const weeks = Math.round(diffDays / 7);
    return `${weeks} WEEK${weeks === 1 ? "" : "S"} OVERDUE`;
};
function TaskRowComponent({ todo, sectionTitle, showOverdueActions = false, appearance = "daily", draggable = false, isDragging = false, onDragStart, onDropOnTask, }) {
    const typedTodo = todo;
    const toggleCalendarTodo = (0, store_1.useLemonadeStore)((state) => state.toggleCalendarTodo);
    const deleteCalendarTodo = (0, store_1.useLemonadeStore)((state) => state.deleteCalendarTodo);
    const undoTaskAction = (0, store_1.useLemonadeStore)((state) => state.undoTaskAction);
    const duplicateCalendarTodo = (0, store_1.useLemonadeStore)((state) => state.duplicateCalendarTodo);
    const snoozeCalendarTodo = (0, store_1.useLemonadeStore)((state) => state.snoozeCalendarTodo);
    const splitCalendarTodo = (0, store_1.useLemonadeStore)((state) => state.splitCalendarTodo);
    const convertTodoToSubtask = (0, store_1.useLemonadeStore)((state) => state.convertTodoToSubtask);
    const mergeSelectedTasks = (0, store_1.useLemonadeStore)((state) => state.mergeSelectedTasks);
    const toggleTaskSelection = (0, store_1.useLemonadeStore)((state) => state.toggleTaskSelection);
    const toggleSubtask = (0, store_1.useLemonadeStore)((state) => state.toggleSubtask);
    const promoteSubtaskToTask = (0, store_1.useLemonadeStore)((state) => state.promoteSubtaskToTask);
    const deleteSubtask = (0, store_1.useLemonadeStore)((state) => state.deleteSubtask);
    const editSubtask = (0, store_1.useLemonadeStore)((state) => state.editSubtask);
    const addSubtask = (0, store_1.useLemonadeStore)((state) => state.addSubtask);
    const toggleSubtasksCollapsed = (0, store_1.useLemonadeStore)((state) => state.toggleSubtasksCollapsed);
    // Narrow selectors so a change to one task (or the selection) doesn't re-render
    // every other row — only the rows whose own derived value actually changed.
    const isSelected = (0, store_1.useLemonadeStore)((state) => state.selectedTaskIds.includes(typedTodo.id));
    const mergeCount = (0, store_1.useLemonadeStore)((state) => state.selectedTaskIds.length);
    const isSubtasksCollapsed = (0, store_1.useLemonadeStore)((state) => state.collapsedSubtasks[typedTodo.id] ?? false);
    const updateCalendarTodoBase = (0, store_1.useLemonadeStore)((state) => state.updateCalendarTodo);
    const updateCalendarTodo = updateCalendarTodoBase;
    const [isEditing, setIsEditing] = (0, react_1.useState)(false);
    const [draftText, setDraftText] = (0, react_1.useState)(typedTodo.text);
    // Use Date | null so we can pass directly to MiniCalendar
    const [draftDate, setDraftDate] = (0, react_1.useState)(() => {
        if (!typedTodo.date)
            return null;
        const [y, m, d] = typedTodo.date.split("-").map(Number);
        return new Date(y, (m ?? 1) - 1, d ?? 1);
    });
    const [draftTime, setDraftTime] = (0, react_1.useState)(typedTodo.time ?? null);
    const [draftLocation, setDraftLocation] = (0, react_1.useState)(typedTodo.location ?? "");
    const [draftNotes, setDraftNotes] = (0, react_1.useState)(typedTodo.notes ?? "");
    const [showDatePicker, setShowDatePicker] = (0, react_1.useState)(false);
    const [showTimePicker, setShowTimePicker] = (0, react_1.useState)(false);
    const [showColorPicker, setShowColorPicker] = (0, react_1.useState)(false);
    const [draftColor, setDraftColor] = (0, react_1.useState)(typedTodo.color ?? null);
    const colorAnchorRef = (0, react_1.useRef)(null);
    // Text shadows for typed entry — kept in sync with picker selections
    const [draftDateText, setDraftDateText] = (0, react_1.useState)(() => {
        if (!typedTodo.date)
            return "";
        const [y, m, d] = typedTodo.date.split("-");
        return y && m && d ? `${m}/${d}/${y}` : "";
    });
    const [draftTimeText, setDraftTimeText] = (0, react_1.useState)(typedTodo.time ?? "");
    const [newSubtaskText, setNewSubtaskText] = (0, react_1.useState)("");
    // subtask inline editing: subtaskId → draft title
    const [editingSubtaskId, setEditingSubtaskId] = (0, react_1.useState)(null);
    const [editingSubtaskDraft, setEditingSubtaskDraft] = (0, react_1.useState)("");
    // Time wheel dismissal: clicking ANYWHERE other than the wheel itself or its
    // clock toggle closes it — inside the edit form, elsewhere on the page, anywhere.
    (0, react_1.useEffect)(() => {
        if (!showTimePicker)
            return;
        const handleOutside = (event) => {
            const target = event.target;
            if (target?.closest?.('[data-time-picker]') || target?.closest?.('[data-time-picker-toggle]'))
                return;
            setShowTimePicker(false);
        };
        window.addEventListener("mousedown", handleOutside);
        return () => window.removeEventListener("mousedown", handleOutside);
    }, [showTimePicker]);
    // Snooze options menu (opened from the hover toolbar's clock icon).
    const [snoozeMenuOpen, setSnoozeMenuOpen] = (0, react_1.useState)(false);
    const snoozeMenuRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!snoozeMenuOpen)
            return;
        const handleOutside = (event) => {
            if (!snoozeMenuRef.current?.contains(event.target))
                setSnoozeMenuOpen(false);
        };
        window.addEventListener("mousedown", handleOutside);
        return () => window.removeEventListener("mousedown", handleOutside);
    }, [snoozeMenuOpen]);
    // Power-action dialog state.
    const [splitOpen, setSplitOpen] = (0, react_1.useState)(false);
    const [splitText, setSplitText] = (0, react_1.useState)("");
    const [mergeOpen, setMergeOpen] = (0, react_1.useState)(false);
    const [mergeTitle, setMergeTitle] = (0, react_1.useState)("");
    const [convertOpen, setConvertOpen] = (0, react_1.useState)(false);
    const [convertQuery, setConvertQuery] = (0, react_1.useState)("");
    const [dropEdge, setDropEdge] = (0, react_1.useState)(null);
    const dragGhostRef = (0, react_1.useRef)(null);
    const todayKey = (0, react_1.useMemo)(() => {
        const now = new Date();
        return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
    }, []);
    // Location is rendered as a functional chip below — notes only here, so a
    // long address (or a legacy URL stuck in notes) doesn't stretch the row.
    const subtitle = typedTodo.notes ?? "";
    const overdueLabel = showOverdueActions ? formatOverdueLabel(typedTodo.date) : null;
    // Attachment preview dialog (view + download).
    const [attachmentPreviewOpen, setAttachmentPreviewOpen] = (0, react_1.useState)(false);
    const formatDueShort = (key) => {
        if (!key)
            return "";
        const [y, m, d] = key.split("-").map(Number);
        if (!y || !m || !d)
            return key;
        return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
    const attachmentList = typedTodo.attachments ?? [];
    const primaryAttachment = attachmentList[0] ?? null;
    const attachmentIsImage = Boolean(primaryAttachment?.type.startsWith("image/"));
    const attachmentIsPdf = primaryAttachment?.type === "application/pdf";
    const dueLabel = typedTodo.dueDate ? `Due ${formatDueShort(typedTodo.dueDate)}` : null;
    const hasMeta = Boolean(typedTodo.photoDataUrl || primaryAttachment || dueLabel || typedTodo.isRecurring ||
        typedTodo.url || typedTodo.phone || typedTodo.location);
    const chipClass = "inline-flex max-w-[180px] items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/60 transition hover:bg-black/10 hover:text-black";
    const metaRow = hasMeta ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex flex-wrap items-center gap-1.5", children: [typedTodo.photoDataUrl && !primaryAttachment ? (
            // eslint-disable-next-line @next/next/no-img-element
            (0, jsx_runtime_1.jsx)("img", { src: typedTodo.photoDataUrl, alt: "", className: "h-8 w-8 rounded-md border border-black/10 object-cover" })) : null, dueLabel ? ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700", children: dueLabel })) : null, typedTodo.isRecurring ? ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700", children: "Repeats" })) : null, typedTodo.url ? ((0, jsx_runtime_1.jsxs)("a", { href: normalizeUrl(typedTodo.url), target: "_blank", rel: "noopener noreferrer", title: typedTodo.url, className: chipClass, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Link2, { size: 10, className: "shrink-0" }), " ", (0, jsx_runtime_1.jsx)("span", { className: "truncate", children: urlChipLabel(typedTodo.url) })] })) : null, typedTodo.phone ? ((0, jsx_runtime_1.jsxs)("a", { href: `tel:${typedTodo.phone.replace(/[^\d+]/g, "")}`, title: `Call ${typedTodo.phone}`, className: chipClass, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Phone, { size: 10, className: "shrink-0" }), " ", (0, jsx_runtime_1.jsx)("span", { className: "truncate", children: typedTodo.phone })] })) : null, typedTodo.location ? ((0, jsx_runtime_1.jsxs)("a", { href: `https://maps.google.com/?q=${encodeURIComponent(typedTodo.location)}`, target: "_blank", rel: "noopener noreferrer", title: typedTodo.location, className: chipClass, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.MapPin, { size: 10, className: "shrink-0" }), " ", (0, jsx_runtime_1.jsx)("span", { className: "truncate", children: typedTodo.location })] })) : null, primaryAttachment ? ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex max-w-[220px] items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/60", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Paperclip, { size: 10, className: "shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "truncate", children: primaryAttachment.name }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setAttachmentPreviewOpen(true), className: "ml-0.5 shrink-0 rounded-full p-0.5 text-black/45 transition hover:bg-black/10 hover:text-black", "aria-label": "View attachment", title: "View attachment", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { size: 11 }) })] })) : null] })) : null;
    const scheduleColor = schedulePalette[(typedTodo.createdAt ?? 0) % schedulePalette.length];
    const showScheduleStyle = sectionTitle === "SCHEDULE";
    const priorityMarkerColor = priorityMarkerColors[(0, store_1.normalizeTodoPriority)(typedTodo.priority)];
    // The color/icon the user picked in the task-add panel. The icon is tinted
    // with the chosen color; a small dot makes the color visible even when there
    // is no icon and the task isn't completed.
    const accentColor = typedTodo.color ?? null;
    const leadingAccent = accentColor || typedTodo.icon ? ((0, jsx_runtime_1.jsxs)("span", { className: "flex shrink-0 translate-y-[1px] items-center gap-1 self-center", children: [accentColor ? ((0, jsx_runtime_1.jsx)("span", { className: "h-2 w-2 rounded-full", style: { backgroundColor: accentColor }, "aria-hidden": "true" })) : null, typedTodo.icon ? ((0, jsx_runtime_1.jsx)("span", { style: accentColor ? { color: accentColor } : undefined, className: "text-black/70", children: (0, jsx_runtime_1.jsx)(task_icons_1.TaskIcon, { icon: typedTodo.icon, className: "size-3.5" }) })) : null] })) : null;
    const subtasks = typedTodo.subtasks ?? [];
    const hasSubtasks = subtasks.length > 0;
    // Only needed while the convert dialog is open; read the list lazily via
    // getState() so TaskRow doesn't subscribe to the whole calendarTodos array
    // (which would re-render every row on any task change and defeat memoization).
    const convertCandidates = (0, react_1.useMemo)(() => {
        if (!convertOpen)
            return [];
        const query = convertQuery.trim().toLowerCase();
        return store_1.useLemonadeStore
            .getState()
            .calendarTodos.filter((candidate) => candidate.id !== typedTodo.id && !candidate.isHeading)
            .filter((candidate) => (query ? candidate.text.toLowerCase().includes(query) : true))
            .slice(0, 50);
    }, [convertOpen, convertQuery, typedTodo.id]);
    const saveEdit = () => {
        const trimmed = draftText.trim();
        if (!trimmed)
            return;
        updateCalendarTodo(typedTodo.id, {
            text: trimmed,
            time: draftTime ?? undefined,
            location: draftLocation.trim() || undefined,
            notes: draftNotes.trim() || undefined,
            color: draftColor ?? undefined,
            ...(draftDate ? { date: (0, store_1.formatLocalDateKey)(draftDate) } : {}),
        });
        setShowDatePicker(false);
        setShowTimePicker(false);
        setShowColorPicker(false);
        setIsEditing(false);
    };
    // Latest saveEdit, for deferred calls (after a field's onBlur commits its
    // value the closure from THIS render is stale — the ref isn't).
    const saveEditRef = (0, react_1.useRef)(saveEdit);
    (0, react_1.useEffect)(() => {
        saveEditRef.current = saveEdit;
    });
    const cancelEdit = () => {
        setDraftText(typedTodo.text);
        setDraftDate(() => {
            if (!typedTodo.date)
                return null;
            const [y, m, d] = typedTodo.date.split("-").map(Number);
            return new Date(y, (m ?? 1) - 1, d ?? 1);
        });
        setDraftTime(typedTodo.time ?? null);
        setDraftDateText(() => {
            if (!typedTodo.date)
                return "";
            const [y, m, d] = typedTodo.date.split("-");
            return y && m && d ? `${m}/${d}/${y}` : "";
        });
        setDraftTimeText(typedTodo.time ?? "");
        setDraftLocation(typedTodo.location ?? "");
        setDraftNotes(typedTodo.notes ?? "");
        setDraftColor(typedTodo.color ?? null);
        setShowDatePicker(false);
        setShowTimePicker(false);
        setShowColorPicker(false);
        setIsEditing(false);
    };
    // ─── Save-on-Enter for the edit form ───────────────────────────────────────
    // There is no Save button: Enter saves from anywhere in the form, Escape
    // cancels. Shift+Enter still inserts a newline in the notes textarea, and the
    // subtask inputs keep their own Enter behavior (they preventDefault).
    const editFormRef = (0, react_1.useRef)(null);
    const handleEditKeyDown = (event) => {
        if (event.key === "Escape") {
            cancelEdit();
            return;
        }
        if (event.key !== "Enter" || event.shiftKey)
            return;
        // A field already handled this Enter (e.g. the add-subtask input).
        if (event.defaultPrevented)
            return;
        const target = event.target;
        if (target.tagName === "INPUT") {
            // Commit the focused field first (date/time parse in onBlur), then save
            // on the next tick so the committed value is in the draft.
            event.preventDefault();
            target.blur();
            window.setTimeout(() => saveEditRef.current(), 0);
            return;
        }
        // Notes textarea (plain Enter) or any other surface → save.
        event.preventDefault();
        saveEdit();
    };
    // Window-level fallback: Enter still saves when focus has escaped the form
    // (clicking inside MiniCalendar/TimeWheelPicker moves focus to <body>, and
    // the ColorPicker is portaled onto <body>).
    (0, QuickInputBar_1.useQuickAddGlobalKeys)({
        containerRef: editFormRef,
        isActive: () => isEditing,
        onSubmit: () => saveEditRef.current(),
        onEscape: cancelEdit,
    });
    const shareTask = async () => {
        const payload = [typedTodo.text, typedTodo.time, subtitle].filter(Boolean).join("\n");
        if (navigator.share) {
            try {
                await navigator.share({ title: typedTodo.text, text: payload });
                return;
            }
            catch (error) {
                // User dismissed the share sheet — don't fall back to clipboard.
                if (error?.name === "AbortError")
                    return;
            }
        }
        try {
            await navigator.clipboard.writeText(payload);
            sonner_1.toast.success("Task copied to clipboard");
        }
        catch {
            sonner_1.toast.error("Couldn't share this task");
        }
    };
    const exportIcs = () => {
        try {
            (0, ics_1.downloadTaskIcs)(typedTodo);
            sonner_1.toast.success("Calendar file downloaded");
        }
        catch {
            sonner_1.toast.error("Couldn't create the calendar file");
        }
    };
    const handleDelete = () => {
        deleteCalendarTodo(typedTodo.id);
        (0, sonner_1.toast)("Task deleted", {
            action: { label: "Undo", onClick: () => undoTaskAction() },
        });
    };
    // Defer opening a dialog so it doesn't race the context menu's focus teardown.
    const openLater = (open) => window.setTimeout(open, 0);
    const openSplit = () => openLater(() => {
        setSplitText(typedTodo.text);
        setSplitOpen(true);
    });
    const openMerge = () => openLater(() => {
        setMergeTitle(typedTodo.text);
        setMergeOpen(true);
    });
    const openConvert = () => openLater(() => {
        setConvertQuery("");
        setConvertOpen(true);
    });
    const confirmSplit = () => {
        const titles = splitText.split("\n").map((line) => line.trim()).filter(Boolean);
        if (titles.length === 0)
            return;
        splitCalendarTodo(typedTodo.id, titles);
        setSplitOpen(false);
    };
    const confirmMerge = () => {
        if (mergeCount < 2 || !mergeTitle.trim())
            return;
        mergeSelectedTasks(mergeTitle.trim());
        setMergeOpen(false);
    };
    const subtaskToggle = hasSubtasks ? ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => toggleSubtasksCollapsed(typedTodo.id), className: "inline-flex shrink-0 items-center text-black/30 transition hover:text-black/60", "aria-label": isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks", children: isSubtasksCollapsed ? (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { size: 12 }) : (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { size: 12 }) })) : null;
    const subtaskList = hasSubtasks && !isSubtasksCollapsed ? ((0, jsx_runtime_1.jsx)("ul", { className: "mt-1 space-y-0.5", children: subtasks.map((subtask) => ((0, jsx_runtime_1.jsxs)("li", { className: "group/subtask flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => toggleSubtask(typedTodo.id, subtask.id), className: "flex h-3 w-3 shrink-0 items-center justify-center rounded-[4px] border border-black/20 text-black", "aria-label": subtask.completed ? "Mark subtask incomplete" : "Mark subtask complete", children: subtask.completed ? (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 9 }) : null }), editingSubtaskId === subtask.id ? ((0, jsx_runtime_1.jsx)("input", { autoFocus: true, value: editingSubtaskDraft, onChange: (e) => setEditingSubtaskDraft(e.target.value), onKeyDown: (e) => {
                        if (e.key === "Enter") {
                            const trimmed = editingSubtaskDraft.trim();
                            if (trimmed)
                                editSubtask(typedTodo.id, subtask.id, trimmed);
                            setEditingSubtaskId(null);
                        }
                        else if (e.key === "Escape") {
                            setEditingSubtaskId(null);
                        }
                    }, onBlur: () => {
                        const trimmed = editingSubtaskDraft.trim();
                        if (trimmed)
                            editSubtask(typedTodo.id, subtask.id, trimmed);
                        setEditingSubtaskId(null);
                    }, className: "min-w-0 flex-1 rounded border border-black/15 bg-white px-1.5 py-0.5 text-[11px] text-black outline-none" })) : ((0, jsx_runtime_1.jsx)("span", { className: [
                        "min-w-0 flex-1 text-[11px] leading-4",
                        subtask.completed ? "text-black/35 line-through" : "text-black/70",
                    ].join(" "), children: subtask.title })), (0, jsx_runtime_1.jsxs)("span", { className: "ml-auto flex items-center gap-1 opacity-0 transition group-hover/subtask:opacity-100 [@media(hover:none)]:opacity-100", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => { setEditingSubtaskId(subtask.id); setEditingSubtaskDraft(subtask.title); }, className: "text-black/30 transition hover:text-black/70", "aria-label": "Edit subtask", title: "Edit", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { size: 11 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => promoteSubtaskToTask(typedTodo.id, subtask.id), className: "text-black/30 transition hover:text-black/70", "aria-label": "Make this subtask a task", title: "Make a task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CornerLeftUp, { size: 11 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => deleteSubtask(typedTodo.id, subtask.id), className: "text-black/30 transition hover:text-[#a32020]", "aria-label": "Delete subtask", title: "Delete subtask", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 11 }) })] })] }, subtask.id))) })) : null;
    const collapsedSubtaskCount = hasSubtasks && isSubtasksCollapsed ? ((0, jsx_runtime_1.jsx)("span", { className: "ml-1 text-[10px] font-medium text-black/35", children: subtasks.length })) : null;
    const snoozeChoices = [
        ["Later today", "later-today"],
        ["Tomorrow", "tomorrow"],
        ["This weekend", "this-weekend"],
        ["Next week", "next-week"],
    ];
    const utilityActions = ((0, jsx_runtime_1.jsxs)("div", { className: ["absolute right-0 top-1 z-20 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-sm transition group-hover:opacity-100 [@media(hover:none)]:opacity-100", snoozeMenuOpen ? "opacity-100" : "opacity-0"].join(" "), children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setIsEditing(true), className: "rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black", "aria-label": "Edit task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { size: 13 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => duplicateCalendarTodo(typedTodo.id), className: "rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black", "aria-label": "Duplicate task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { size: 13 }) }), (0, jsx_runtime_1.jsxs)("div", { ref: snoozeMenuRef, className: "relative", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSnoozeMenuOpen((v) => !v), className: "rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black", "aria-label": "Snooze task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { size: 13 }) }), snoozeMenuOpen ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-0 top-full z-30 mt-1 w-[150px] rounded-xl border border-black/10 bg-white py-1 shadow-xl", children: snoozeChoices.map(([label, key]) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                snoozeCalendarTodo(typedTodo.id, key);
                                setSnoozeMenuOpen(false);
                            }, className: "block w-full px-3 py-1.5 text-left text-[12px] text-black/75 hover:bg-black/5", children: label }, key))) })) : null] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => void shareTask(), className: "rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-black", "aria-label": "Share task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Share2, { size: 13 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleDelete, className: "rounded-full p-1 text-black/35 hover:bg-black/5 hover:text-[#a32020]", "aria-label": "Delete task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { size: 13 }) })] }));
    if (isEditing) {
        return ((0, jsx_runtime_1.jsx)("div", { ref: editFormRef, onKeyDown: handleEditKeyDown, className: "group rounded-[16px] border border-black/10 bg-white px-3 py-2.5", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("input", { autoFocus: true, value: draftText, onChange: (e) => setDraftText(e.target.value), className: "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative min-w-0", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center rounded-xl border border-black/10 px-3 py-2 focus-within:border-black/25", children: (0, jsx_runtime_1.jsx)("input", { value: draftDateText, onChange: (e) => setDraftDateText(e.target.value), onFocus: () => { setShowDatePicker(true); setShowTimePicker(false); }, onBlur: () => {
                                                setShowDatePicker(false);
                                                const parsed = (0, date_parse_1.parseFlexibleDate)(draftDateText);
                                                if (parsed) {
                                                    setDraftDate(parsed);
                                                    setDraftDateText(parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }));
                                                }
                                                else if (!draftDateText.trim()) {
                                                    setDraftDate(null);
                                                }
                                            }, placeholder: "Date", className: "min-w-0 flex-1 bg-transparent text-[12px] text-black outline-none placeholder:text-black/30" }) }), showDatePicker ? (
                                    // preventDefault on mousedown keeps the input focused while
                                    // clicking inside the calendar (otherwise blur closes it
                                    // before the click lands).
                                    (0, jsx_runtime_1.jsx)("div", { className: "absolute left-0 top-full z-50 mt-1", onMouseDown: (e) => e.preventDefault(), children: (0, jsx_runtime_1.jsx)(CalendarDropdown_1.MiniCalendar, { value: draftDate, onSelect: (d) => {
                                                setDraftDate(d);
                                                setDraftDateText(d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }));
                                                setShowDatePicker(false);
                                            }, onClose: () => setShowDatePicker(false) }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center rounded-xl border border-black/10 px-3 py-2 focus-within:border-black/25", children: [(0, jsx_runtime_1.jsx)("input", { value: draftTimeText, onChange: (e) => setDraftTimeText(e.target.value), onBlur: () => {
                                                    const trimmed = draftTimeText.trim();
                                                    setDraftTime(trimmed || null);
                                                }, placeholder: "Time", className: "min-w-0 flex-1 bg-transparent text-[12px] text-black outline-none placeholder:text-black/30" }), (0, jsx_runtime_1.jsx)("button", { type: "button", "data-time-picker-toggle": "true", onClick: () => { setShowTimePicker((v) => !v); setShowDatePicker(false); }, className: "ml-1 shrink-0 text-black/35 transition hover:text-black/70", "aria-label": "Open time picker", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { size: 13 }) })] }), showTimePicker ? ((0, jsx_runtime_1.jsx)("div", { "data-time-picker": "true", className: "absolute left-0 top-full z-50 mt-1 w-[270px] rounded-2xl border border-black/10 bg-white p-4 shadow-xl", children: (0, jsx_runtime_1.jsx)(TimeWheelPicker_1.TimeWheelPicker, { value: draftTime, onChange: (t) => { setDraftTime(t); setDraftTimeText(t); setShowTimePicker(false); } }) })) : null] })] }), (0, jsx_runtime_1.jsx)("input", { value: draftLocation, onChange: (e) => setDraftLocation(e.target.value), placeholder: "Location", className: "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" }), (0, jsx_runtime_1.jsx)("textarea", { value: draftNotes, onChange: (e) => setDraftNotes(e.target.value), placeholder: "Add a note\u2026", rows: 2, className: "w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-black outline-none" }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 space-y-1.5", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-black/35", children: "Subtasks" }), subtasks.map((subtask) => ((0, jsx_runtime_1.jsxs)("div", { className: "group/esub flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => toggleSubtask(typedTodo.id, subtask.id), className: "flex h-3 w-3 shrink-0 items-center justify-center rounded-[4px] border border-black/20 text-black", children: subtask.completed ? (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 9 }) : null }), editingSubtaskId === subtask.id ? ((0, jsx_runtime_1.jsx)("input", { autoFocus: true, value: editingSubtaskDraft, onChange: (e) => setEditingSubtaskDraft(e.target.value), onKeyDown: (e) => {
                                            if (e.key === "Enter") {
                                                // preventDefault so the form container doesn't ALSO
                                                // save-and-close the whole edit form.
                                                e.preventDefault();
                                                const t = editingSubtaskDraft.trim();
                                                if (t)
                                                    editSubtask(typedTodo.id, subtask.id, t);
                                                setEditingSubtaskId(null);
                                            }
                                            else if (e.key === "Escape") {
                                                e.stopPropagation();
                                                setEditingSubtaskId(null);
                                            }
                                        }, onBlur: () => {
                                            const t = editingSubtaskDraft.trim();
                                            if (t)
                                                editSubtask(typedTodo.id, subtask.id, t);
                                            setEditingSubtaskId(null);
                                        }, className: "min-w-0 flex-1 rounded border border-black/15 bg-white px-1.5 py-0.5 text-[11px] text-black outline-none" })) : ((0, jsx_runtime_1.jsx)("span", { className: ["min-w-0 flex-1 text-[11px]", subtask.completed ? "text-black/35 line-through" : "text-black/65"].join(" "), children: subtask.title })), (0, jsx_runtime_1.jsxs)("span", { className: "flex items-center gap-1 opacity-0 transition group-hover/esub:opacity-100", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => { setEditingSubtaskId(subtask.id); setEditingSubtaskDraft(subtask.title); }, className: "text-black/30 hover:text-black/70", title: "Edit", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { size: 10 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => promoteSubtaskToTask(typedTodo.id, subtask.id), className: "text-black/30 hover:text-black/70", title: "Make a task", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CornerLeftUp, { size: 10 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => deleteSubtask(typedTodo.id, subtask.id), className: "text-black/30 hover:text-[#a32020]", title: "Delete", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 10 }) })] })] }, subtask.id))), (0, jsx_runtime_1.jsx)("input", { value: newSubtaskText, onChange: (e) => setNewSubtaskText(e.target.value), onKeyDown: (e) => {
                                    if (e.key === "Enter") {
                                        const trimmed = newSubtaskText.trim();
                                        if (trimmed) {
                                            // Adds the subtask; preventDefault keeps the form container
                                            // from also saving-and-closing the edit form.
                                            e.preventDefault();
                                            addSubtask(typedTodo.id, trimmed);
                                            setNewSubtaskText("");
                                        }
                                        // Empty → fall through to the container, which saves the form.
                                    }
                                }, placeholder: "+ Add subtask\u2026", className: "w-full bg-transparent text-[11px] text-black/50 outline-none placeholder:text-black/30" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2.5", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[11px] text-black/45", children: "Completion color" }), (0, jsx_runtime_1.jsx)("button", { ref: colorAnchorRef, type: "button", onClick: () => setShowColorPicker((v) => !v), className: "flex h-6 w-6 items-center justify-center rounded-full border border-black/15 transition hover:border-black/30", style: { backgroundColor: draftColor ?? "transparent" }, "aria-label": "Pick completion color", children: !draftColor ? (0, jsx_runtime_1.jsx)(lucide_react_1.Palette, { size: 12, className: "text-black/35" }) : null }), draftColor ? ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDraftColor(null), className: "text-[10px] text-black/35 hover:text-black/60", children: "Reset" })) : null, showColorPicker ? ((0, jsx_runtime_1.jsx)(ColorPicker_1.ColorPicker, { value: draftColor, onChange: setDraftColor, onClose: () => setShowColorPicker(false), anchorRef: colorAnchorRef })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: cancelEdit, className: "inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-medium text-black/65", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 12 }), "Cancel"] }), (0, jsx_runtime_1.jsx)("span", { className: "text-[10px] text-black/30", children: "Enter to save" })] })] }) }));
    }
    const selectionClass = isSelected ? " ring-2 ring-sky-400/70 ring-offset-1 ring-offset-white rounded-[10px]" : "";
    // A nicer drag preview than the browser's default flat screenshot: a small
    // rounded card with the priority color and the task title.
    const buildDragGhost = () => {
        const ghost = document.createElement("div");
        ghost.style.cssText = [
            "position:fixed", "top:-1000px", "left:-1000px", "z-index:9999",
            "display:flex", "align-items:center", "gap:8px",
            "max-width:280px", "padding:8px 14px 8px 10px",
            "border-radius:12px", "background:#ffffff",
            "border:1px solid rgba(0,0,0,0.08)",
            "box-shadow:0 12px 32px rgba(0,0,0,0.20)",
            "font-size:13px", "font-weight:500", "color:#111",
            "white-space:nowrap", "overflow:hidden",
        ].join(";");
        const bar = document.createElement("span");
        bar.style.cssText = `flex:0 0 auto;width:4px;height:16px;border-radius:9999px;background:${priorityMarkerColor}`;
        const label = document.createElement("span");
        label.textContent = typedTodo.text;
        label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        ghost.append(bar, label);
        document.body.appendChild(ghost);
        return ghost;
    };
    const clearDragGhost = () => {
        dragGhostRef.current?.remove();
        dragGhostRef.current = null;
    };
    const dragHandlers = {
        draggable,
        onDragStart: (event) => {
            event.dataTransfer.setData("text/plain", typedTodo.id);
            event.dataTransfer.effectAllowed = "move";
            clearDragGhost();
            dragGhostRef.current = buildDragGhost();
            event.dataTransfer.setDragImage(dragGhostRef.current, 12, 18);
            onDragStart?.(event, typedTodo.id);
        },
        onDragOver: (event) => {
            if (!draggable)
                return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const rect = event.currentTarget.getBoundingClientRect();
            setDropEdge(event.clientY < rect.top + rect.height / 2 ? "top" : "bottom");
        },
        onDragLeave: (event) => {
            if (event.currentTarget.contains(event.relatedTarget))
                return;
            setDropEdge(null);
        },
        onDrop: (event) => {
            if (!draggable)
                return;
            event.preventDefault();
            event.stopPropagation();
            const position = dropEdge === "top" ? "before" : "after";
            const draggedId = event.dataTransfer.getData("text/plain");
            setDropEdge(null);
            if (draggedId)
                onDropOnTask?.(typedTodo.id, position, draggedId);
        },
        onDragEnd: () => {
            setDropEdge(null);
            clearDragGhost();
        },
    };
    const dropIndicator = dropEdge ? ((0, jsx_runtime_1.jsx)("span", { "aria-hidden": "true", className: "pointer-events-none absolute inset-x-0 z-10 h-[2px] rounded-full bg-sky-400", style: dropEdge === "top" ? { top: -2 } : { bottom: -2 } })) : null;
    let rowNode;
    if (showScheduleStyle) {
        rowNode = ((0, jsx_runtime_1.jsxs)("div", { ...dragHandlers, className: ["group relative flex items-start gap-2 rounded-[10px] py-0.5", isDragging ? "opacity-45" : "", selectionClass].join(" "), children: [dropIndicator, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: (e) => { const r = e.currentTarget.getBoundingClientRect(); toggleCalendarTodo(typedTodo.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }, "aria-label": typedTodo.completed ? "Mark incomplete" : "Mark complete", className: "mt-[4px] flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-opacity hover:opacity-70", children: (0, jsx_runtime_1.jsx)(RoughCircle, { completed: typedTodo.completed, size: 14, color: typedTodo.color }) }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0 flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-baseline gap-1.5", children: [typedTodo.time ? (0, jsx_runtime_1.jsx)("span", { className: "text-[13px] font-medium", style: { color: scheduleColor }, children: typedTodo.time }) : null, subtaskToggle, leadingAccent, (0, jsx_runtime_1.jsx)("p", { onDoubleClick: () => setIsEditing(true), className: "cursor-text text-[13px] leading-[1.25] text-black", children: typedTodo.text }), collapsedSubtaskCount] }), subtitle ? (0, jsx_runtime_1.jsx)("p", { className: "ml-[1px] text-[11px] leading-4 text-black/56", children: subtitle }) : null, metaRow, subtaskList] }), (0, jsx_runtime_1.jsx)("button", { type: "button", "aria-label": "Drag to reorder", className: ["mt-[2px] shrink-0 text-black/12", draggable ? "cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" : "opacity-0"].join(" "), children: (0, jsx_runtime_1.jsx)(lucide_react_1.GripHorizontal, { size: 14 }) }), utilityActions] }));
    }
    else if (appearance === "collection") {
        rowNode = ((0, jsx_runtime_1.jsxs)("div", { ...dragHandlers, className: ["group relative flex min-h-[44px] items-stretch gap-3 py-1.5", draggable ? "cursor-grab active:cursor-grabbing" : "", isDragging ? "opacity-45" : "", selectionClass].join(" "), children: [dropIndicator, (0, jsx_runtime_1.jsx)("span", { className: "w-[5px] shrink-0 self-stretch rounded-full", style: { backgroundColor: priorityMarkerColor }, "aria-hidden": "true" }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0 flex-1 py-0.5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-baseline gap-1.5", children: [subtaskToggle, leadingAccent, (0, jsx_runtime_1.jsx)("p", { onDoubleClick: () => setIsEditing(true), className: "cursor-text text-[15px] font-semibold leading-[1.18] text-black", children: typedTodo.text }), collapsedSubtaskCount] }), typedTodo.time ? (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-[12px] leading-4 text-black/62", children: typedTodo.time }) : null, subtitle ? (0, jsx_runtime_1.jsx)("p", { className: "text-[12px] leading-4 text-black/62", children: subtitle }) : null, metaRow, overdueLabel ? (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-[11px] leading-4 text-[#ff4f46]", children: overdueLabel }) : null, subtaskList] }), utilityActions] }));
    }
    else {
        rowNode = ((0, jsx_runtime_1.jsxs)("div", { ...dragHandlers, className: ["group relative flex items-start gap-3 py-2", isDragging ? "opacity-45" : "", selectionClass].join(" "), children: [dropIndicator, (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: (e) => { const r = e.currentTarget.getBoundingClientRect(); toggleCalendarTodo(typedTodo.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }, "aria-label": typedTodo.completed ? "Mark incomplete" : "Mark complete", className: "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center transition-opacity hover:opacity-60", children: (0, jsx_runtime_1.jsx)(RoughCircle, { completed: typedTodo.completed, size: 22, color: typedTodo.color }) }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0 flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-baseline gap-1.5", children: [subtaskToggle, leadingAccent, (0, jsx_runtime_1.jsx)("p", { onDoubleClick: () => setIsEditing(true), className: `cursor-text text-[13px] leading-[1.32] ${typedTodo.completed ? "text-black/40 line-through" : "text-black"}`, children: typedTodo.text }), collapsedSubtaskCount] }), typedTodo.time ? (0, jsx_runtime_1.jsx)("p", { className: "mt-0.5 text-[11px] leading-4 text-black/75", children: typedTodo.time }) : null, subtitle ? (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] leading-4 text-black/75", children: subtitle }) : null, metaRow, overdueLabel ? (0, jsx_runtime_1.jsx)("p", { className: "mt-0.5 text-[11px] leading-4 text-[#ff4f46]", children: overdueLabel }) : null, subtaskList] }), (0, jsx_runtime_1.jsx)("button", { type: "button", "aria-label": "Drag to reorder", className: ["mt-1 shrink-0 text-black/12", draggable ? "cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" : "opacity-0"].join(" "), children: (0, jsx_runtime_1.jsx)(lucide_react_1.GripHorizontal, { size: 14 }) }), utilityActions, showOverdueActions ? ((0, jsx_runtime_1.jsxs)("div", { className: "ml-2 flex shrink-0 items-center gap-2 pt-0.5", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateCalendarTodo(typedTodo.id, { date: todayKey, rollover: true, dismissed: false, section: "schedule", endOfDay: false }), className: "rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-black/55 transition hover:border-black/20 hover:text-black", children: "Rollover" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => updateCalendarTodo(typedTodo.id, { dismissed: true }), className: "rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-black/55 transition hover:border-black/20 hover:text-black", children: "Dismiss" })] })) : null] }));
    }
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenu, { children: [(0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuTrigger, { asChild: true, children: rowNode }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuContent, { className: "w-56", children: [(0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: () => openLater(() => setIsEditing(true)), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "size-4" }), " Edit"] }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: () => toggleCalendarTodo(typedTodo.id), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "size-4" }), " ", typedTodo.completed ? "Mark incomplete" : "Mark complete"] }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: () => duplicateCalendarTodo(typedTodo.id), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "size-4" }), " Duplicate"] }), hasSubtasks ? ((0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: () => toggleSubtasksCollapsed(typedTodo.id), children: [isSubtasksCollapsed ? (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "size-4" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "size-4" }), isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"] })) : null, (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuSeparator, {}), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: openSplit, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Scissors, { className: "size-4" }), " Split into tasks\u2026"] }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: openConvert, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CornerDownRight, { className: "size-4" }), " Convert to subtask\u2026"] }), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuSeparator, {}), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuCheckboxItem, { checked: isSelected, onCheckedChange: () => toggleTaskSelection(typedTodo.id), children: "Select for merge" }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { disabled: mergeCount < 2, onSelect: openMerge, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.GitMerge, { className: "size-4" }), " Merge selected (", mergeCount, ")\u2026"] }), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuSeparator, {}), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuSub, { children: [(0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuSubTrigger, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { className: "size-4" }), " Snooze"] }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuSubContent, { children: [(0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuItem, { onSelect: () => snoozeCalendarTodo(typedTodo.id, "later-today"), children: "Later today" }), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuItem, { onSelect: () => snoozeCalendarTodo(typedTodo.id, "tomorrow"), children: "Tomorrow" }), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuItem, { onSelect: () => snoozeCalendarTodo(typedTodo.id, "this-weekend"), children: "This weekend" }), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuItem, { onSelect: () => snoozeCalendarTodo(typedTodo.id, "next-week"), children: "Next week" })] })] }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: () => void shareTask(), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Share2, { className: "size-4" }), " Share"] }), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { onSelect: () => exportIcs(), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CalendarPlus, { className: "size-4" }), " Add to calendar (.ics)"] }), (0, jsx_runtime_1.jsx)(context_menu_1.ContextMenuSeparator, {}), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenuItem, { variant: "destructive", onSelect: handleDelete, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "size-4" }), " Delete"] })] })] }), (0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: attachmentPreviewOpen, onOpenChange: setAttachmentPreviewOpen, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "max-w-[520px]", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { className: "truncate pr-6", children: primaryAttachment?.name ?? "Attachment" }), (0, jsx_runtime_1.jsx)(dialog_1.DialogDescription, { className: "sr-only", children: "Attachment preview" })] }), primaryAttachment?.dataUrl ? (attachmentIsImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        (0, jsx_runtime_1.jsx)("img", { src: primaryAttachment.dataUrl, alt: primaryAttachment.name, className: "max-h-[60vh] w-full rounded-xl border border-black/10 object-contain" })) : attachmentIsPdf ? ((0, jsx_runtime_1.jsx)("iframe", { src: primaryAttachment.dataUrl, title: primaryAttachment.name, className: "h-[60vh] w-full rounded-xl border border-black/10" })) : ((0, jsx_runtime_1.jsx)("p", { className: "rounded-xl bg-black/[0.03] px-4 py-6 text-center text-[13px] text-black/55", children: "No inline preview for this file type \u2014 use Download to open it." }))) : ((0, jsx_runtime_1.jsx)("p", { className: "rounded-xl bg-black/[0.03] px-4 py-6 text-center text-[13px] text-black/55", children: "This attachment isn\u2019t stored on this device." })), (0, jsx_runtime_1.jsxs)(dialog_1.DialogFooter, { children: [(0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", onClick: () => setAttachmentPreviewOpen(false), children: "Close" }), primaryAttachment?.dataUrl ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", asChild: true, children: (0, jsx_runtime_1.jsxs)("a", { href: primaryAttachment.dataUrl, download: primaryAttachment.name, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "size-4" }), " Download"] }) })) : null] })] }) }), (0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: splitOpen, onOpenChange: setSplitOpen, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "max-w-[460px]", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { children: "Split into tasks" }), (0, jsx_runtime_1.jsx)(dialog_1.DialogDescription, { children: "One line per new task. This task will be replaced by the lines below." })] }), (0, jsx_runtime_1.jsx)("textarea", { value: splitText, onChange: (event) => setSplitText(event.target.value), rows: 5, className: "w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30", placeholder: "Buy paint\nTape the trim\nApply first coat" }), (0, jsx_runtime_1.jsxs)(dialog_1.DialogFooter, { children: [(0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", onClick: () => setSplitOpen(false), children: "Cancel" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", onClick: confirmSplit, children: "Split" })] })] }) }), (0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: mergeOpen, onOpenChange: setMergeOpen, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "max-w-[460px]", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogTitle, { children: ["Merge ", mergeCount, " tasks"] }), (0, jsx_runtime_1.jsx)(dialog_1.DialogDescription, { children: "The selected tasks become one. Notes are combined; the title below is used." })] }), (0, jsx_runtime_1.jsx)("input", { value: mergeTitle, onChange: (event) => setMergeTitle(event.target.value), className: "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30", placeholder: "Merged task title" }), (0, jsx_runtime_1.jsxs)(dialog_1.DialogFooter, { children: [(0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "outline", onClick: () => setMergeOpen(false), children: "Cancel" }), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", onClick: confirmMerge, disabled: mergeCount < 2 || !mergeTitle.trim(), children: "Merge" })] })] }) }), (0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: convertOpen, onOpenChange: setConvertOpen, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "max-w-[460px]", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { children: "Convert to subtask" }), (0, jsx_runtime_1.jsx)(dialog_1.DialogDescription, { children: "Choose the task this should become a subtask of." })] }), (0, jsx_runtime_1.jsx)("input", { value: convertQuery, onChange: (event) => setConvertQuery(event.target.value), className: "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30", placeholder: "Search tasks\u2026" }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-64 space-y-0.5 overflow-y-auto", children: convertCandidates.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "px-1 py-3 text-[12px] text-black/45", children: "No matching tasks." })) : (convertCandidates.map((candidate) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => {
                                    convertTodoToSubtask(typedTodo.id, candidate.id);
                                    setConvertOpen(false);
                                }, className: "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-black hover:bg-black/5", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CornerDownRight, { className: "size-3.5 shrink-0 text-black/35" }), (0, jsx_runtime_1.jsx)("span", { className: "truncate", children: candidate.text })] }, candidate.id)))) })] }) })] }));
}
exports.TaskRow = (0, react_1.memo)(TaskRowComponent);

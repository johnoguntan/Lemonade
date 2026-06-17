"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiniCalendar = MiniCalendar;
exports.CalendarDropdown = CalendarDropdown;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const TimeWheelPicker_1 = require("@/components/task-creation/TimeWheelPicker");
const RepeatPicker_1 = require("@/components/task-creation/RepeatPicker");
const date_parse_1 = require("@/lib/date-parse");
const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const durationOptions = [
    ["1 Min", 1], ["5 Min", 5], ["10 Min", 10], ["20 Min", 20], ["30 Min", 30],
    ["45 Min", 45], ["1 Hour", 60], ["90 Min", 90], ["2 Hours", 120], ["2½ Hours", 150], ["3 Hours", 180],
];
const alertOptions = ["None", "At time of event", "5 min before", "10 min before", "15 min before", "30 min before", "1 hour before", "1 day before"];
const snoozeOptions = ["None", "Later today", "Tomorrow", "Next week", "Custom"];
const formatInputDate = (date) => {
    if (!date)
        return "";
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${month}/${day}/${date.getFullYear()}`;
};
const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
};
const getDurationPillWidth = (duration) => {
    if (duration <= 5)
        return 92;
    if (duration <= 20)
        return 104;
    if (duration <= 45)
        return 112;
    if (duration <= 90)
        return 118;
    if (duration <= 120)
        return 132;
    if (duration <= 150)
        return 148;
    return 122;
};
const startOfDay = (date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
};
function MiniCalendar({ value, onSelect, timeValue, onTimeOpen, onClose, }) {
    const today = new Date();
    const [viewDate, setViewDate] = (0, react_1.useState)(value ?? today);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const dates = (0, react_1.useMemo)(() => {
        const first = new Date(year, month, 1);
        const start = new Date(year, month, 1 - first.getDay());
        return Array.from({ length: 42 }, (_, index) => {
            const next = new Date(start);
            next.setDate(start.getDate() + index);
            return next;
        });
    }, [month, year]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "w-[272px] rounded-[20px] bg-black p-4 text-white shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-white px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-black", children: formatInputDate(value ?? viewDate) }), onClose ? ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClose, "aria-label": "Close calendar", className: "-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 16 }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "mt-3 text-[18px] tracking-[0.02em]", children: year }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col text-white/55", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setViewDate((current) => new Date(current.getFullYear() + 1, current.getMonth(), 1)), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronUp, { size: 12 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setViewDate((current) => new Date(current.getFullYear() - 1, current.getMonth(), 1)), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { size: 12 }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 grid grid-cols-6 gap-x-2 gap-y-3 text-[10px] tracking-[0.16em] text-white/60", children: monthLabels.map((label, index) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setViewDate(new Date(year, index, 1)), children: (0, jsx_runtime_1.jsx)("span", { className: index === month ? "bg-white px-1.5 py-0.5 text-black" : "", children: label }) }, label))) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { size: 15 }) }), (0, jsx_runtime_1.jsx)("div", { className: "text-[22px] font-semibold tracking-[0.12em]", children: monthLabels[month] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { size: 15 }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 grid grid-cols-7 gap-y-2 text-center text-[10px] tracking-[0.16em] text-white/45", children: dayLabels.map((day, index) => ((0, jsx_runtime_1.jsx)("span", { children: day }, `${day}-${index}`))) }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 grid grid-cols-7 gap-y-1 text-center text-[12px]", children: dates.map((date) => {
                    const inMonth = date.getMonth() === month;
                    const active = value &&
                        date.getFullYear() === value.getFullYear() &&
                        date.getMonth() === value.getMonth() &&
                        date.getDate() === value.getDate();
                    const isToday = date.getFullYear() === today.getFullYear() &&
                        date.getMonth() === today.getMonth() &&
                        date.getDate() === today.getDate();
                    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onSelect(date), className: "flex justify-center", children: (0, jsx_runtime_1.jsx)("span", { className: [
                                "flex h-7 w-7 items-center justify-center rounded-full",
                                active || isToday ? "bg-[#0d4f8b] text-white ring-1 ring-[#194f84]" : "",
                                inMonth ? "text-white" : "text-white/20",
                            ].join(" "), children: date.getDate() }) }, date.toISOString()));
                }) }), onTimeOpen ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[12px] font-semibold tracking-[0.18em] text-white", children: "TIME" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onTimeOpen, className: "h-9 min-w-[132px] rounded-full bg-white px-4 text-[13px] font-medium text-black transition hover:bg-white/90", children: timeValue ?? "10:00 AM" })] })) : null] }));
}
function RowButton({ label, selected, onClick, rightContent, }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex w-full items-center justify-between gap-3 py-1 text-left", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClick, className: "min-w-0 flex-1 text-left", children: (0, jsx_runtime_1.jsx)("span", { className: "text-[17px] text-gray-900", children: label }) }), rightContent ? ((0, jsx_runtime_1.jsx)("span", { className: selected ? "rounded-full bg-[#dfeafe] px-3 py-1 text-sm text-gray-900" : "", children: rightContent })) : null] }));
}
function FloatingPopover({ children, className = "", }) {
    return ((0, jsx_runtime_1.jsx)("div", { "data-floating-picker": "true", className: `absolute left-0 top-full z-20 mt-3 ${className}`, children: children }));
}
function CalendarDropdown({ value, onChange }) {
    const [openPicker, setOpenPicker] = (0, react_1.useState)(null);
    const [timeAnchor, setTimeAnchor] = (0, react_1.useState)(null);
    const [calendarTimeOpen, setCalendarTimeOpen] = (0, react_1.useState)(false);
    const [scheduleInput, setScheduleInput] = (0, react_1.useState)(formatInputDate(value.scheduleDate));
    const [dueInput, setDueInput] = (0, react_1.useState)(formatInputDate(value.dueDate));
    const panelRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        setScheduleInput(formatInputDate(value.scheduleDate));
    }, [value.scheduleDate]);
    (0, react_1.useEffect)(() => {
        setDueInput(formatInputDate(value.dueDate));
    }, [value.dueDate]);
    (0, react_1.useEffect)(() => {
        const handleOutside = (event) => {
            if (!panelRef.current?.contains(event.target)) {
                setOpenPicker(null);
                setTimeAnchor(null);
                setCalendarTimeOpen(false);
            }
        };
        window.addEventListener("mousedown", handleOutside);
        return () => window.removeEventListener("mousedown", handleOutside);
    }, []);
    const applyShortcut = (type) => {
        const today = startOfDay(new Date());
        if (type === "whenever") {
            onChange({ scheduleDate: null, scheduleTime: null, scheduleWhenever: true });
            return;
        }
        // Any real date clears the "Whenever" flag.
        if (type === "today")
            onChange({ scheduleDate: today, scheduleWhenever: false });
        if (type === "tomorrow")
            onChange({ scheduleDate: addDays(today, 1), scheduleWhenever: false });
        if (type === "nextWeek")
            onChange({ scheduleDate: addDays(today, 7), scheduleTime: null, scheduleWhenever: false });
        if (type === "nextMonth")
            onChange({ scheduleDate: addDays(today, 30), scheduleTime: null, scheduleWhenever: false });
        if (type === "nextYear")
            onChange({ scheduleDate: addDays(today, 365), scheduleTime: null, scheduleWhenever: false });
    };
    const toggleScheduleTime = (anchor) => {
        const shouldClose = openPicker === "scheduleTime" && timeAnchor === anchor;
        setTimeAnchor(shouldClose ? null : anchor);
        setCalendarTimeOpen(false);
        setOpenPicker(shouldClose ? null : "scheduleTime");
    };
    // Any click inside the panel that is NOT on an open sub-picker (or one of
    // the buttons that toggle them) dismisses the sub-picker — so the time
    // wheel (and friends) goes away as soon as another element is selected.
    const handlePanelMouseDown = (event) => {
        if (openPicker === null && !calendarTimeOpen)
            return;
        const target = event.target;
        if (target.closest("[data-floating-picker]") || target.closest("[data-picker-toggle]"))
            return;
        setOpenPicker(null);
        setTimeAnchor(null);
        setCalendarTimeOpen(false);
    };
    return ((0, jsx_runtime_1.jsx)("div", { ref: panelRef, onMouseDown: handlePanelMouseDown, className: "w-[380px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[17px] text-gray-900", children: "Schedule" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: scheduleInput, onChange: (event) => setScheduleInput(event.target.value), onBlur: () => {
                                                const parsed = (0, date_parse_1.parseFlexibleDate)(scheduleInput);
                                                if (parsed)
                                                    onChange({ scheduleDate: parsed });
                                                else
                                                    setScheduleInput(formatInputDate(value.scheduleDate));
                                            }, placeholder: "e.g. 2/10/2026 or 4th of July", className: "rounded-full bg-[#dfeafe] px-4 py-1 text-sm outline-none" }), (0, jsx_runtime_1.jsx)("button", { type: "button", "data-picker-toggle": "true", onClick: () => setOpenPicker((current) => (current === "schedule" ? null : "schedule")), children: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarDays, { size: 18, className: "text-gray-500" }) }), openPicker === "schedule" ? ((0, jsx_runtime_1.jsx)("div", { "data-floating-picker": "true", className: "absolute right-0 top-full z-30 mt-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(MiniCalendar, { value: value.scheduleDate, onSelect: (date) => onChange({ scheduleDate: date, scheduleWhenever: false }), timeValue: value.scheduleTime, onTimeOpen: () => setCalendarTimeOpen((current) => !current), onClose: () => {
                                                            setOpenPicker(null);
                                                            setCalendarTimeOpen(false);
                                                        } }), calendarTimeOpen ? ((0, jsx_runtime_1.jsx)("div", { className: "absolute left-0 top-full z-30 mt-3 w-[272px] rounded-[20px] border border-black/10 bg-white p-3 shadow-2xl", children: (0, jsx_runtime_1.jsx)(TimeWheelPicker_1.TimeWheelPicker, { value: value.scheduleTime, onChange: (scheduleTime) => onChange({ scheduleTime }) }) })) : null] }) })) : null] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-3 border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsx)(RowButton, { label: "Today at", 
                                    // Today is also the DEFAULT: with no explicit choice (fresh draft,
                                    // e.g. right after a task was added) the task lands on today.
                                    selected: !value.scheduleWhenever &&
                                        (value.scheduleDate
                                            ? startOfDay(value.scheduleDate).getTime() === startOfDay(new Date()).getTime()
                                            : true), onClick: () => applyShortcut("today"), rightContent: (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", "data-picker-toggle": "true", onClick: () => toggleScheduleTime("today"), children: [value.scheduleTime ?? "10:00 AM", " ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "inline", size: 16 })] }), openPicker === "scheduleTime" && timeAnchor === "today" ? ((0, jsx_runtime_1.jsx)("div", { "data-floating-picker": "true", className: "absolute right-0 top-full z-30 mt-2 w-[236px] rounded-2xl border border-gray-100 bg-white p-3 shadow-xl", children: (0, jsx_runtime_1.jsx)(TimeWheelPicker_1.TimeWheelPicker, { value: value.scheduleTime, onChange: (scheduleTime) => onChange({ scheduleTime }) }) })) : null] }) }), (0, jsx_runtime_1.jsx)(RowButton, { label: "Tomorrow", selected: Boolean(value.scheduleDate && startOfDay(value.scheduleDate).getTime() === startOfDay(addDays(new Date(), 1)).getTime()), onClick: () => applyShortcut("tomorrow"), rightContent: (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", "data-picker-toggle": "true", onClick: () => toggleScheduleTime("tomorrow"), children: [value.scheduleTime ?? "10:00 AM", " ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "inline", size: 16 })] }), openPicker === "scheduleTime" && timeAnchor === "tomorrow" ? ((0, jsx_runtime_1.jsx)("div", { "data-floating-picker": "true", className: "absolute right-0 top-full z-30 mt-2 w-[236px] rounded-2xl border border-gray-100 bg-white p-3 shadow-xl", children: (0, jsx_runtime_1.jsx)(TimeWheelPicker_1.TimeWheelPicker, { value: value.scheduleTime, onChange: (scheduleTime) => onChange({ scheduleTime }) }) })) : null] }) }), (0, jsx_runtime_1.jsx)(RowButton, { label: "Next Week", selected: false, onClick: () => applyShortcut("nextWeek") }), (0, jsx_runtime_1.jsx)(RowButton, { label: "Next Month", selected: false, onClick: () => applyShortcut("nextMonth") }), (0, jsx_runtime_1.jsx)(RowButton, { label: "Next Year", selected: false, onClick: () => applyShortcut("nextYear") }), (0, jsx_runtime_1.jsx)(RowButton, { label: "Whenever", selected: Boolean(value.scheduleWhenever), onClick: () => applyShortcut("whenever") })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[17px] text-gray-900", children: "Due Date" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: dueInput, onChange: (event) => setDueInput(event.target.value), onBlur: () => {
                                                const parsed = (0, date_parse_1.parseFlexibleDate)(dueInput);
                                                if (parsed)
                                                    onChange({ dueDate: parsed });
                                                else
                                                    setDueInput(formatInputDate(value.dueDate));
                                            }, placeholder: "e.g. 2/10/2026 or 4th of July", className: "rounded-full bg-[#dfeafe] px-4 py-1 text-sm outline-none" }), (0, jsx_runtime_1.jsx)("button", { type: "button", "data-picker-toggle": "true", onClick: () => setOpenPicker((current) => (current === "dueDate" ? null : "dueDate")), children: (0, jsx_runtime_1.jsx)(lucide_react_1.CalendarDays, { size: 18, className: "text-gray-500" }) })] })] }), openPicker === "dueDate" ? ((0, jsx_runtime_1.jsx)(FloatingPopover, { children: (0, jsx_runtime_1.jsx)(MiniCalendar, { value: value.dueDate, onSelect: (date) => onChange({ dueDate: date }), onClose: () => setOpenPicker(null) }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[17px] text-gray-900", children: "Duration" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", "data-picker-toggle": "true", onClick: () => setOpenPicker((current) => (current === "customDuration" ? null : "customDuration")), className: "rounded-full bg-[#dfeafe] px-4 py-1 text-sm", children: [value.duration ? `${value.duration >= 60 ? `${value.duration / 60} Hour` : `${value.duration} Min`}` : "Custom", " ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "inline", size: 16 })] }), (0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { size: 18, className: "text-gray-500" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 flex flex-wrap gap-3", children: durationOptions.map(([label, duration]) => {
                                const isSelected = value.duration === duration;
                                // Water level scales with duration (sqrt so 1 Min still shows a
                                // visible splash and 3 Hours nearly fills the pill).
                                const level = Math.round(18 + Math.sqrt(duration / 180) * 78);
                                return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => onChange({ duration }), className: [
                                        "relative h-11 overflow-hidden rounded-full border bg-white text-sm transition-all duration-200 hover:-translate-y-0.5",
                                        isSelected
                                            ? "border-cyan-400/70 shadow-[0_5px_16px_rgba(8,145,178,0.22)]"
                                            : "border-gray-200 hover:border-gray-300",
                                    ].join(" "), style: { width: `${getDurationPillWidth(duration)}px` }, children: [isSelected ? ((0, jsx_runtime_1.jsxs)("span", { "aria-hidden": "true", "data-liquid-anim": true, style: {
                                                position: "absolute",
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                height: `${level}%`,
                                                animation: "liquid-bob 3.2s ease-in-out infinite",
                                            }, children: [(0, jsx_runtime_1.jsx)("span", { style: {
                                                        position: "absolute",
                                                        inset: 0,
                                                        background: "linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)",
                                                    } }), (0, jsx_runtime_1.jsx)("svg", { viewBox: "0 0 48 14", preserveAspectRatio: "none", "data-liquid-anim": true, style: {
                                                        position: "absolute",
                                                        left: 0,
                                                        top: -8,
                                                        width: "200%",
                                                        height: 12,
                                                        opacity: 0.55,
                                                        animation: "liquid-wave-move 2.4s linear infinite",
                                                    }, children: (0, jsx_runtime_1.jsx)("path", { d: "M0 7 Q6 1 12 7 T24 7 T36 7 T48 7 V14 H0 Z", fill: "#67e8f9" }) }), (0, jsx_runtime_1.jsx)("svg", { viewBox: "0 0 48 14", preserveAspectRatio: "none", "data-liquid-anim": true, style: {
                                                        position: "absolute",
                                                        left: 0,
                                                        top: -6,
                                                        width: "200%",
                                                        height: 12,
                                                        animation: "liquid-wave-move 1.4s linear infinite reverse",
                                                    }, children: (0, jsx_runtime_1.jsx)("path", { d: "M0 7 Q6 13 12 7 T24 7 T36 7 T48 7 V14 H0 Z", fill: "#06b6d4" }) })] })) : null, (0, jsx_runtime_1.jsx)("span", { className: [
                                                "relative z-10 flex h-full items-center justify-center px-4 text-center font-medium leading-tight transition-colors duration-200",
                                                isSelected ? "text-[#06363f]" : "text-gray-600",
                                            ].join(" "), children: label })] }, label));
                            }) }), openPicker === "customDuration" ? ((0, jsx_runtime_1.jsx)(FloatingPopover, { className: "w-[260px]", children: (0, jsx_runtime_1.jsx)("input", { defaultValue: value.duration ?? "", placeholder: "36 hours or 20 minutes", onBlur: (event) => {
                                    const text = event.target.value.trim().toLowerCase();
                                    const number = Number.parseFloat(text);
                                    if (!Number.isFinite(number))
                                        return;
                                    const minutes = text.includes("hour") ? Math.round(number * 60) : Math.round(number);
                                    onChange({ duration: minutes });
                                }, className: "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none shadow-lg" }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsx)(RowButton, { label: "Repeat", rightContent: (0, jsx_runtime_1.jsxs)("button", { type: "button", "data-picker-toggle": "true", onClick: () => setOpenPicker((current) => (current === "repeat" ? null : "repeat")), children: [value.repeat ? value.repeat.frequency[0].toUpperCase() + value.repeat.frequency.slice(1) : "Never", " ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "inline", size: 16 })] }) }), openPicker === "repeat" ? ((0, jsx_runtime_1.jsx)(FloatingPopover, { className: "w-[320px]", children: (0, jsx_runtime_1.jsx)(RepeatPicker_1.RepeatPicker, { value: value.repeat, onChange: (repeat) => onChange({ repeat }), onClose: () => setOpenPicker(null) }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsx)(RowButton, { label: "Alert", rightContent: (0, jsx_runtime_1.jsxs)("button", { type: "button", "data-picker-toggle": "true", onClick: () => setOpenPicker((current) => (current === "alert" ? null : "alert")), children: [value.alert ?? "None", " ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "inline", size: 16 })] }) }), openPicker === "alert" ? ((0, jsx_runtime_1.jsx)(FloatingPopover, { className: "w-[240px]", children: (0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-gray-100 bg-white p-3 shadow-lg", children: (0, jsx_runtime_1.jsx)("div", { className: "space-y-1", children: alertOptions.map((option) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                            onChange({ alert: option === "None" ? null : option });
                                            setOpenPicker(null);
                                        }, className: "block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50", children: option }, option))) }) }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsx)(RowButton, { label: "Snooze", rightContent: (0, jsx_runtime_1.jsxs)("button", { type: "button", "data-picker-toggle": "true", onClick: () => setOpenPicker((current) => (current === "snooze" ? null : "snooze")), children: [value.snooze ?? "Custom", " ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "inline", size: 16 })] }) }), openPicker === "snooze" ? ((0, jsx_runtime_1.jsx)(FloatingPopover, { className: "w-[280px]", children: (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-gray-100 bg-white p-3 shadow-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-1", children: snoozeOptions.map((option) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                onChange({ snooze: option === "None" ? null : option });
                                                if (option !== "Custom")
                                                    setOpenPicker(null);
                                            }, className: "block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50", children: option }, option))) }), value.snooze === "Custom" ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-3", children: (0, jsx_runtime_1.jsx)(MiniCalendar, { value: value.scheduleDate, onSelect: (date) => onChange({ dueDate: date }) }) })) : null] }) })) : null] })] }) }));
}

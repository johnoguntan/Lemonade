"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepeatPicker = RepeatPicker;
const jsx_runtime_1 = require("react/jsx-runtime");
const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
// Fully controlled: every selection commits to the draft IMMEDIATELY (like the
// calendar and time pickers do), so pressing Enter at any moment adds the task
// with the repeat that's on screen. OK just closes; Cancel clears the repeat.
function RepeatPicker({ value, onChange, onClose }) {
    const frequency = value?.frequency ?? "daily";
    const interval = value?.interval ?? 1;
    const daysOfWeek = value?.daysOfWeek ?? [1];
    const commit = (updates) => {
        const next = { frequency, interval, daysOfWeek, ...updates };
        onChange({
            frequency: next.frequency,
            interval: Math.max(1, next.interval || 1),
            ...(next.frequency === "weekly" ? { daysOfWeek: next.daysOfWeek } : {}),
        });
    };
    const clear = () => {
        onChange(null);
        onClose?.();
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-gray-100 bg-white p-4 shadow-xl", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: [
                        ["daily", "Daily"],
                        ["weekly", "Weekly"],
                        ["monthly", "Monthly"],
                        ["yearly", "Yearly"],
                    ].map(([key, label]) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => commit({ frequency: key }), className: [
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                            value && frequency === key ? "bg-[#ff4d57] text-white" : "bg-gray-50 text-gray-800 hover:bg-gray-100",
                        ].join(" "), children: [(0, jsx_runtime_1.jsx)("span", { children: label }), value && frequency === key ? (0, jsx_runtime_1.jsx)("span", { children: "\u2713" }) : null] }, key))) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-3 text-sm text-gray-700", children: [(0, jsx_runtime_1.jsx)("span", { children: "Every" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 1, value: interval, onChange: (event) => commit({ interval: Number.parseInt(event.target.value || "1", 10) }), className: "w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none" }), (0, jsx_runtime_1.jsxs)("span", { children: [frequency === "daily" && "day(s)", frequency === "weekly" && "week(s)", frequency === "monthly" && "month(s)", frequency === "yearly" && "year(s)"] })] }), frequency === "weekly" ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "mb-2 text-sm text-gray-700", children: "On" }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-1", children: dayLabels.map((label, index) => {
                                        const active = daysOfWeek.includes(index);
                                        return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => commit({
                                                daysOfWeek: daysOfWeek.includes(index)
                                                    ? daysOfWeek.filter((day) => day !== index)
                                                    : [...daysOfWeek, index].sort(),
                                            }), className: [
                                                "flex h-9 w-9 items-center justify-center border text-sm transition",
                                                active ? "border-[#ff4d57] bg-[#ff4d57] text-white" : "border-gray-300 text-gray-700",
                                            ].join(" "), children: label }, `${label}-${index}`));
                                    }) })] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-3 pt-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: clear, className: "rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onClose?.(), className: "rounded-xl bg-[#ff4d57] px-4 py-2 text-sm text-white", children: "OK" })] })] }) }));
}

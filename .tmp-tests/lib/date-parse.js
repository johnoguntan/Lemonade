"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFlexibleDate = void 0;
const store_1 = require("@/lib/store");
const task_shortcuts_1 = require("@/lib/task-shortcuts");
const MONTH_INDEX = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
    september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_NAMES = Object.keys(MONTH_INDEX).join("|");
const makeDate = (year, monthIndex, day) => {
    const date = new Date(year, monthIndex, day);
    // Reject overflow like Feb 31 (JS would roll it into March).
    if (date.getMonth() !== monthIndex || date.getDate() !== day)
        return null;
    return Number.isNaN(date.getTime()) ? null : date;
};
/**
 * Parse a human-typed date string into a Date. Handles:
 *  - numeric:   "2/10/2026", "2026-10-02"
 *  - month name + ordinal/"of": "4th of july 2026", "3rd august", "july 4"
 *  - relative:  "today", "tomorrow", "next friday"
 * Returns null if nothing usable is found.
 */
const parseFlexibleDate = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const lower = trimmed.toLowerCase();
    // Relative phrases via the app's shared heuristic.
    const relative = (0, task_shortcuts_1.detectFallbackDate)(lower, (0, store_1.formatLocalDateKey)(new Date()));
    if (relative) {
        const [y, m, d] = relative.split("-").map(Number);
        if (y && m && d)
            return makeDate(y, m - 1, d);
    }
    // Strip ordinal suffixes ("4th" -> "4"), "of", and commas.
    const normalized = lower
        .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, "$1")
        .replace(/\bof\b/g, " ")
        .replace(/,/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const currentYear = new Date().getFullYear();
    // "4 july 2026" | "4 july"
    let match = normalized.match(new RegExp(`^(\\d{1,2})\\s+(${MONTH_NAMES})(?:\\s+(\\d{4}))?$`));
    if (match) {
        return makeDate(match[3] ? Number(match[3]) : currentYear, MONTH_INDEX[match[2]], Number(match[1]));
    }
    // "july 4 2026" | "july 4"
    match = normalized.match(new RegExp(`^(${MONTH_NAMES})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?$`));
    if (match) {
        return makeDate(match[3] ? Number(match[3]) : currentYear, MONTH_INDEX[match[1]], Number(match[2]));
    }
    // Numeric / ISO and anything the engine understands natively.
    const native = new Date(trimmed);
    if (!Number.isNaN(native.getTime()))
        return native;
    const nativeNormalized = new Date(normalized);
    if (!Number.isNaN(nativeNormalized.getTime()))
        return nativeNormalized;
    return null;
};
exports.parseFlexibleDate = parseFlexibleDate;

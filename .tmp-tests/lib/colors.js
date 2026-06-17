"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertColorPalette = exports.mergeColorPalette = exports.normalizeHexColor = exports.DEFAULT_COLOR_PALETTE = void 0;
exports.DEFAULT_COLOR_PALETTE = [
    "#ffffff",
    "#fef08a",
    "#bbf7d0",
    "#bfdbfe",
    "#fbcfe8",
    "#fed7aa",
    "#0a0a0a",
    "#b7b08a",
    "#7f7a4f",
];
const normalizeHexColor = (value) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
        return undefined;
    }
    if (trimmed.length === 4) {
        const [, r, g, b] = trimmed;
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return trimmed.toLowerCase();
};
exports.normalizeHexColor = normalizeHexColor;
const mergeColorPalette = (palette = [], extraColors = []) => {
    const seen = new Set();
    const merged = [];
    for (const color of [...palette, ...extraColors]) {
        const normalized = (0, exports.normalizeHexColor)(color);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        merged.push(normalized);
    }
    return merged;
};
exports.mergeColorPalette = mergeColorPalette;
const upsertColorPalette = (palette = [], color, limit = 12) => {
    const normalized = (0, exports.normalizeHexColor)(color);
    if (!normalized) {
        return (0, exports.mergeColorPalette)(palette, exports.DEFAULT_COLOR_PALETTE);
    }
    const deduped = [normalized, ...(0, exports.mergeColorPalette)(palette, exports.DEFAULT_COLOR_PALETTE).filter((item) => item !== normalized)];
    return deduped.slice(0, limit);
};
exports.upsertColorPalette = upsertColorPalette;

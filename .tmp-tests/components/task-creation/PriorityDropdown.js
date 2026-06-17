"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityDropdown = PriorityDropdown;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const allsenadro_store_1 = require("@/lib/allsenadro-store");
const right_column_collections_1 = require("@/lib/right-column-collections");
const ColorPicker_1 = require("@/components/task-creation/ColorPicker");
const defaultCollectionNames = ["Tomorrow", "Next Week", "Next Month", "Next Year", "Whenever"];
const priorityOptions = [
    { key: "none", label: "NONE", color: "#8B5CF6" },
    { key: "urgent", label: "URGENT", color: "#EF4444" },
    { key: "high", label: "HIGH", color: "#F97316" },
    { key: "medium", label: "MEDIUM", color: "#EAB308" },
    { key: "low", label: "LOW", color: "#22C55E" },
];
const presetColors = [
    "#f4c27b", "#ec4899", "#7c3aed", "#d946ef", "#3b82f6", "#a1a1aa",
    "#65a30d", "#dbeafe", "#fde047", "#3730a3", "#ea580c", "#39ff14",
];
const iconOptions = [
    lucide_react_1.AlarmClock, lucide_react_1.CheckCircle, lucide_react_1.Calendar, lucide_react_1.Lock, lucide_react_1.Clock3, lucide_react_1.Grid2x2, lucide_react_1.Star,
    lucide_react_1.Heart, lucide_react_1.Zap, lucide_react_1.Flag, lucide_react_1.Bookmark, lucide_react_1.Tag, lucide_react_1.Bell, lucide_react_1.MapPin, lucide_react_1.Phone, lucide_react_1.Mail,
    lucide_react_1.Camera, lucide_react_1.Music, lucide_react_1.ShoppingBag, lucide_react_1.Briefcase,
];
function PriorityDropdown({ value, onChange }) {
    const collections = (0, allsenadro_store_1.useAllsenadroStore)((state) => state.collections);
    const presets = (0, allsenadro_store_1.useAllsenadroStore)((state) => state.presets);
    const activePresetId = (0, allsenadro_store_1.useAllsenadroStore)((state) => state.activePresetId);
    const rightColumnCollections = (0, right_column_collections_1.useRightColumnCollections)((state) => state.collections);
    const addTagCollection = (0, right_column_collections_1.useRightColumnCollections)((state) => state.addTagCollection);
    const [query, setQuery] = (0, react_1.useState)("");
    const [showColorPicker, setShowColorPicker] = (0, react_1.useState)(false);
    const colorPickerButtonRef = (0, react_1.useRef)(null);
    const panelRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        const handleOutside = (event) => {
            const target = event.target;
            // The color picker is portaled to <body>, so a click on the wheel is
            // technically outside this panel — don't treat that as "click away".
            if (target?.closest?.(".color-picker-panel"))
                return;
            if (!panelRef.current?.contains(event.target)) {
                setShowColorPicker(false);
            }
        };
        window.addEventListener("mousedown", handleOutside);
        return () => window.removeEventListener("mousedown", handleOutside);
    }, []);
    const existingNames = (0, react_1.useMemo)(() => {
        const names = new Set();
        defaultCollectionNames.forEach((name) => {
            names.add(name);
        });
        collections.forEach((collection) => {
            if (collection.name.trim()) {
                names.add(collection.name.trim());
            }
        });
        // Collections saved to the right column (including ones created here) so they
        // surface as suggestions next time.
        rightColumnCollections.forEach((collection) => {
            if (collection.name.trim()) {
                names.add(collection.name.trim());
            }
        });
        const usablePresets = presets.filter((preset) => preset.collections.length > 0);
        const activePreset = usablePresets.find((preset) => preset.id === activePresetId) ??
            usablePresets[0] ??
            null;
        if (activePreset?.name.trim()) {
            names.add(activePreset.name.trim());
        }
        if (activePreset) {
            activePreset.collections.forEach((collection) => {
                if (collection.name.trim()) {
                    names.add(collection.name.trim());
                }
            });
        }
        return Array.from(names);
    }, [activePresetId, collections, presets, rightColumnCollections]);
    const suggestions = (0, react_1.useMemo)(() => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) {
            return existingNames.slice(0, 8);
        }
        return [...existingNames]
            .sort((left, right) => {
            const leftStarts = left.toLowerCase().startsWith(trimmed) ? 0 : 1;
            const rightStarts = right.toLowerCase().startsWith(trimmed) ? 0 : 1;
            if (leftStarts !== rightStarts)
                return leftStarts - rightStarts;
            return left.localeCompare(right);
        })
            .filter((name) => name.toLowerCase().includes(trimmed))
            .slice(0, 8);
    }, [existingNames, query]);
    const addCollectionSelection = async (name) => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        if (!value.collections.includes(trimmed)) {
            onChange({ collections: [...value.collections, trimmed] });
        }
        // Persist as a real, saved tag collection so it appears in the right-column
        // collections view. addTagCollection is a no-op when one already exists.
        addTagCollection(trimmed);
        setQuery("");
    };
    return ((0, jsx_runtime_1.jsxs)("div", { ref: panelRef, className: "relative w-[380px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "mb-3 text-base text-gray-900", children: "Priority" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-2", children: priorityOptions.map((option) => {
                            const active = value.priority === option.key;
                            return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onChange({ priority: option.key }), className: "rounded-full px-4 py-1.5 text-xs font-bold transition", style: {
                                    backgroundColor: active ? option.color : "transparent",
                                    color: active ? "#fff" : option.color,
                                    border: `2px solid ${option.color}`,
                                }, children: option.label }, option.key));
                        }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-2 flex items-center justify-between text-base text-gray-900", children: [(0, jsx_runtime_1.jsx)("span", { children: "Add to Collection" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-300", children: "+" })] }), value.collections.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "mb-3 flex flex-wrap gap-2", children: value.collections.map((collection, index) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => onChange({ collections: value.collections.filter((item) => item !== collection) }), className: "rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700", children: [collection, " \u00D7"] }, `${collection}-${index}`))) })) : null, (0, jsx_runtime_1.jsx)("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Type collection name", className: "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-wrap gap-2", children: [suggestions.map((suggestion, index) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => void addCollectionSelection(suggestion), className: "rounded-full bg-[#dfeafe] px-3 py-1 text-sm text-gray-800", children: ["#", suggestion] }, `${suggestion}-${index}`))), query.trim() && !existingNames.some((name) => name.toLowerCase() === query.trim().toLowerCase()) ? ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => void addCollectionSelection(query), className: "rounded-full bg-[#dfeafe] px-3 py-1 text-sm text-gray-800", children: ["Create \"", query.trim(), "\""] })) : null] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "mb-3 text-base text-gray-900", children: "Color" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3", children: [presetColors.map((color, index) => {
                                const active = value.color === color;
                                return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onChange({ color }), className: ["h-6 w-6 rounded-full transition", active ? "ring-2 ring-black ring-offset-2" : ""].join(" "), style: { backgroundColor: color } }, `${color}-${index}`));
                            }), (0, jsx_runtime_1.jsx)("button", { type: "button", ref: colorPickerButtonRef, onClick: () => setShowColorPicker((current) => !current), className: "flex h-6 w-6 items-center justify-center rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#f43f5e,#f59e0b,#eab308,#22c55e,#3b82f6,#8b5cf6,#f43f5e)]", children: (0, jsx_runtime_1.jsx)("span", { className: "h-3 w-3 rounded-full bg-white/75" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "mb-3 text-base text-gray-900", children: "Icon" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-7 gap-2", children: iconOptions.map((Icon, index) => {
                            // lucide components are forwardRef objects whose `.name` is undefined;
                            // `.displayName` ("Star", "AlarmClock", …) is the stable identifier.
                            const iconName = Icon.displayName ?? "";
                            const active = value.icon === iconName;
                            return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onChange({ icon: iconName }), className: [
                                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                                    active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100",
                                ].join(" "), children: (0, jsx_runtime_1.jsx)(Icon, { size: 17 }) }, `${iconName || "icon"}-${index}`));
                        }) })] }), showColorPicker ? ((0, jsx_runtime_1.jsx)(ColorPicker_1.ColorPicker, { value: value.color, onChange: (color) => onChange({ color }), onClose: () => setShowColorPicker(false), anchorRef: colorPickerButtonRef })) : null] }));
}

"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionsEditor = CollectionsEditor;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
};
const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};
const createDateCollection = (name, template) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = addDays(today, 1);
    let end = start;
    if (template === "next_week") {
        start = addDays(today, 7);
        end = addDays(start, 6);
    }
    if (template === "next_month") {
        start = addDays(today, 30);
        end = addDays(start, 29);
    }
    if (template === "next_year") {
        start = addDays(today, 365);
        end = addDays(start, 364);
    }
    return {
        id: `local-collection-${globalThis.crypto.randomUUID()}`,
        user_id: "local",
        name,
        type: "date-based",
        color: null,
        date_range_type: "fixed",
        dynamic_range: null,
        fixed_start_date: formatDateKey(start),
        fixed_end_date: formatDateKey(end),
        is_default: false,
        sort_order: 0,
        created_at: "",
        updated_at: "",
    };
};
const createTagCollection = (name) => ({
    id: `local-collection-${globalThis.crypto.randomUUID()}`,
    user_id: "local",
    name,
    type: "tag-based",
    color: null,
    date_range_type: null,
    dynamic_range: null,
    fixed_start_date: null,
    fixed_end_date: null,
    is_default: false,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    tag: name,
});
function CollectionsEditor({ collections, availableTagNames, onChange }) {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const [draftName, setDraftName] = (0, react_1.useState)("");
    const [draftType, setDraftType] = (0, react_1.useState)("tag-based");
    const [dateTemplate, setDateTemplate] = (0, react_1.useState)("tomorrow");
    const [draggedId, setDraggedId] = (0, react_1.useState)(null);
    const [dragOverId, setDragOverId] = (0, react_1.useState)(null);
    const containerRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!isOpen)
            return;
        const handleOutside = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };
        window.addEventListener("mousedown", handleOutside);
        return () => window.removeEventListener("mousedown", handleOutside);
    }, [isOpen]);
    const suggestions = (0, react_1.useMemo)(() => availableTagNames.filter((name) => !collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase())).slice(0, 6), [availableTagNames, collections]);
    const applyCollections = (nextCollections) => {
        onChange(nextCollections.map((collection, index) => ({
            ...collection,
            sort_order: index,
        })));
    };
    const handleAdd = () => {
        const trimmed = draftName.trim();
        if (!trimmed)
            return;
        const nextCollection = draftType === "date-based"
            ? createDateCollection(trimmed, dateTemplate)
            : createTagCollection(trimmed);
        applyCollections([...collections, nextCollection]);
        setDraftName("");
    };
    const moveCollection = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= collections.length)
            return;
        const nextCollections = [...collections];
        const [item] = nextCollections.splice(index, 1);
        nextCollections.splice(targetIndex, 0, item);
        applyCollections(nextCollections);
    };
    const moveCollectionById = (sourceId, targetId) => {
        if (sourceId === targetId)
            return;
        const nextCollections = [...collections];
        const sourceIndex = nextCollections.findIndex((collection) => collection.id === sourceId);
        const targetIndex = nextCollections.findIndex((collection) => collection.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0)
            return;
        const [dragged] = nextCollections.splice(sourceIndex, 1);
        nextCollections.splice(targetIndex, 0, dragged);
        applyCollections(nextCollections);
    };
    const updateCollectionName = (id, name) => {
        applyCollections(collections.map((collection) => collection.id === id
            ? {
                ...collection,
                name,
                ...(collection.type === "tag-based" ? { tag: name } : {}),
            }
            : collection));
    };
    const removeCollection = (id) => {
        applyCollections(collections.filter((collection) => collection.id !== id));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { ref: containerRef, className: "relative", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setIsOpen((current) => !current), className: "rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-black/60 transition hover:border-black/20 hover:text-black", children: "Edit Collections" }), isOpen ? ((0, jsx_runtime_1.jsxs)("div", { className: "absolute right-0 top-full z-30 mt-3 w-[340px] rounded-[24px] border border-black/10 bg-white p-4 shadow-xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-[12px] uppercase tracking-[0.16em] text-black/50", children: "Right Column" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setIsOpen(false), className: "text-black/40 transition hover:text-black", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 16 }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 space-y-2", children: collections.map((collection, index) => ((0, jsx_runtime_1.jsxs)("div", { draggable: true, onDragStart: (event) => {
                                event.dataTransfer.setData("text/plain", collection.id);
                                setDraggedId(collection.id);
                                setDragOverId(collection.id);
                            }, onDragOver: (event) => {
                                event.preventDefault();
                                if (dragOverId !== collection.id) {
                                    setDragOverId(collection.id);
                                }
                            }, onDrop: (event) => {
                                event.preventDefault();
                                if (draggedId) {
                                    moveCollectionById(draggedId, collection.id);
                                }
                                setDraggedId(null);
                                setDragOverId(null);
                            }, onDragEnd: () => {
                                setDraggedId(null);
                                setDragOverId(null);
                            }, className: [
                                "rounded-2xl border bg-[#fbfaf7] px-3 py-3 transition",
                                draggedId === collection.id ? "cursor-grabbing opacity-55" : "cursor-grab",
                                dragOverId === collection.id ? "border-black/25 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" : "border-black/8",
                            ].join(" "), children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex min-w-0 flex-1 items-start gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "pt-1 text-[12px] tracking-[0.18em] text-black/25", children: ":::" }), (0, jsx_runtime_1.jsx)("input", { value: collection.name, onChange: (event) => updateCollectionName(collection.id, event.target.value), className: "min-w-0 flex-1 bg-transparent text-[14px] font-medium text-black outline-none" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => moveCollection(index, -1), className: "text-black/35 transition hover:text-black", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronUp, { size: 15 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => moveCollection(index, 1), className: "text-black/35 transition hover:text-black", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { size: 15 }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => removeCollection(collection.id), className: "text-black/35 transition hover:text-black", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 15 }) })] }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-[11px] uppercase tracking-[0.14em] text-black/40", children: collection.type === "date-based" ? "Date Range" : "Tag Collection" })] }, collection.id))) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t border-black/8 pt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: draftName, onChange: (event) => setDraftName(event.target.value), onKeyDown: (event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                handleAdd();
                                            }
                                        }, placeholder: "New collection name", className: "h-10 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 text-[13px] text-black outline-none placeholder:text-black/35" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleAdd, className: "flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition hover:bg-[#222]", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 16 }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDraftType("tag-based"), className: [
                                            "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                                            draftType === "tag-based" ? "border-black bg-black text-white" : "border-black/10 text-black/55",
                                        ].join(" "), children: "Tag" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDraftType("date-based"), className: [
                                            "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                                            draftType === "date-based" ? "border-black bg-black text-white" : "border-black/10 text-black/55",
                                        ].join(" "), children: "Date" })] }), draftType === "date-based" ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-3 flex flex-wrap gap-2", children: [
                                    ["tomorrow", "Tomorrow"],
                                    ["next_week", "Next Week"],
                                    ["next_month", "Next Month"],
                                    ["next_year", "Next Year"],
                                ].map(([value, label]) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDateTemplate(value), className: [
                                        "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                                        dateTemplate === value ? "border-black bg-black text-white" : "border-black/10 text-black/55",
                                    ].join(" "), children: label }, value))) })) : suggestions.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-3 flex flex-wrap gap-2", children: suggestions.map((suggestion) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDraftName(suggestion), className: "rounded-full border border-black/10 bg-[#eef4ff] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-black/65 transition hover:border-black/20 hover:text-black", children: suggestion }, suggestion))) })) : null] })] })) : null] }));
}

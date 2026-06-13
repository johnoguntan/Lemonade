"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentDropdown = AttachmentDropdown;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
// Bare "example.com" needs a scheme before it can open in a new tab.
const normalizeUrl = (raw) => (/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
const looksLikeUrl = (raw) => /\./.test(raw.trim());
function AttachmentDropdown({ value, onChange }) {
    const fileInputRef = (0, react_1.useRef)(null);
    const notesRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        const node = notesRef.current;
        if (!node)
            return;
        node.style.height = "0px";
        node.style.height = `${node.scrollHeight}px`;
    }, [value.notes]);
    const updateSubtask = (index, nextValue) => {
        onChange({
            subtasks: value.subtasks.map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
        });
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "w-[380px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-3 text-base text-gray-900", children: "Add Subtasks" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onChange({ subtasks: [...value.subtasks, ""] }), className: "mb-3 text-lg text-black", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 18 }) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: value.subtasks.map((subtask, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: subtask, onChange: (event) => updateSubtask(index, event.target.value), className: "flex-1 border-b border-gray-200 px-1 py-1 text-sm outline-none", placeholder: "Subtask" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onChange({ subtasks: value.subtasks.filter((_, itemIndex) => itemIndex !== index) }), className: "text-gray-400", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 14 }) })] }, `${index}-${subtask}`))) })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 border-t border-gray-100 pt-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: value.url, onChange: (event) => onChange({ url: event.target.value }), placeholder: "Add URL", className: "min-w-0 flex-1 text-lg text-gray-400 outline-none placeholder:text-gray-300" }), value.url.trim() && looksLikeUrl(value.url) ? ((0, jsx_runtime_1.jsx)("a", { href: normalizeUrl(value.url), target: "_blank", rel: "noopener noreferrer", 
                                    // mousedown is suppressed so the quick-add's outside-click handler
                                    // doesn't close the panel before the link opens.
                                    onMouseDown: (event) => event.stopPropagation(), className: "shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-black", "aria-label": "Open link in new tab", title: "Open in new tab", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ExternalLink, { size: 16 }) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: value.phone, onChange: (event) => onChange({ phone: event.target.value }), placeholder: "Add Phone", className: "min-w-0 flex-1 text-lg text-gray-400 outline-none placeholder:text-gray-300" }), value.phone.trim() ? ((0, jsx_runtime_1.jsx)("a", { href: `tel:${value.phone.replace(/[^\d+]/g, "")}`, onMouseDown: (event) => event.stopPropagation(), className: "shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-black", "aria-label": "Call this number", title: "Call", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Phone, { size: 16 }) })) : null] }), (0, jsx_runtime_1.jsx)("input", { value: value.address, onChange: (event) => onChange({ address: event.target.value }), placeholder: "Add Address", className: "w-full text-lg text-gray-400 outline-none placeholder:text-gray-300" })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t border-gray-100 pt-4", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => fileInputRef.current?.click(), className: "flex items-center gap-3 text-[18px] text-black", children: [(0, jsx_runtime_1.jsx)("span", { children: "Add Attachment" }), (0, jsx_runtime_1.jsx)(lucide_react_1.Paperclip, { size: 18 })] }), (0, jsx_runtime_1.jsx)("input", { ref: fileInputRef, type: "file", hidden: true, onChange: (event) => {
                            const file = event.target.files?.[0] ?? null;
                            if (!file) {
                                onChange({ attachmentFile: null, attachmentName: null, attachmentDataUrl: null });
                                return;
                            }
                            // Whitelist safe MIME types — block executables, scripts, and arbitrary HTML.
                            const ALLOWED_MIME_TYPES = [
                                "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
                                "application/pdf",
                                "text/plain",
                            ];
                            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                                onChange({ attachmentFile: file, attachmentName: `${file.name} (unsupported file type)`, attachmentDataUrl: null });
                                return;
                            }
                            // Cap at ~2MB so a base64 attachment can't blow the localStorage quota.
                            if (file.size > 2 * 1024 * 1024) {
                                onChange({ attachmentFile: file, attachmentName: `${file.name} (too large to store)`, attachmentDataUrl: null });
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => onChange({
                                attachmentFile: file,
                                attachmentName: file.name,
                                attachmentDataUrl: typeof reader.result === "string" ? reader.result : null,
                            });
                            reader.readAsDataURL(file);
                        } }), value.attachmentName ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white text-gray-400", children: value.attachmentFile?.type.startsWith("image/") && value.attachmentDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                (0, jsx_runtime_1.jsx)("img", { src: value.attachmentDataUrl, alt: value.attachmentName, className: "h-full w-full object-cover" })) : value.attachmentFile?.type === "application/pdf" ? ((0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { size: 15 })) : value.attachmentFile?.type.startsWith("image/") ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Image, { size: 15 })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.File, { size: 15 })) }), (0, jsx_runtime_1.jsx)("span", { className: "min-w-0 flex-1 truncate text-sm text-gray-500", children: value.attachmentName }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onChange({ attachmentFile: null, attachmentName: null, attachmentDataUrl: null }), className: "shrink-0 rounded-full p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-black", "aria-label": "Remove attachment", title: "Remove attachment", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 14 }) })] })) : null] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 border-t border-gray-100 pt-4", children: (0, jsx_runtime_1.jsx)("textarea", { ref: notesRef, value: value.notes, onChange: (event) => onChange({ notes: event.target.value }), placeholder: "Add Notes", className: "min-h-[36px] w-full resize-none overflow-hidden bg-transparent text-lg text-gray-500 outline-none placeholder:text-gray-300" }) })] }));
}

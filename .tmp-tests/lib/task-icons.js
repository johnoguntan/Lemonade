"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_ICON_LIBRARY = void 0;
exports.resolveTaskIcon = resolveTaskIcon;
exports.TaskIcon = TaskIcon;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
exports.TASK_ICON_LIBRARY = [
    { key: "star", label: "Star", Icon: lucide_react_1.Star },
    { key: "briefcase", label: "Work", Icon: lucide_react_1.Briefcase },
    { key: "home", label: "Home", Icon: lucide_react_1.Home },
    { key: "phone", label: "Call", Icon: lucide_react_1.Phone },
    { key: "mail", label: "Email", Icon: lucide_react_1.Mail },
    { key: "message", label: "Message", Icon: lucide_react_1.MessageCircle },
    { key: "shopping", label: "Shopping", Icon: lucide_react_1.ShoppingCart },
    { key: "dumbbell", label: "Workout", Icon: lucide_react_1.Dumbbell },
    { key: "book", label: "Read", Icon: lucide_react_1.BookOpen },
    { key: "plane", label: "Travel", Icon: lucide_react_1.Plane },
    { key: "gift", label: "Gift", Icon: lucide_react_1.Gift },
    { key: "heart", label: "Health", Icon: lucide_react_1.Heart },
    { key: "alarm", label: "Reminder", Icon: lucide_react_1.AlarmClock },
    { key: "utensils", label: "Food", Icon: lucide_react_1.Utensils },
    { key: "wrench", label: "Fix", Icon: lucide_react_1.Wrench },
];
// Maps the existing lowercase semantic keys (TaskIconKey) to components.
const SEMANTIC_ICONS = Object.fromEntries(exports.TASK_ICON_LIBRARY.map((entry) => [entry.key, entry.Icon]));
// The task-creation PriorityDropdown stores the raw lucide component name
// (PascalCase, e.g. "Star", "AlarmClock"). Map those names back to components so
// icons chosen during task creation actually render. Keyed by `Icon.name`.
const LUCIDE_NAME_ICONS = {
    AlarmClock: lucide_react_1.AlarmClock,
    CheckCircle: lucide_react_1.CheckCircle,
    Calendar: lucide_react_1.Calendar,
    Lock: lucide_react_1.Lock,
    Clock3: lucide_react_1.Clock3,
    Grid2x2: lucide_react_1.Grid2x2,
    Star: lucide_react_1.Star,
    Heart: lucide_react_1.Heart,
    Zap: lucide_react_1.Zap,
    Flag: lucide_react_1.Flag,
    Bookmark: lucide_react_1.Bookmark,
    Tag: lucide_react_1.Tag,
    Bell: lucide_react_1.Bell,
    MapPin: lucide_react_1.MapPin,
    Phone: lucide_react_1.Phone,
    Mail: lucide_react_1.Mail,
    Camera: lucide_react_1.Camera,
    Music: lucide_react_1.Music,
    ShoppingBag: lucide_react_1.ShoppingBag,
    Briefcase: lucide_react_1.Briefcase,
};
// Resolve an icon identifier (either a lowercase semantic key or a lucide
// component name) to its component, or null when unknown/unset.
function resolveTaskIcon(icon) {
    if (!icon)
        return null;
    return SEMANTIC_ICONS[icon] ?? LUCIDE_NAME_ICONS[icon] ?? null;
}
function TaskIcon({ icon, className }) {
    const Resolved = resolveTaskIcon(icon);
    if (!Resolved)
        return null;
    return (0, jsx_runtime_1.jsx)(Resolved, { className: className });
}

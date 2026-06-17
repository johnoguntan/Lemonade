"use client"

import {
  AlarmClock,
  Bell,
  Bookmark,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle,
  Clock3,
  Dumbbell,
  Flag,
  Gift,
  Grid2x2,
  Heart,
  Home,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Phone,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Utensils,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

export type TaskIconKey =
  | "star"
  | "briefcase"
  | "home"
  | "phone"
  | "mail"
  | "message"
  | "shopping"
  | "dumbbell"
  | "book"
  | "plane"
  | "gift"
  | "heart"
  | "alarm"
  | "utensils"
  | "wrench"

export const TASK_ICON_LIBRARY: Array<{ key: TaskIconKey; label: string; Icon: LucideIcon }> = [
  { key: "star", label: "Star", Icon: Star },
  { key: "briefcase", label: "Work", Icon: Briefcase },
  { key: "home", label: "Home", Icon: Home },
  { key: "phone", label: "Call", Icon: Phone },
  { key: "mail", label: "Email", Icon: Mail },
  { key: "message", label: "Message", Icon: MessageCircle },
  { key: "shopping", label: "Shopping", Icon: ShoppingCart },
  { key: "dumbbell", label: "Workout", Icon: Dumbbell },
  { key: "book", label: "Read", Icon: BookOpen },
  { key: "plane", label: "Travel", Icon: Plane },
  { key: "gift", label: "Gift", Icon: Gift },
  { key: "heart", label: "Health", Icon: Heart },
  { key: "alarm", label: "Reminder", Icon: AlarmClock },
  { key: "utensils", label: "Food", Icon: Utensils },
  { key: "wrench", label: "Fix", Icon: Wrench },
]

// Maps the existing lowercase semantic keys (TaskIconKey) to components.
const SEMANTIC_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  TASK_ICON_LIBRARY.map((entry) => [entry.key, entry.Icon])
)

// The task-creation PriorityDropdown stores the raw lucide component name
// (PascalCase, e.g. "Star", "AlarmClock"). Map those names back to components so
// icons chosen during task creation actually render. Keyed by `Icon.name`.
const LUCIDE_NAME_ICONS: Record<string, LucideIcon> = {
  AlarmClock,
  CheckCircle,
  Calendar,
  Lock,
  Clock3,
  Grid2x2,
  Star,
  Heart,
  Zap,
  Flag,
  Bookmark,
  Tag,
  Bell,
  MapPin,
  Phone,
  Mail,
  Camera,
  Music,
  ShoppingBag,
  Briefcase,
}

// Resolve an icon identifier (either a lowercase semantic key or a lucide
// component name) to its component, or null when unknown/unset.
export function resolveTaskIcon(icon: string | undefined): LucideIcon | null {
  if (!icon) return null
  return SEMANTIC_ICONS[icon] ?? LUCIDE_NAME_ICONS[icon] ?? null
}

export function TaskIcon({ icon, className }: { icon: string | undefined; className?: string }) {
  const Resolved = resolveTaskIcon(icon)
  if (!Resolved) return null
  return <Resolved className={className} />
}

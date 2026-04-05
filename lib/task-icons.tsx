"use client"

import {
  AlarmClock,
  BookOpen,
  Briefcase,
  Dumbbell,
  Gift,
  Heart,
  Home,
  Mail,
  MessageCircle,
  Phone,
  Plane,
  ShoppingCart,
  Star,
  Utensils,
  Wrench,
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

export function TaskIcon({ icon, className }: { icon: string | undefined; className?: string }) {
  if (!icon) return null
  switch (icon as TaskIconKey) {
    case "star":
      return <Star className={className} />
    case "briefcase":
      return <Briefcase className={className} />
    case "home":
      return <Home className={className} />
    case "phone":
      return <Phone className={className} />
    case "mail":
      return <Mail className={className} />
    case "message":
      return <MessageCircle className={className} />
    case "shopping":
      return <ShoppingCart className={className} />
    case "dumbbell":
      return <Dumbbell className={className} />
    case "book":
      return <BookOpen className={className} />
    case "plane":
      return <Plane className={className} />
    case "gift":
      return <Gift className={className} />
    case "heart":
      return <Heart className={className} />
    case "alarm":
      return <AlarmClock className={className} />
    case "utensils":
      return <Utensils className={className} />
    case "wrench":
      return <Wrench className={className} />
    default:
      return null
  }
}

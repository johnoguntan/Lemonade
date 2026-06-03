"use client"

import { Bell, Home, Search, Settings } from "lucide-react"

type SidebarIconName = "home" | "search" | "notifications" | "settings"

type SidebarIconsProps = {
  activeIcon: string
  onIconClick: (icon: SidebarIconName) => void
}

const icons: Array<{ key: SidebarIconName; icon: typeof Home }> = [
  { key: "home", icon: Home },
  { key: "search", icon: Search },
  { key: "notifications", icon: Bell },
  { key: "settings", icon: Settings },
]

export function SidebarIcons({ activeIcon, onIconClick }: SidebarIconsProps) {
  return (
    <div className="flex items-center gap-5 px-6 pt-9">
      {icons.map(({ key, icon: Icon }) => {
        const active = activeIcon === key

        return (
          <button
            key={key}
            type="button"
            onClick={() => onIconClick(key)}
            className="flex h-9 w-9 items-center justify-center text-[#555] transition-colors hover:text-white"
            aria-label={key}
          >
            <Icon size={22} strokeWidth={1.8} className={active ? "text-white" : "text-[#555]"} />
          </button>
        )
      })}
    </div>
  )
}

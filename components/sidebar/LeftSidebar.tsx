"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarWidget } from "@/components/sidebar/CalendarWidget"
import { HabitsTracker } from "@/components/sidebar/HabitsTracker"
import { JournalEntry } from "@/components/sidebar/JournalEntry"
import { SidebarIcons } from "@/components/sidebar/SidebarIcons"
import { SolairBoard } from "@/components/sidebar/SolairBoard"
import { useLemonadeStore } from "@/lib/store"

type SidebarIconName = "home" | "search" | "settings"

const iconRoutes: Record<SidebarIconName, string> = {
  home: "/",
  search: "/",
  settings: "/settings",
}

export function LeftSidebar() {
  const router = useRouter()
  const [activeIcon, setActiveIcon] = useState<SidebarIconName>("home")
  const selectedCalendarDate = useLemonadeStore((state) => state.selectedCalendarDate)
  const setSelectedCalendarDate = useLemonadeStore((state) => state.setSelectedCalendarDate)

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedCalendarDate.split("-").map(Number)
    return new Date(year, (month ?? 1) - 1, day ?? 1)
  }, [selectedCalendarDate])

  const handleIconClick = (icon: SidebarIconName) => {
    setActiveIcon(icon)
    if (icon === "search") {
      // Focus the in-view task search instead of navigating.
      window.dispatchEvent(new Event("allsenadro:focus-search"))
      return
    }
    router.push(iconRoutes[icon])
  }

  return (
    <aside className="h-full w-full overflow-y-auto bg-white text-white">
      <div className="bg-[#0f0f0f] pb-6">
        <SidebarIcons activeIcon={activeIcon} onIconClick={handleIconClick} />

        <div className="px-2 py-3">
          <CalendarWidget
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              const year = date.getFullYear()
              const month = `${date.getMonth() + 1}`.padStart(2, "0")
              const day = `${date.getDate()}`.padStart(2, "0")
              setSelectedCalendarDate(`${year}-${month}-${day}`)
            }}
          />
        </div>
      </div>

      <div className="min-h-[40%] bg-[radial-gradient(#d9d9d9_1.1px,transparent_1.1px)] [background-size:20px_20px] text-black">
        <div className="px-2 py-3">
          <SolairBoard />
        </div>

        <div className="px-2 py-3">
          <HabitsTracker />
        </div>

        <div className="px-2 py-3 pb-10">
          <JournalEntry />
        </div>
      </div>
    </aside>
  )
}

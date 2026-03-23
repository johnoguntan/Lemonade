"use client"

import { useEffect, useState } from "react"
import { parseLocalDateKey, formatLocalDateKey, useLemonadeStore } from "@/lib/store"
import { Header } from "@/components/lemonade/header"
import { PreferencesPanel } from "@/components/lemonade/preferences-panel"
import { CalendarView } from "@/components/lemonade/calendar-view"
import { ListsSection } from "@/components/lemonade/lists-section"
import { Footer } from "@/components/lemonade/footer"
import { DailyPlannerModal } from "@/components/lemonade/daily-planner-modal"
import { cn } from "@/lib/utils"

const textSizeMap = {
  sm: "[&_.lemonade-task-text]:text-sm",
  md: "[&_.lemonade-task-text]:text-base",
  lg: "[&_.lemonade-task-text]:text-lg",
} as const

const spacingMap = {
  compact: "[&_.lemonade-task-row]:h-[36px] [&_.lemonade-heading-row]:h-[36px] [&_.lemonade-subtask-row]:h-[40px]",
  normal: "[&_.lemonade-task-row]:h-[42px] [&_.lemonade-heading-row]:h-[40px] [&_.lemonade-subtask-row]:h-[48px]",
  comfortable: "[&_.lemonade-task-row]:h-[48px] [&_.lemonade-heading-row]:h-[44px] [&_.lemonade-subtask-row]:h-[56px]",
} as const

function getStartDate(startOnYesterday: boolean): Date {
  const today = new Date()
  if (startOnYesterday) {
    today.setDate(today.getDate() - 1)
  }
  return today
}

export default function Home() {
  const {
    preferences,
    sidebarOpen,
    autoRollover,
    generateRecurringInstances,
    selectedCalendarDate,
    setSelectedCalendarDate,
  } = useLemonadeStore()
  const startDate = parseLocalDateKey(selectedCalendarDate)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    autoRollover()
    generateRecurringInstances()
  }, [autoRollover, generateRecurringInstances])

  const handleNavigate = (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => {
    const newDate = new Date(startDate)
    switch (direction) {
      case 'prev-week':
        newDate.setDate(newDate.getDate() - 7)
        break
      case 'next-week':
        newDate.setDate(newDate.getDate() + 7)
        break
      case 'prev-day':
        newDate.setDate(newDate.getDate() - 1)
        break
      case 'next-day':
        newDate.setDate(newDate.getDate() + 1)
        break
      case 'today':
        setSelectedCalendarDate(formatLocalDateKey(new Date()))
        return
    }
    setSelectedCalendarDate(formatLocalDateKey(newDate))
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-2xl font-bold">
          LEMONADE<span className="text-yellow-500">*</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        backgroundImage: preferences.showDotGridBackground ? "var(--dot-grid)" : "none",
        backgroundSize: "24px 24px",
        backgroundRepeat: "repeat",
      }}
    >
      <PreferencesPanel />
      <DailyPlannerModal />
      
      <div className={cn(
        "relative min-h-screen transition-all duration-300",
        textSizeMap[preferences.textSize],
        spacingMap[preferences.spacing],
        sidebarOpen && "ml-72"
      )}>
        <Header onNavigate={handleNavigate} />
        
        <main className="flex flex-col">
          <CalendarView 
            startDate={startDate} 
            onNavigate={handleNavigate}
          />
        </main>

        <ListsSection />
        
        <Footer />
      </div>
    </div>
  )
}

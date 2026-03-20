"use client"

import { useState, useEffect } from "react"
import { useLemonadeStore } from "@/lib/store"
import { Header } from "@/components/lemonade/header"
import { PreferencesPanel } from "@/components/lemonade/preferences-panel"
import { CalendarView } from "@/components/lemonade/calendar-view"
import { ListsSection } from "@/components/lemonade/lists-section"
import { Footer } from "@/components/lemonade/footer"
import { DailyPlannerModal } from "@/components/lemonade/daily-planner-modal"
import { cn } from "@/lib/utils"

function getStartDate(startOnYesterday: boolean): Date {
  const today = new Date()
  if (startOnYesterday) {
    today.setDate(today.getDate() - 1)
  }
  return today
}

export default function Home() {
  const { preferences, sidebarOpen, autoRollover, generateRecurringInstances } = useLemonadeStore()
  const [startDate, setStartDate] = useState(() => getStartDate(preferences.startOnYesterday))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    autoRollover()
    generateRecurringInstances()
  }, [autoRollover, generateRecurringInstances])

  useEffect(() => {
    setStartDate(getStartDate(preferences.startOnYesterday))
  }, [preferences.startOnYesterday])

  const handleNavigate = (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => {
    setStartDate((prev) => {
      const newDate = new Date(prev)
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
          return getStartDate(preferences.startOnYesterday)
      }
      return newDate
    })
  }

  const handleJumpToDate = (date: Date) => {
    setStartDate(date)
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
    <div className="min-h-screen bg-background">
      <PreferencesPanel />
      <DailyPlannerModal />
      
      <div className={cn(
        "relative min-h-screen transition-all duration-300",
        sidebarOpen && "ml-72"
      )}>
        <Header currentDate={startDate} onNavigate={handleNavigate} onJumpToDate={handleJumpToDate} />
        
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

"use client"

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react"
import { parseLocalDateKey, formatLocalDateKey, useLemonadeStore } from "@/lib/store"
import { Header } from "@/components/lemonade/header"
import { PreferencesPanel } from "@/components/lemonade/preferences-panel"
import { CalendarView } from "@/components/lemonade/calendar-view"
import { TimelineView } from "@/components/lemonade/timeline-view"
import { TodayView } from "@/components/lemonade/today-view"
import { ListsSection } from "@/components/lemonade/lists-section"
import { Footer } from "@/components/lemonade/footer"
import { DailyPlannerModal } from "@/components/lemonade/daily-planner-modal"
import { ErrorBoundary } from "@/components/error-boundary"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const textSizeVars = {
  sm: {
    "--app-text-size": "12px",
    "--app-ui-text-size": "11px",
    "--app-heading-size": "17px",
    "--app-heading-line-height": "17px",
    "--app-date-size": "9px",
    "--app-tab-size": "9px",
  },
  md: {
    "--app-text-size": "14px",
    "--app-ui-text-size": "12px",
    "--app-heading-size": "20px",
    "--app-heading-line-height": "20px",
    "--app-date-size": "10px",
    "--app-tab-size": "10px",
  },
  lg: {
    "--app-text-size": "18px",
    "--app-ui-text-size": "14px",
    "--app-heading-size": "24px",
    "--app-heading-line-height": "24px",
    "--app-date-size": "12px",
    "--app-tab-size": "12px",
  },
} as const

const spacingVars = {
  compact: {
    "--app-task-row-height": "36px",
    "--app-heading-row-height": "36px",
    "--app-subtask-row-height": "40px",
    "--app-control-gap": "0.375rem",
    "--app-card-padding-y": "1rem",
    "--app-card-padding-x": "2rem",
    "--app-tab-padding-x": "0.625rem",
    "--app-tab-padding-y": "0.25rem",
    "--app-sidebar-padding": "1.25rem",
    "--app-footer-height": "44px",
  },
  normal: {
    "--app-task-row-height": "42px",
    "--app-heading-row-height": "40px",
    "--app-subtask-row-height": "48px",
    "--app-control-gap": "0.5rem",
    "--app-card-padding-y": "1.25rem",
    "--app-card-padding-x": "2.5rem",
    "--app-tab-padding-x": "0.75rem",
    "--app-tab-padding-y": "0.375rem",
    "--app-sidebar-padding": "1.5rem",
    "--app-footer-height": "48px",
  },
  comfortable: {
    "--app-task-row-height": "48px",
    "--app-heading-row-height": "44px",
    "--app-subtask-row-height": "56px",
    "--app-control-gap": "0.625rem",
    "--app-card-padding-y": "1.5rem",
    "--app-card-padding-x": "3rem",
    "--app-tab-padding-x": "0.875rem",
    "--app-tab-padding-y": "0.5rem",
    "--app-sidebar-padding": "1.75rem",
    "--app-footer-height": "52px",
  },
} as const

export default function Home() {
  const {
    preferences,
    sidebarOpen,
    autoRollover,
    lastAutoMovedCount,
    clearLastAutoMovedCount,
    generateRecurringInstances,
    selectedCalendarDate,
    setSelectedCalendarDate,
    weekCount,
  } = useLemonadeStore()
  const [viewMode, setViewMode] = useState<"calendar" | "timeline" | "today">("calendar")
  const startDate = parseLocalDateKey(selectedCalendarDate)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const appPreferenceVars = {
    ...textSizeVars[preferences.textSize],
    ...spacingVars[preferences.spacing],
  } as CSSProperties

  useEffect(() => {
    autoRollover()
    generateRecurringInstances()
  }, [autoRollover, generateRecurringInstances])

  useEffect(() => {
    if (lastAutoMovedCount <= 0) {
      return
    }

    toast(
      lastAutoMovedCount === 1
        ? "1 task moved from yesterday."
        : `${lastAutoMovedCount} tasks moved from earlier days.`,
      { duration: 3000 }
    )
    clearLastAutoMovedCount()
  }, [clearLastAutoMovedCount, lastAutoMovedCount])

  const handleNavigate = (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => {
    const newDate = new Date(startDate)
    const dynamicWeekStep = weekCount * 7
    switch (direction) {
      case 'prev-week':
        newDate.setDate(newDate.getDate() - dynamicWeekStep)
        break
      case 'next-week':
        newDate.setDate(newDate.getDate() + dynamicWeekStep)
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

  const handleViewModeChange = (mode: "calendar" | "timeline" | "today") => {
    if (mode === "today") {
      setSelectedCalendarDate(formatLocalDateKey(new Date()))
    }

    setViewMode(mode)
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
      <ErrorBoundary>
        <PreferencesPanel />
      </ErrorBoundary>
      <ErrorBoundary>
        <DailyPlannerModal />
      </ErrorBoundary>
      
      <div className={cn(
        "lemonade-app-root relative min-h-screen transition-all duration-300",
        sidebarOpen && "ml-72"
      )}
      style={appPreferenceVars}>
        <Header onNavigate={handleNavigate} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        
        <main className="flex flex-col pb-6">
          <ErrorBoundary>
            {viewMode === "calendar" ? (
              <CalendarView 
                startDate={startDate} 
                onNavigate={handleNavigate}
              />
            ) : viewMode === "timeline" ? (
              <TimelineView
                date={startDate}
                onNavigate={handleNavigate}
              />
            ) : (
              <TodayView />
            )}
          </ErrorBoundary>
        </main>

        <ListsSection />
        
        <Footer onNavigate={handleNavigate} />
      </div>
    </div>
  )
}

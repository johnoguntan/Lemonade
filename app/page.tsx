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
    "--app-text-size": "13px",
    "--app-ui-text-size": "12px",
    "--app-heading-size": "19px",
    "--app-heading-line-height": "19px",
    "--app-date-size": "10px",
    "--app-tab-size": "10px",
  },
  md: {
    "--app-text-size": "17px",
    "--app-ui-text-size": "14px",
    "--app-heading-size": "26px",
    "--app-heading-line-height": "26px",
    "--app-date-size": "12px",
    "--app-tab-size": "12px",
  },
  lg: {
    "--app-text-size": "21px",
    "--app-ui-text-size": "16px",
    "--app-heading-size": "30px",
    "--app-heading-line-height": "30px",
    "--app-date-size": "14px",
    "--app-tab-size": "14px",
  },
} as const

const spacingVars = {
  compact: {
    "--app-task-row-height": "40px",
    "--app-heading-row-height": "40px",
    "--app-subtask-row-height": "44px",
    "--app-control-gap": "0.375rem",
    "--app-card-padding-y": "1rem",
    "--app-card-padding-x": "2rem",
    "--app-tab-padding-x": "0.625rem",
    "--app-tab-padding-y": "0.25rem",
    "--app-sidebar-padding": "1.25rem",
    "--app-footer-height": "44px",
  },
  normal: {
    "--app-task-row-height": "50px",
    "--app-heading-row-height": "48px",
    "--app-subtask-row-height": "56px",
    "--app-control-gap": "0.5rem",
    "--app-card-padding-y": "1.25rem",
    "--app-card-padding-x": "2.5rem",
    "--app-tab-padding-x": "0.75rem",
    "--app-tab-padding-y": "0.375rem",
    "--app-sidebar-padding": "1.5rem",
    "--app-footer-height": "48px",
  },
  comfortable: {
    "--app-task-row-height": "58px",
    "--app-heading-row-height": "54px",
    "--app-subtask-row-height": "64px",
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
  } = useLemonadeStore()
  const [viewMode, setViewMode] = useState<"calendar" | "timeline" | "today">("calendar")
  const startDate = parseLocalDateKey(selectedCalendarDate)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const appPreferenceVars: CSSProperties & Record<string, string> = {
    ...textSizeVars[preferences.textSize],
    ...spacingVars[preferences.spacing],
    "--notebook-desk-bg": preferences.theme === "dark" ? "#131313" : "#d1d5db",
    "--notebook-paper-bg": preferences.theme === "dark" ? "#060606" : "#ffffff",
    "--notebook-dot-grid": preferences.showDotGridBackground
      ? preferences.theme === "dark"
        ? "radial-gradient(rgba(136, 142, 150, 0.42) 0.8px, transparent 0.8px)"
        : "radial-gradient(#9c978f88 0.8px, transparent 0.8px)"
      : "none",
    "--notebook-page-divider": preferences.theme === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.04)",
  }

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
    const dynamicWeekStep = 7
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
      style={{
        ...appPreferenceVars,
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(to right, #f3f3f3 0 50%, #e6e6e6 50% 100%)",
      }}
    >
      <ErrorBoundary>
        <PreferencesPanel />
      </ErrorBoundary>
      <ErrorBoundary>
        <DailyPlannerModal />
      </ErrorBoundary>

      <div
        className={cn("absolute left-1/2 top-1/2 transition-all duration-300", sidebarOpen && "ml-72")}
        style={{
          width: "min(calc(100vw - 6px), calc((100vh - 6px) * 2510 / 1696))",
          aspectRatio: "2510 / 1696",
          transform: "translate(-50%, -50%)",
          zIndex: 1,
        }}
      >
        <div
          className="notebook-bg"
          style={{
            position: "absolute",
            inset: 0,
            backgroundSize: "101.35% 100.2%",
            backgroundPosition: "50.65% center",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div
          className="lemonade-app-root notebook-panel"
          style={{
            position: "absolute",
            top: "7.25%",
            left: "15.5%",
            width: "35.5%",
            height: "83.5%",
            overflowY: "auto",
            zIndex: 1,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <Header onNavigate={handleNavigate} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
          </div>
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
        </div>

        <div
          className="lemonade-app-root notebook-panel notebook-panel-right [&>*]:border-t-0 [&>*]:pt-0"
          style={{
            position: "absolute",
            top: "7.25%",
            left: "53.2%",
            width: "calc(32.2% + 18px)",
            height: "83.5%",
            paddingLeft: "0.2%",
            paddingRight: "0%",
            boxSizing: "border-box",
            overflowY: "auto",
            zIndex: 1,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <ListsSection />
        </div>

        <div
          className="lemonade-app-root"
          style={{
            position: "absolute",
            bottom: "5.15%",
            left: "15.5%",
            width: "68%",
            zIndex: 1,
          }}
        >
          <Footer
            onNavigate={handleNavigate}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        </div>
      </div>
    </div>
  )
}

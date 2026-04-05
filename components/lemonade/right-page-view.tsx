"use client"

import { Clock3, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLemonadeStore } from "@/lib/store"
import { ListsSection } from "./lists-section"
import { TimelineView } from "./timeline-view"

interface RightPageViewProps {
  startDate: Date
  onNavigate: (direction: "prev-week" | "next-week" | "prev-day" | "next-day" | "today") => void
}

export function RightPageView({ startDate, onNavigate }: RightPageViewProps) {
  const { rightPageViewMode, setRightPageViewMode } = useLemonadeStore()

  return (
    <div className="relative flex flex-col">
      {/* Manual toggle for right page modes (kept on the right page) */}
      <div className="sticky top-0 z-30 flex justify-end px-4 pt-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setRightPageViewMode("project")
            }}
            className={cn(
              "size-8 rounded-full",
              rightPageViewMode === "project"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Project view"
          >
            <FolderOpen className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setRightPageViewMode("calendar")
            }}
            className={cn(
              "size-8 rounded-full",
              rightPageViewMode === "calendar"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Calendar view"
          >
            <Clock3 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {rightPageViewMode === "calendar" ? (
          <TimelineView date={startDate} onNavigate={onNavigate} />
        ) : (
          <ListsSection />
        )}
      </div>
    </div>
  )
}

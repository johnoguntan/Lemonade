"use client"

import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLemonadeStore } from "@/lib/store"
import { useState } from "react"

interface HeaderProps {
  currentDate: Date
  onNavigate: (direction: 'prev-week' | 'next-week' | 'prev-day' | 'next-day' | 'today') => void
  onJumpToDate: (date: Date) => void
}

export function Header({ currentDate, onNavigate, onJumpToDate }: HeaderProps) {
  const { searchQuery, setSearchQuery } = useLemonadeStore()
  const [showSearch, setShowSearch] = useState(false)

  const isTodayVisible = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const startDate = new Date(currentDate)
    startDate.setHours(0, 0, 0, 0)
    
    return today.getTime() === startDate.getTime()
  }

  return (
    <header
      className="flex items-center justify-between border-t-2 bg-background px-4 py-3 dark:bg-[#131313]"
      style={{ borderTopColor: "var(--accent-color)" }}
    >
      <div className="flex flex-1 items-center gap-2">
        {showSearch ? (
          <div className="flex h-10 w-full items-center gap-3 bg-[#f7f8fa] px-4 text-muted-foreground">
            <Search className="size-[15px] shrink-0" />
            <Input
              placeholder="Search for a to-do"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 text-[12px] text-foreground shadow-none focus-visible:ring-0"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(false)}
              className="ml-auto size-7 text-muted-foreground hover:text-foreground"
            >
              <span className="text-[18px] leading-none">×</span>
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(true)}
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <Search className="size-[15px]" />
            </Button>
            {!isTodayVisible() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('today')}
                className="h-8 px-3 text-[12px] font-medium bg-[#f5f5f5] border-transparent text-black transition-colors hover:bg-black hover:text-white dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white"
              >
                TODAY
              </Button>
            )}
          </>
        )}
      </div>

      {!showSearch ? (
        <div 
          style={{ 
            fontFamily: '"Alternate Gothic No2 D", "Arial Narrow", "Roboto Condensed", sans-serif',
            fontStyle: 'normal',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '16px',
            color: 'var(--accent-color)'
          }}
          className="font-logo uppercase"
        >
          LEMONADE<span style={{ color: 'var(--accent-color)' }}>*</span>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {!showSearch ? (
        <div className="flex flex-1 items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('prev-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronsLeft className="size-4" strokeWidth={2.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('prev-day')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" strokeWidth={2.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('next-day')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" strokeWidth={2.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('next-week')}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronsRight className="size-4" strokeWidth={2.75} />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 size-8 text-muted-foreground hover:text-foreground"
              >
                <CalendarIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={10} className="w-auto rounded-2xl border-0 p-0 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
              <Calendar
                mode="single"
                selected={currentDate}
                month={currentDate}
                onSelect={(date) => {
                  if (date) {
                    onJumpToDate(date)
                  }
                }}
                className="rounded-2xl border-b-4 border-b-sky-300 bg-white p-4"
                classNames={{
                  month_caption: "flex items-center justify-center h-10 w-full px-10",
                  caption_label: "text-[14px] font-semibold uppercase tracking-[0.14em]",
                  nav: "absolute inset-x-0 top-4 flex items-center justify-between px-4",
                  button_previous: "h-8 w-8 rounded-full text-foreground hover:bg-muted",
                  button_next: "h-8 w-8 rounded-full text-foreground hover:bg-muted",
                  weekdays: "mb-2 mt-3 grid grid-cols-7",
                  weekday: "text-center text-[12px] font-semibold uppercase text-foreground",
                  week: "mt-0 grid grid-cols-7",
                  day: "aspect-square p-0",
                  day_button: "h-12 w-12 rounded-none text-base font-semibold text-foreground hover:bg-muted/50",
                  today: "bg-transparent text-foreground",
                  selected: "bg-sky-300 text-white hover:bg-sky-300",
                  outside: "text-muted-foreground/40",
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </header>
  )
}

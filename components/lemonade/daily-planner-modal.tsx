"use client"

import { useState, useEffect } from "react"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Trash2, MoveRight, CheckCircle2 } from "lucide-react"

export function DailyPlannerModal() {
  const { calendarTodos, moveTodoToDate, deleteCalendarTodo, addCalendarTodo } = useLemonadeStore()
  const [isOpen, setIsOpen] = useState(false)
  const [priorities, setPriorities] = useState(["", "", ""])
  
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  useEffect(() => {
    const lastPlannerDate = localStorage.getItem('lemonade-last-planner')
    if (lastPlannerDate !== todayStr) {
      setIsOpen(true)
    }
  }, [todayStr])

  const yesterdayUnfinished = calendarTodos.filter(
    todo => todo.date === yesterdayStr && !todo.completed && !todo.isHeading && !todo.parentId
  )

  const todaySchedule = calendarTodos.filter(
    todo => todo.date === todayStr && !todo.isHeading
  )

  const handleStartDay = () => {
    priorities.forEach(text => {
      if (text.trim()) {
        addCalendarTodo({
          text: text.trim(),
          completed: false,
          date: todayStr,
          priority: 'high'
        })
      }
    })
    
    localStorage.setItem('lemonade-last-planner', todayStr)
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-background border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-border/50 text-center">
          <h1 className="text-4xl font-bold mb-2">Good Morning ☀️</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-medium">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Section 1: Yesterday's unfinished */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-border"></span>
              Yesterday's Unfinished
            </h2>
            <div className="space-y-2">
              {yesterdayUnfinished.length > 0 ? (
                yesterdayUnfinished.map(todo => (
                  <div key={todo.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                    <span className="text-sm">{todo.text}</span>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] uppercase font-bold hover:bg-[var(--accent-color)] hover:text-white"
                        onClick={() => moveTodoToDate(todo.id, todayStr)}
                      >
                        <MoveRight className="size-3 mr-1" /> Move to Today
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] uppercase font-bold hover:bg-destructive hover:text-white"
                        onClick={() => deleteCalendarTodo(todo.id)}
                      >
                        <Trash2 className="size-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground font-medium">
                  You crushed yesterday 🎉
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Today's schedule */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-border"></span>
              Today's Schedule
            </h2>
            <div className="space-y-1">
              {todaySchedule.length > 0 ? (
                todaySchedule.map(todo => (
                  <div key={todo.id} className="flex items-center gap-3 p-2 text-sm opacity-70">
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                    <span>{todo.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-sm text-muted-foreground italic">
                  No tasks scheduled yet
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Top 3 priorities */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-8 h-px bg-border"></span>
              Top 3 Priorities
            </h2>
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-xl font-bold text-muted-foreground/30">{i + 1}</span>
                  <Input 
                    placeholder="Focus on..."
                    value={priorities[i]}
                    onChange={(e) => {
                      const newPriorities = [...priorities]
                      newPriorities[i] = e.target.value
                      setPriorities(newPriorities)
                    }}
                    className="h-12 bg-muted/20 border-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] text-base"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-border/50">
          <Button 
            className="w-full h-14 text-lg font-bold bg-[var(--accent-color)] hover:opacity-90 transition-opacity text-white rounded-xl"
            onClick={handleStartDay}
          >
            Start My Day <ArrowRight className="ml-2 size-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

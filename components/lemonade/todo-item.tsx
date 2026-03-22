"use client"

import { useState } from "react"
import { useLemonadeStore, type Todo, type SubTask } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, RotateCcw, Plus, Minus, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

interface TodoItemProps {
  todo: Todo
  textSizeClass: string
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
}

export function TodoItem({
  todo,
  textSizeClass,
  draggable = false,
  onDragStart,
  onDragEnd,
}: TodoItemProps) {
  const { 
    preferences, 
    toggleCalendarTodo, 
    updateCalendarTodo, 
    deleteCalendarTodo,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    tags,
  } = useLemonadeStore()
  const colorPalette = preferences.colorPalette ?? []
  
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [newSubtaskText, setNewSubtaskText] = useState("")

  const recurringValue = todo.isRecurring ? (todo.recurringFrequency || "daily") : "off"

  const bulletIcon = {
    none: null,
    dot: <span className="mr-2">•</span>,
    dash: <span className="mr-2">-</span>,
    arrow: <span className="mr-2">→</span>,
  }[preferences.bulletStyle]

  const priorityIndicator = {
    high: <span className="size-2 rounded-full bg-red-500 mr-2 flex-shrink-0" />,
    medium: <span className="size-2 rounded-full bg-orange-500 mr-2 flex-shrink-0" />,
    low: <span className="size-2 rounded-full bg-blue-500 mr-2 flex-shrink-0" />,
    none: null,
  }[todo.priority || 'none']

  const handleSave = () => {
    if (editText.trim()) {
      const isHeading = editText === editText.toUpperCase() && editText.length > 2
      updateCalendarTodo(todo.id, { text: editText.trim(), isHeading })
    }
    setIsEditing(false)
  }

  const handleAddSubtask = () => {
    if (newSubtaskText.trim()) {
      addSubtask(todo.id, newSubtaskText.trim())
      setNewSubtaskText("")
    }
  }

  const toggleTag = (tagId: string) => {
    const currentTags = todo.tags || []
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId]
    updateCalendarTodo(todo.id, { tags: newTags })
  }

  if (todo.isHeading) {
    return (
      <div 
        className={cn(
          "font-bold uppercase tracking-wide h-[40px] border-b border-border/50 flex items-center px-2",
          textSizeClass
        )}
        style={{ backgroundColor: todo.color }}
      >
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full bg-transparent outline-none"
            autoFocus
          />
        ) : (
          <span onClick={() => setIsEditing(true)} className="cursor-text">
            {todo.text}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className="group relative"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div 
        className={cn(
          "flex items-center h-[42px] border-b border-border/60 px-0 transition-colors",
          todo.completed && "bg-transparent"
        )}
        style={{ backgroundColor: todo.color }}
      >
        <div className="flex items-center justify-center w-5 mr-2">
          <button
            onClick={() => toggleCalendarTodo(todo.id)}
            className={cn(
              "size-4 rounded-full border transition-all flex items-center justify-center shrink-0",
              todo.completed 
                ? "bg-[var(--accent-color)] border-[var(--accent-color)] opacity-100" 
                : "border-[var(--accent-color)] opacity-0 group-hover:opacity-100"
            )}
            style={{ borderColor: todo.completed ? 'var(--accent-color)' : 'rgba(var(--accent-color-rgb), 0.3)' }}
          >
            {todo.completed && (
              <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center">
            {priorityIndicator}
            {isEditing ? (
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className={cn(
                  "w-full bg-transparent outline-none font-task font-normal text-[14px] leading-[1.15] text-[#000000] dark:text-foreground",
                  todo.completed && "line-through opacity-40"
                )}
                autoFocus
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className={cn(
                  "cursor-text block font-task font-normal text-[14px] leading-[1.15] text-[#000000] dark:text-foreground",
                  todo.completed && "line-through opacity-40"
                )}
              >
                {bulletIcon}
                {todo.text}
                {todo.isRecurring && (
                  <RotateCcw className="inline size-3 ml-1 text-muted-foreground" />
                )}
              </span>
            )}
          </div>
          {/* Tag Pills */}
          {todo.tags && todo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {todo.tags.map(tagId => {
                const tag = tags.find(t => t.id === tagId)
                if (!tag) return null
                return (
                  <span 
                    key={tagId} 
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white shadow-sm"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-transparent"
              >
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowSubtasks(true)}>
                <Plus className="size-4 mr-2" />
                Add subtask
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RotateCcw className="size-4 mr-2" />
                  Recurring
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Repeat</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={recurringValue}>
                    <DropdownMenuRadioItem
                      value="off"
                      onSelect={() => updateCalendarTodo(todo.id, {
                        isRecurring: false,
                        recurringFrequency: undefined,
                        recurringDays: undefined,
                      })}
                    >
                      Off
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="daily"
                      onSelect={() => updateCalendarTodo(todo.id, {
                        isRecurring: true,
                        recurringFrequency: "daily",
                        recurringDays: undefined,
                      })}
                    >
                      Daily
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="weekday"
                      onSelect={() => updateCalendarTodo(todo.id, {
                        isRecurring: true,
                        recurringFrequency: "weekday",
                        recurringDays: undefined,
                      })}
                    >
                      Weekdays
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="weekly"
                      onSelect={() => updateCalendarTodo(todo.id, {
                        isRecurring: true,
                        recurringFrequency: "weekly",
                        recurringDays: undefined,
                      })}
                    >
                      Weekly
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="monthly"
                      onSelect={() => updateCalendarTodo(todo.id, {
                        isRecurring: true,
                        recurringFrequency: "monthly",
                        recurringDays: undefined,
                      })}
                    >
                      Monthly
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Priority</div>
              <div className="flex gap-1 px-2 pb-2">
                {(['none', 'low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateCalendarTodo(todo.id, { priority: p })}
                    className={cn(
                      "px-2 py-1 text-[10px] rounded border border-border capitalize transition-colors",
                      todo.priority === p || (!todo.priority && p === 'none')
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Tags</div>
              <div className="px-2 pb-2">
                <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                          todo.tags?.includes(tag.id)
                            ? "text-white"
                            : "bg-transparent text-muted-foreground hover:text-foreground border-border"
                        )}
                        style={{ 
                          backgroundColor: todo.tags?.includes(tag.id) ? tag.color : 'transparent',
                          borderColor: todo.tags?.includes(tag.id) ? tag.color : undefined
                        }}
                      >
                        {tag.name}
                      </button>
                    ))
                  ) : (
                    <div className="text-[10px] text-muted-foreground italic">No tags created yet</div>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium">Color</div>
              <div className="flex gap-1 px-2 pb-2">
                <button
                  onClick={() => updateCalendarTodo(todo.id, { color: undefined })}
                  className={cn(
                    "size-5 rounded border border-border bg-transparent",
                    !todo.color && "ring-2 ring-foreground"
                  )}
                  title="None"
                />
                {colorPalette.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateCalendarTodo(todo.id, { color: hex })}
                    className={cn(
                      "size-5 rounded border border-border",
                      todo.color === hex && "ring-2 ring-foreground"
                    )}
                    style={{ backgroundColor: hex }}
                    title={hex.toUpperCase()}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteCalendarTodo(todo.id)}
            className="size-7 text-muted-foreground hover:text-destructive hover:bg-transparent group/delete"
          >
            <Minus className="size-4 group-hover/delete:hidden" />
            <X className="size-4 hidden group-hover/delete:block" />
          </Button>
        </div>
      </div>

      {/* Subtasks */}
      {showSubtasks && (
        <div className="ml-0">
          {todo.subtasks.map((subtask) => (
            <div key={subtask.id} className="h-[48px] border-b border-border/60 flex items-center gap-2 px-0 pl-7 group/subtask transition-colors">
              <button
                onClick={() => toggleSubtask(todo.id, subtask.id)}
                className={cn(
                  "size-4 rounded-full border border-border flex-shrink-0 flex items-center justify-center",
                  subtask.completed && "bg-foreground border-foreground"
                )}
              >
                {subtask.completed && (
                  <svg className="size-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={cn(
                "flex-1 font-task font-normal text-[14px] leading-[16.3338px] text-[#000000] dark:text-foreground",
                subtask.completed && "line-through opacity-50"
              )}>
                {subtask.text}
              </span>
              <button
                onClick={() => deleteSubtask(todo.id, subtask.id)}
                className="opacity-0 group-hover/subtask:opacity-100 text-muted-foreground hover:text-destructive group/sub-delete"
              >
                <Minus className="size-3 group-hover/sub-delete:hidden" />
                <X className="size-3 hidden group-hover/sub-delete:block" />
              </button>
            </div>
          ))}
          <div className="h-[48px] border-b border-border/60 flex items-center gap-2 px-0 pl-7">
            <Plus className="size-3 text-muted-foreground" />
            <input
              type="text"
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Add subtask..."
              className="bg-transparent outline-none flex-1 font-task font-normal text-[14px] leading-[1.15] text-[#000000] dark:text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  )
}

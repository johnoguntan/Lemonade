"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { TASK_ICON_LIBRARY, TaskIcon } from "@/lib/task-icons"
import { Shapes } from "lucide-react"
import { useState } from "react"

export function IconPicker({
  value,
  onChange,
  className,
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8 text-muted-foreground hover:text-foreground", className, value && "text-foreground")}
          aria-label="Pick an icon"
          title="Pick an icon"
          onMouseDown={(event) => event.preventDefault()}
        >
          {value ? <TaskIcon icon={value} className="size-4" /> : <Shapes className="size-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={10}
        className="z-50 w-[280px] border border-border border-b-[4px] border-b-[var(--accent-color)] p-3 shadow-md"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Icon</div>
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              className="text-[10px] font-medium text-foreground/80 hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {TASK_ICON_LIBRARY.map(({ key, label, Icon }) => {
            const selected = value === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                }}
                className={cn(
                  "flex items-center justify-center rounded-lg border border-border/70 p-2 transition-colors hover:bg-muted",
                  selected && "border-transparent bg-foreground text-background hover:bg-foreground"
                )}
                title={label}
                aria-label={label}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}


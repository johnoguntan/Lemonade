"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Printer } from "lucide-react"

type StatusFilter = "all" | "incomplete" | "completed"
type PriorityFilter = "all" | "high" | "medium" | "low"

interface PrintPreviewDialogProps {
  selectedDate: string
}

interface PrintableEntry {
  id: string
  source: "calendar" | "list" | "shopping-returns"
  title: string
  date: string
  time?: string
  completed: boolean
  priority?: Todo["priority"]
  labelIds: string[]
  subtasks: Todo["subtasks"]
  storeName?: string
  returnDeadline?: string
  notes?: string
}

const formatRangeLabel = (from: string, to: string) => {
  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })

  return from === to ? formatDate(from) : `${formatDate(from)} - ${formatDate(to)}`
}

const formatDayHeading = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

export function PrintPreviewDialog({ selectedDate }: PrintPreviewDialogProps) {
  const { calendarTodos, lists, labels } = useLemonadeStore()
  const [open, setOpen] = useState(false)
  const [fromDate, setFromDate] = useState(selectedDate)
  const [toDate, setToDate] = useState(selectedDate)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [includeShoppingReturns, setIncludeShoppingReturns] = useState(true)
  const [includeBottomListItems, setIncludeBottomListItems] = useState(false)

  const printableEntries = useMemo(() => {
    const calendarEntries: PrintableEntry[] = calendarTodos.map((todo) => ({
      id: todo.id,
      source: "calendar",
      title: todo.text,
      date: todo.date ?? "",
      time: todo.time,
      completed: todo.completed,
      priority: todo.priority,
      labelIds: todo.labelIds,
      subtasks: todo.subtasks,
    }))

    const listEntries: PrintableEntry[] = lists.flatMap((list) =>
      list.todos.map((todo) => ({
        id: `${list.id}:${todo.id}`,
        source: list.type === "shopping-returns" ? "shopping-returns" : "list",
        title: todo.text,
        date: (list.type === "shopping-returns" ? todo.returnDeadline ?? todo.date : todo.date) ?? "",
        time: todo.time,
        completed: todo.completed,
        priority: todo.priority,
        labelIds: todo.labelIds,
        subtasks: todo.subtasks,
        storeName: todo.storeName,
        returnDeadline: todo.returnDeadline,
        notes: todo.notes,
      }))
    )

    return [...calendarEntries, ...listEntries]
      .filter((entry) => {
        if (!includeBottomListItems && entry.source === "list") return false
        if (!includeShoppingReturns && entry.source === "shopping-returns") return false
        if (!entry.date) return false
        if (entry.date < fromDate || entry.date > toDate) return false
        if (selectedLabelIds.length > 0 && !entry.labelIds.some((labelId) => selectedLabelIds.includes(labelId))) return false
        if (priorityFilter !== "all" && entry.priority !== priorityFilter) return false
        if (statusFilter === "incomplete" && entry.completed) return false
        if (statusFilter === "completed" && !entry.completed) return false
        return true
      })
      .sort((left, right) => {
        if (left.date !== right.date) return left.date.localeCompare(right.date)
        return (left.time ?? "").localeCompare(right.time ?? "")
      })
  }, [calendarTodos, fromDate, includeBottomListItems, includeShoppingReturns, lists, priorityFilter, selectedLabelIds, statusFilter, toDate])

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, PrintableEntry[]>()
    for (const entry of printableEntries) {
      const existing = groups.get(entry.date) ?? []
      existing.push(entry)
      groups.set(entry.date, existing)
    }
    return [...groups.entries()]
  }, [printableEntries])

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    )
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" title="Print view">
          <Printer className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl p-0 print:shadow-none">
        <div className="print-controls border-b border-border/70 p-6">
          <DialogHeader className="mb-5">
            <DialogTitle>Print Preview</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">From</span>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">To</span>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Priority</span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none"
              >
                <option value="all">All</option>
                <option value="incomplete">Incomplete only</option>
                <option value="completed">Completed only</option>
              </select>
            </label>
            <label className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm">
              <span>Include Shopping Returns</span>
              <input type="checkbox" checked={includeShoppingReturns} onChange={(event) => setIncludeShoppingReturns(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm">
              <span>Include bottom list items</span>
              <input type="checkbox" checked={includeBottomListItems} onChange={(event) => setIncludeBottomListItems(event.target.checked)} />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm text-muted-foreground">Labels</div>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={cn(
                    "rounded-full border px-2 py-1 text-[11px] transition-colors",
                    selectedLabelIds.includes(label.id)
                      ? "border-transparent bg-foreground text-background"
                      : "border-border text-foreground"
                  )}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          <div className="print-root rounded-xl border border-border/70 bg-background p-6">
            <div className="mb-6 border-b border-border pb-4">
              <h1 className="font-heading text-[28px] uppercase tracking-[-0.04em]">Lemonade</h1>
              <p className="mt-2 text-sm text-muted-foreground">{formatRangeLabel(fromDate, toDate)}</p>
            </div>

            {groupedEntries.length > 0 ? (
              <div className="space-y-6">
                {groupedEntries.map(([date, entries]) => (
                  <section key={date}>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {formatDayHeading(date)}
                    </h2>
                    <div className="space-y-2">
                      {entries.map((entry) => {
                        const labelNames = entry.labelIds
                          .map((labelId) => labels.find((label) => label.id === labelId)?.name)
                          .filter((value): value is string => Boolean(value))
                        const completedSubtasks = entry.subtasks.filter((subtask) => subtask.completed).length

                        return (
                          <div key={entry.id} className="rounded-lg border border-border/70 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={cn("text-sm font-medium", entry.completed && "line-through")}>
                                  {entry.title}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  {entry.time ? <span>{entry.time}</span> : null}
                                  {entry.priority ? <span>Priority: {entry.priority}</span> : null}
                                  {labelNames.length > 0 ? <span>Labels: {labelNames.join(", ")}</span> : null}
                                  {entry.subtasks.length > 0 ? (
                                    <span>
                                      Subtasks: {completedSubtasks}/{entry.subtasks.length}
                                    </span>
                                  ) : null}
                                  {entry.source === "shopping-returns" && entry.storeName ? <span>Store: {entry.storeName}</span> : null}
                                  {entry.source === "shopping-returns" && entry.returnDeadline ? <span>Return by: {entry.returnDeadline}</span> : null}
                                </div>
                                {entry.source === "shopping-returns" && entry.notes ? (
                                  <div className="mt-2 text-[11px] text-muted-foreground">{entry.notes}</div>
                                ) : null}
                              </div>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                {entry.source === "shopping-returns" ? "Shopping Returns" : entry.source === "list" ? "List" : "Calendar"}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                No items match the current print filters.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="print-controls border-t border-border/70 px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-1 size-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

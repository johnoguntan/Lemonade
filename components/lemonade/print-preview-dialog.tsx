"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Printer } from "lucide-react"

type StatusFilter = "all" | "incomplete" | "completed"
type PriorityFilter = "all" | "urgent" | "important" | "normal"
type PrintLayoutMode = "by-date" | "by-group"
type GroupingMode = "priority" | "label"

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

interface DayPrintGroup {
  date: string
  entries: PrintableEntry[]
}

interface SectionedDayPrintGroup extends DayPrintGroup {
  sections: Array<{ key: string; title: string; entries: PrintableEntry[] }>
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

const formatDayMeta = (value: string) => {
  const date = new Date(`${value}T00:00:00`)

  return {
    dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
    dateLabel: date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  }
}

const PRIORITY_SECTION_ORDER: Array<NonNullable<Todo["priority"]>> = ["urgent", "important", "normal"]

const PRIORITY_SECTION_LABEL: Record<NonNullable<Todo["priority"]>, string> = {
  urgent: "Urgent",
  important: "Important",
  normal: "Normal",
}

const buildDayGroups = (entries: PrintableEntry[]): DayPrintGroup[] => {
  const groups = new Map<string, PrintableEntry[]>()

  for (const entry of entries) {
    const existing = groups.get(entry.date) ?? []
    existing.push(entry)
    groups.set(entry.date, existing)
  }

  return [...groups.entries()].map(([date, groupedEntries]) => ({
    date,
    entries: groupedEntries,
  }))
}

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
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>("by-date")
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("priority")
  const [includeSubtasks, setIncludeSubtasks] = useState(true)

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

  const groupedEntries = useMemo(() => buildDayGroups(printableEntries), [printableEntries])

  const groupedEntriesBySection = useMemo<SectionedDayPrintGroup[]>(() => {
    return groupedEntries.map((dayGroup) => {
      if (groupingMode === "priority") {
        const sections: SectionedDayPrintGroup["sections"] = PRIORITY_SECTION_ORDER.map((priority) => ({
          key: priority,
          title: PRIORITY_SECTION_LABEL[priority],
          entries: dayGroup.entries.filter((entry) => entry.priority === priority),
        })).filter((section) => section.entries.length > 0)

        const unprioritizedEntries = dayGroup.entries.filter((entry) => !entry.priority || !PRIORITY_SECTION_ORDER.includes(entry.priority))
        if (unprioritizedEntries.length > 0) {
          sections.push({
            key: "none",
            title: "Uncategorized",
            entries: unprioritizedEntries,
          })
        }

        return { ...dayGroup, sections }
      }

      const sectionMap = new Map<string, PrintableEntry[]>()

      dayGroup.entries.forEach((entry) => {
        if (entry.labelIds.length === 0) {
          const existing = sectionMap.get("Unlabeled") ?? []
          existing.push(entry)
          sectionMap.set("Unlabeled", existing)
          return
        }

        entry.labelIds.forEach((labelId) => {
          const labelName = labels.find((label) => label.id === labelId)?.name ?? "Unlabeled"
          const existing = sectionMap.get(labelName) ?? []
          existing.push(entry)
          sectionMap.set(labelName, existing)
        })
      })

      const sections = [...sectionMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([title, entries]) => ({
          key: title,
          title,
          entries,
        }))

      return { ...dayGroup, sections }
    })
  }, [groupedEntries, groupingMode, labels])

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const renderEntry = (entry: PrintableEntry, compact = false) => {
    const labelNames = entry.labelIds
      .map((labelId) => labels.find((label) => label.id === labelId)?.name)
      .filter((value): value is string => Boolean(value))

    return (
      <div
        key={entry.id}
        className={cn(
          "rounded-lg border border-border/70 bg-white px-3 py-2 text-black",
          compact ? "print-entry-compact" : "print-entry-standard"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={cn("text-sm font-medium", entry.completed && "line-through opacity-60")}>
              {entry.title}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
              {entry.time ? <span>{entry.time}</span> : null}
              {entry.priority ? <span>{PRIORITY_SECTION_LABEL[entry.priority] ?? entry.priority}</span> : null}
              {labelNames.length > 0 ? <span>{labelNames.join(", ")}</span> : null}
              {entry.source === "shopping-returns" && entry.storeName ? <span>Store: {entry.storeName}</span> : null}
              {entry.source === "shopping-returns" && entry.returnDeadline ? <span>Return by: {entry.returnDeadline}</span> : null}
            </div>
            {includeSubtasks && entry.subtasks.length > 0 ? (
              <div className="mt-2 space-y-1">
                {entry.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className={cn("text-[11px] text-neutral-600", subtask.completed && "line-through opacity-60")}
                  >
                    - {subtask.title}
                  </div>
                ))}
              </div>
            ) : null}
            {entry.source === "shopping-returns" && entry.notes ? (
              <div className="mt-2 text-[11px] text-neutral-500">{entry.notes}</div>
            ) : null}
          </div>
          <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
            {entry.source === "shopping-returns" ? "Returns" : entry.source === "list" ? "List" : "Task"}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setFromDate(selectedDate)
          setToDate(selectedDate)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-full border-border/70 bg-background/70 px-3 text-foreground hover:bg-muted"
          title="Print view"
        >
          <Printer className="size-4" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Print</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(92vh,920px)] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden p-0 print:shadow-none">
        <div className="print-controls shrink-0 border-b border-border/70 p-6">
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
                <option value="urgent">Urgent</option>
                <option value="important">Important</option>
                <option value="normal">Normal</option>
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
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Layout</span>
              <select
                value={layoutMode}
                onChange={(event) => setLayoutMode(event.target.value as PrintLayoutMode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none"
              >
                <option value="by-date">By Date</option>
                <option value="by-group">By Priority / Category</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Group within day</span>
              <select
                value={groupingMode}
                onChange={(event) => setGroupingMode(event.target.value as GroupingMode)}
                disabled={layoutMode !== "by-group"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none disabled:opacity-50"
              >
                <option value="priority">Priority</option>
                <option value="label">Label / Category</option>
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
            <label className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm">
              <span>Include subtasks</span>
              <input type="checkbox" checked={includeSubtasks} onChange={(event) => setIncludeSubtasks(event.target.checked)} />
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

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="print-root rounded-xl border border-border/70 bg-background p-6">
            <div className="mb-6 border-b border-border pb-4">
              <h1 className="font-heading text-[28px] uppercase tracking-[-0.04em]">Lemonade</h1>
              <p className="mt-2 text-sm text-muted-foreground">{formatRangeLabel(fromDate, toDate)}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {layoutMode === "by-date"
                  ? "Layout: By Date"
                  : `Layout: By Priority / Category (${groupingMode === "priority" ? "Priority" : "Label"})`}
              </p>
            </div>

            {groupedEntries.length > 0 ? (
              layoutMode === "by-date" ? (
                <div className="space-y-6">
                  {groupedEntries.map((group) => {
                    const dayMeta = formatDayMeta(group.date)

                    return (
                      <section key={group.date} className="break-inside-avoid rounded-xl border border-border/70 p-4">
                        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                          <div className="border-b border-border/70 pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-4">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {dayMeta.dayName}
                            </div>
                            <div className="mt-1 text-lg font-semibold text-foreground">{dayMeta.dateLabel}</div>
                          </div>
                          <div className="space-y-2">
                            {group.entries.map((entry) => renderEntry(entry))}
                          </div>
                        </div>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedEntriesBySection.map((group) => (
                    <section key={group.date} className="break-inside-avoid rounded-xl border border-border/70 p-4">
                      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {formatDayHeading(group.date)}
                      </h2>
                      <div className="space-y-4">
                        {group.sections.map((section) => (
                          <div key={`${group.date}-${section.key}`}>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
                              {section.title}
                            </div>
                            <div className="space-y-2">
                              {section.entries.map((entry) => renderEntry(entry, true))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                No items match the current print filters.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="print-controls sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background px-6 py-4 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} className="min-w-28">
            <Printer className="mr-1 size-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

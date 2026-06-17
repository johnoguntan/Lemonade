"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLemonadeStore, type Todo } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CalendarDays, Layers3, Printer } from "lucide-react"

type StatusFilter = "all" | "incomplete" | "completed"
type PriorityFilter = "all" | "high" | "medium" | "low"
type PrintMode = "dated" | "organized"
type OrganizedBy = "category" | "color" | "priority"

interface PrintPreviewDialogProps {
  selectedDate: string
}

interface PrintableEntry {
  id: string
  source: "calendar" | "list"
  title: string
  date: string
  time?: string
  completed: boolean
  priority?: Todo["priority"]
  printPriority: Exclude<PriorityFilter, "all">
  color?: string
  labelIds: string[]
  subtasks: Todo["subtasks"]
}

interface OrganizedSection {
  key: string
  title: string
  accent?: string
  entries: PrintableEntry[]
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

const resolvePrintPriority = (priority?: Todo["priority"]): Exclude<PriorityFilter, "all"> => {
  if (priority === "high" || priority === "urgent") {
    return "high"
  }

  if (priority === "medium" || priority === "important") {
    return "medium"
  }

  return "low"
}

const categoryLabel = (source: PrintableEntry["source"]) => {
  if (source === "list") return "Bottom Lists"
  return "Calendar"
}

const priorityLabel = (priority: Exclude<PriorityFilter, "all">) => {
  if (priority === "high") return "High Priority"
  if (priority === "medium") return "Medium Priority"
  return "Low Priority"
}

const compareEntries = (left: PrintableEntry, right: PrintableEntry) => {
  if (left.date !== right.date) return left.date.localeCompare(right.date)
  if ((left.time ?? "") !== (right.time ?? "")) return (left.time ?? "").localeCompare(right.time ?? "")
  return left.title.localeCompare(right.title)
}

export function PrintPreviewDialog({ selectedDate }: PrintPreviewDialogProps) {
  const { calendarTodos, lists, labels } = useLemonadeStore()
  const printRootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [fromDate, setFromDate] = useState(selectedDate)
  const [toDate, setToDate] = useState(selectedDate)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [printMode, setPrintMode] = useState<PrintMode>("organized")
  const [organizedBy, setOrganizedBy] = useState<OrganizedBy>("priority")
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
      printPriority: resolvePrintPriority(todo.priority),
      color: todo.color,
      labelIds: todo.labelIds,
      subtasks: todo.subtasks,
    }))

    const listEntries: PrintableEntry[] = lists
      .filter((list) => list.type !== "shopping-returns")
      .flatMap((list) =>
        list.todos.map((todo) => ({
          id: `${list.id}:${todo.id}`,
          source: "list",
          title: todo.text,
          date: todo.date ?? "",
          time: todo.time,
          completed: todo.completed,
          priority: todo.priority,
          printPriority: resolvePrintPriority(todo.priority),
          color: todo.color,
          labelIds: todo.labelIds,
          subtasks: todo.subtasks,
        }))
      )

    return [...calendarEntries, ...listEntries]
      .filter((entry) => {
        if (!includeBottomListItems && entry.source === "list") return false
        if (!entry.date) return false
        if (entry.date < fromDate || entry.date > toDate) return false
        if (selectedLabelIds.length > 0 && !entry.labelIds.some((labelId) => selectedLabelIds.includes(labelId))) return false
        if (priorityFilter !== "all" && entry.printPriority !== priorityFilter) return false
        if (statusFilter === "incomplete" && entry.completed) return false
        if (statusFilter === "completed" && !entry.completed) return false
        return true
      })
      .sort(compareEntries)
  }, [calendarTodos, fromDate, includeBottomListItems, lists, priorityFilter, selectedLabelIds, statusFilter, toDate])

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, PrintableEntry[]>()
    for (const entry of printableEntries) {
      const existing = groups.get(entry.date) ?? []
      existing.push(entry)
      groups.set(entry.date, existing)
    }
    return [...groups.entries()]
  }, [printableEntries])

  const organizedByDate = useMemo(() => {
    return groupedByDate.map(([date, entries]) => {
      const sections = new Map<string, OrganizedSection>()

      for (const entry of entries) {
        let key = ""
        let title = ""
        let accent: string | undefined

        if (organizedBy === "category") {
          key = entry.source
          title = categoryLabel(entry.source)
        } else if (organizedBy === "color") {
          key = entry.color ?? "uncolored"
          title = entry.color ? entry.color.toUpperCase() : "No Color"
          accent = entry.color
        } else {
          key = entry.printPriority
          title = priorityLabel(entry.printPriority)
        }

        const section = sections.get(key) ?? { key, title, accent, entries: [] }
        section.entries.push(entry)
        sections.set(key, section)
      }

      const sortedSections = [...sections.values()].sort((left, right) => left.title.localeCompare(right.title))
      return { date, sections: sortedSections }
    })
  }, [groupedByDate, organizedBy])

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    )
  }

  const handlePrint = () => {
    const printableNode = printRootRef.current

    if (!printableNode) {
      window.print()
      return
    }

    // PWAs commonly block popups/new windows during printing. Use a hidden iframe
    // so printing works reliably in both browser and installed (standalone) modes.
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.style.opacity = "0"
    document.body.appendChild(iframe)

    const iframeWindow = iframe.contentWindow
    const iframeDocument = iframe.contentDocument

    if (!iframeWindow || !iframeDocument) {
      iframe.remove()
      window.print()
      return
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("\n")

    const printStyles = `
      <style>
        @page { margin: 18mm; }

        html, body {
          background: #ffffff;
          color: #111111;
        }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .print-shell { padding: 24px; }
        .print-root {
          max-width: none !important;
          margin: 0 !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
      </style>
    `

    iframeDocument.open()
    iframeDocument.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Alessandro Printout</title>
          <base href="${window.location.origin}/" />
          ${styles}
          ${printStyles}
        </head>
        <body>
          <div class="print-shell">${printableNode.outerHTML}</div>
        </body>
      </html>
    `)
    iframeDocument.close()

    const cleanup = () => {
      // Delay a bit to avoid removing the frame too early in some browsers.
      window.setTimeout(() => iframe.remove(), 250)
    }

    const triggerPrint = () => {
      iframeWindow.focus()
      iframeWindow.print()
      cleanup()
    }

    // Some browsers won't fire iframe onload reliably after document.write,
    // so we use a short delay.
    window.setTimeout(triggerPrint, 50)
  }

  const totalTasks = printableEntries.length
  const activeDayCount = groupedByDate.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" title="Print view">
          <Printer className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="h-[92vh] w-[min(96vw,1280px)] max-w-none gap-0 overflow-hidden rounded-[32px] border-none p-0 shadow-2xl print:h-auto print:w-full print:rounded-none print:shadow-none"
      >
        <div className="grid h-full min-h-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="print-controls flex min-h-0 flex-col border-b border-border/70 bg-background xl:border-r xl:border-b-0">
            <div className="border-b border-border/70 px-6 py-5">
              <DialogHeader className="text-left">
                <DialogTitle>Print Preview</DialogTitle>
              </DialogHeader>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Date Range</div>
                  <div className="mt-1.5 text-sm font-medium leading-5">{formatRangeLabel(fromDate, toDate)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tasks</div>
                    <div className="mt-1.5 text-sm font-medium">{totalTasks}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Dates</div>
                    <div className="mt-1.5 text-sm font-medium">{activeDayCount}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Filters</div>
                <div className="grid gap-3">
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
                      className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none"
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
                      className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none"
                    >
                      <option value="all">All</option>
                      <option value="incomplete">Incomplete only</option>
                      <option value="completed">Completed only</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Layout</div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintMode("organized")}
                    className={cn(
                      "flex items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-colors",
                      printMode === "organized" ? "border-transparent bg-foreground text-background" : "border-border/70 bg-background hover:bg-muted/60"
                    )}
                  >
                    <Layers3 className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Date + Organized</div>
                      <div className={cn("mt-1.5 text-xs leading-5", printMode === "organized" ? "text-background/80" : "text-muted-foreground")}>
                        Group each day, then sort that day by category, color, or priority.
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode("dated")}
                    className={cn(
                      "flex items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-colors",
                      printMode === "dated" ? "border-transparent bg-foreground text-background" : "border-border/70 bg-background hover:bg-muted/60"
                    )}
                  >
                    <CalendarDays className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Purely by Date</div>
                      <div className={cn("mt-1.5 text-xs leading-5", printMode === "dated" ? "text-background/80" : "text-muted-foreground")}>
                        Print a simple chronological list for each date.
                      </div>
                    </div>
                  </button>
                </div>

                {printMode === "organized" ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Organize By</div>
                    <div className="flex flex-wrap gap-2">
                      {(["category", "color", "priority"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setOrganizedBy(value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-colors",
                            organizedBy === value ? "border-transparent bg-foreground text-background" : "border-border/70 hover:bg-background"
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Include</div>
                <label className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3 text-sm">
                  <span>Bottom List Items</span>
                  <input type="checkbox" checked={includeBottomListItems} onChange={(event) => setIncludeBottomListItems(event.target.checked)} />
                </label>
              </div>

              {labels.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Labels</div>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
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
              ) : null}
            </div>

            <DialogFooter className="border-t border-border/70 px-6 py-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-1 size-4" />
                Print
              </Button>
            </DialogFooter>
          </div>

          <div className="min-h-0 overflow-y-auto bg-[#f5f2eb] p-4 md:p-6 xl:p-8 print:bg-transparent print:p-0">
            <div
              ref={printRootRef}
              className="print-root mx-auto max-w-4xl rounded-[32px] border border-border/70 bg-background p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] md:p-10 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none"
            >
            <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-5">
              <div>
                <h1 className="font-heading text-[32px] uppercase tracking-[-0.05em]">Alessandro Printout</h1>
                <p className="mt-2 text-sm text-muted-foreground">{formatRangeLabel(fromDate, toDate)}</p>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Layout</div>
                <div className="mt-1 text-sm font-medium">
                  {printMode === "organized" ? `Date + ${organizedBy}` : "Purely by date"}
                </div>
              </div>
            </div>

            {groupedByDate.length > 0 ? (
              printMode === "dated" ? (
                <div className="space-y-8">
                  {groupedByDate.map(([date, entries]) => (
                    <section key={date} className="print-section">
                      <div className="mb-4 flex items-end justify-between gap-4 border-b border-border/70 pb-2">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {formatDayHeading(date)}
                        </h2>
                        <span className="text-[11px] text-muted-foreground">{entries.length} items</span>
                      </div>
                      <div className="space-y-3">
                        {entries.map((entry) => {
                          const labelNames = entry.labelIds
                            .map((labelId) => labels.find((label) => label.id === labelId)?.name)
                            .filter((value): value is string => Boolean(value))
                          const completedSubtasks = entry.subtasks.filter((subtask) => subtask.completed).length

                          return (
                            <div key={entry.id} className="rounded-[22px] border border-border/70 px-4 py-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className={cn("text-[15px] font-medium leading-5", entry.completed && "line-through opacity-60")}>
                                    {entry.title}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                    {entry.time ? <span>{entry.time}</span> : null}
                                    <span>{categoryLabel(entry.source)}</span>
                                    <span>{priorityLabel(entry.printPriority)}</span>
                                    {labelNames.length > 0 ? <span>Labels: {labelNames.join(", ")}</span> : null}
                                    {entry.subtasks.length > 0 ? <span>Subtasks: {completedSubtasks}/{entry.subtasks.length}</span> : null}
                                  </div>
                                </div>
                                {entry.color ? (
                                  <span className="mt-1 inline-flex size-3 rounded-full border border-black/10" style={{ backgroundColor: entry.color }} />
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  {organizedByDate.map(({ date, sections }) => (
                    <section key={date} className="print-section">
                      <div className="mb-4 flex items-end justify-between gap-4 border-b border-border/70 pb-2">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {formatDayHeading(date)}
                        </h2>
                        <span className="text-[11px] text-muted-foreground">{sections.reduce((sum, section) => sum + section.entries.length, 0)} items</span>
                      </div>
                      <div className="space-y-4">
                        {sections.map((section) => (
                          <div key={section.key} className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex size-3 rounded-full border border-black/10"
                                  style={{ backgroundColor: section.accent ?? "#d4d4d8" }}
                                />
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  {section.title}
                                </h3>
                              </div>
                              <span className="text-[11px] text-muted-foreground">{section.entries.length} tasks</span>
                            </div>
                            <div className="space-y-3">
                              {section.entries.map((entry) => {
                                const labelNames = entry.labelIds
                                  .map((labelId) => labels.find((label) => label.id === labelId)?.name)
                                  .filter((value): value is string => Boolean(value))

                                return (
                                  <div key={entry.id} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className={cn("text-[15px] font-medium leading-5", entry.completed && "line-through opacity-60")}>
                                          {entry.title}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                          {entry.time ? <span>{entry.time}</span> : null}
                                          {organizedBy !== "category" ? <span>{categoryLabel(entry.source)}</span> : null}
                                          {organizedBy !== "priority" ? <span>{priorityLabel(entry.printPriority)}</span> : null}
                                          {organizedBy !== "color" && entry.color ? <span>Color: {entry.color.toUpperCase()}</span> : null}
                                          {labelNames.length > 0 ? <span>Labels: {labelNames.join(", ")}</span> : null}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                No items match the current print filters.
              </div>
            )}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState } from "react"
import { useLemonadeStore, type Label } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Download, Moon, PencilLine, Shield, Sun, Tag, Trash2, User } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { ColorPickerPanel } from "@/components/lemonade/color-picker-panel"
import { DEFAULT_COLOR_PALETTE } from "@/lib/colors"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DEFAULT_LABEL_COLOR = DEFAULT_COLOR_PALETTE[1]

export default function SettingsPage() {
  const {
    calendarTodos,
    lists,
    labels,
    preferences,
    setPreferences,
    addLabel,
    editLabel,
    deleteLabel,
  } = useLemonadeStore()
  const { setTheme } = useTheme()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState<string>(DEFAULT_LABEL_COLOR)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelName, setEditingLabelName] = useState("")
  const [editingLabelColor, setEditingLabelColor] = useState<string>(DEFAULT_LABEL_COLOR)
  const [labelToDelete, setLabelToDelete] = useState<Label | null>(null)

  const totalTodos = calendarTodos.length + lists.reduce((acc, list) => acc + list.todos.length, 0)

  const handleExportData = () => {
    const data = {
      calendarTodos,
      lists,
      exportDate: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "lemonade-backup.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteAccount = () => {
    localStorage.removeItem("lemonade-storage")
    window.location.href = "/"
  }

  const handleThemeChange = (theme: "light" | "dark") => {
    setPreferences({ theme })
    setTheme(theme)
  }

  const handleCreateLabel = () => {
    const trimmedName = newLabelName.trim()
    if (!trimmedName) {
      return
    }

    addLabel(trimmedName, newLabelColor)
    setNewLabelName("")
    setNewLabelColor(DEFAULT_LABEL_COLOR)
  }

  const startEditingLabel = (label: Label) => {
    setEditingLabelId(label.id)
    setEditingLabelName(label.name)
    setEditingLabelColor(label.color)
  }

  const handleSaveLabel = (labelId: string) => {
    const trimmedName = editingLabelName.trim()
    if (!trimmedName) {
      return
    }

    editLabel(labelId, trimmedName, editingLabelColor)
    setEditingLabelId(null)
    setEditingLabelName("")
    setEditingLabelColor(DEFAULT_LABEL_COLOR)
  }

  const handleCancelLabelEdit = () => {
    setEditingLabelId(null)
    setEditingLabelName("")
    setEditingLabelColor(DEFAULT_LABEL_COLOR)
  }

  return (
    <div className="h-screen overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            <span>Back to app</span>
          </Link>
          <h1 className="text-xl font-bold">
            LEMONADE<span className="text-yellow-500">*</span>
          </h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <h2 className="mb-8 text-2xl font-bold">Settings</h2>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <User className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Profile</h3>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-5">
            <div>
              <label className="mb-1 block text-sm font-medium">Display name</label>
              <Input
                value={preferences.displayName}
                onChange={(event) => setPreferences({ displayName: event.target.value })}
                placeholder="Your name"
              />
              <p className="mt-2 text-xs text-muted-foreground">Saved locally on this device.</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Sun className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Appearance</h3>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Theme</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange("light")}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                    preferences.theme === "light"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="size-4" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange("dark")}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                    preferences.theme === "dark"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="size-4" />
                  Dark
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Cloud sync, notifications, and account-level profile settings are coming soon.
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Labels</h3>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-5">
            <div className="space-y-3 rounded-xl border border-border/70 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Create label</label>
                <p className="text-xs text-muted-foreground">Add a reusable label with its own default color.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  placeholder="Label name"
                  className="sm:flex-1"
                />
                <div className="sm:w-[320px]">
                  <ColorPickerPanel
                    value={newLabelColor}
                    palette={preferences.colorPalette}
                    onChange={setNewLabelColor}
                    onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                    title="Default label color"
                    description="This color becomes the default whenever the label is used."
                  />
                </div>
                <Button type="button" onClick={handleCreateLabel} className="sm:self-stretch">
                  Add label
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {labels.length > 0 ? (
                labels.map((label) => {
                  const isEditing = editingLabelId === label.id

                  return (
                    <div
                      key={label.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="size-4 shrink-0 rounded-full border border-border/70"
                            style={{ backgroundColor: label.color }}
                            aria-hidden
                          />
                          {isEditing ? (
                            <Input
                              value={editingLabelName}
                              onChange={(event) => setEditingLabelName(event.target.value)}
                              className="h-9"
                              autoFocus
                            />
                          ) : (
                            <div className="min-w-0">
                              <p className="truncate font-medium">{label.name}</p>
                              <p className="text-xs text-muted-foreground">{label.color.toUpperCase()}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button variant="outline" size="sm" onClick={handleCancelLabelEdit}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => handleSaveLabel(label.id)}>
                                Save
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => startEditingLabel(label)}>
                                <PencilLine className="mr-2 size-4" />
                                Rename
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setLabelToDelete(label)}>
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <label className="mb-1 block text-sm font-medium">Label color</label>
                          <p className="text-xs text-muted-foreground">This color is used anywhere the label appears.</p>
                        </div>
                        <div className="sm:w-[320px]">
                          <ColorPickerPanel
                            value={isEditing ? editingLabelColor : label.color}
                            palette={preferences.colorPalette}
                            onChange={(color) =>
                              isEditing
                                ? setEditingLabelColor(color)
                                : editLabel(label.id, label.name, color)
                            }
                            onPaletteChange={(palette) => setPreferences({ colorPalette: palette })}
                            title="Label color"
                            description="Use a shared swatch or choose a custom color for this label."
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  No labels yet. Create one above and it will show up immediately when tagging tasks.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Data & Privacy</h3>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Your data</p>
                <p className="text-sm text-muted-foreground">{totalTodos} todos across {lists.length} lists</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportData}>
                <Download className="mr-2 size-4" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <div>
                <p className="font-medium text-destructive">Delete local data</p>
                <p className="text-sm text-muted-foreground">Remove this device&apos;s saved Lemonade data.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>Lemonade v1.0.0</p>
          <p className="mt-1">Made with care for productive people</p>
        </section>
      </main>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete local data?</DialogTitle>
            <DialogDescription>
              This clears todos, lists, and settings stored in this browser. Cloud sync is not enabled yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labelToDelete !== null} onOpenChange={(open) => !open && setLabelToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete label?</DialogTitle>
            <DialogDescription>
              {labelToDelete
                ? `Delete "${labelToDelete.name}" and remove it from every task using it.`
                : "Delete this label and remove it from every task using it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (labelToDelete) {
                  deleteLabel(labelToDelete.id)
                }
                setLabelToDelete(null)
              }}
            >
              Delete label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useLemonadeStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Download, Moon, Shield, Sun, Trash2, User } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function SettingsPage() {
  const { calendarTodos, lists, preferences, setPreferences } = useLemonadeStore()
  const { setTheme } = useTheme()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
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
    </div>
  )
}

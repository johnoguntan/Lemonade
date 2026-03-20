"use client"

import { useState } from "react"
import { useLemonadeStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, User, Bell, Shield, Download, Trash2 } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export default function SettingsPage() {
  const { calendarTodos, lists } = useLemonadeStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    reminders: true,
    updates: false,
  })

  const totalTodos = calendarTodos.length + lists.reduce((acc, list) => acc + list.todos.length, 0)

  const handleExportData = () => {
    const data = {
      calendarTodos,
      lists,
      exportDate: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lemonade-backup.json'
    a.click()
  }

  const handleDeleteAccount = () => {
    // In a real app, this would delete the account
    localStorage.removeItem('lemonade-storage')
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
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

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-8">Settings</h2>

        {/* Account Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <User className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Account</h3>
          </div>
          <div className="space-y-4 pl-7">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input defaultValue="user@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Display name</label>
              <Input defaultValue="Lemonade User" />
            </div>

          </div>
        </section>

        {/* Notifications Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          <div className="space-y-4 pl-7">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Email notifications</p>
                <p className="text-sm text-muted-foreground">Receive daily summary emails</p>
              </div>
              <Switch 
                checked={notifications.email}
                onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Reminders</p>
                <p className="text-sm text-muted-foreground">Get reminded about upcoming todos</p>
              </div>
              <Switch 
                checked={notifications.reminders}
                onCheckedChange={(checked) => setNotifications({ ...notifications, reminders: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Product updates</p>
                <p className="text-sm text-muted-foreground">Learn about new features</p>
              </div>
              <Switch 
                checked={notifications.updates}
                onCheckedChange={(checked) => setNotifications({ ...notifications, updates: checked })}
              />
            </div>
          </div>
        </section>

        {/* Data Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Data & Privacy</h3>
          </div>
          <div className="space-y-4 pl-7">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Your data</p>
                <p className="text-sm text-muted-foreground">{totalTodos} todos across {lists.length} lists</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportData}>
                <Download className="size-4 mr-2" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border pt-4">
              <div>
                <p className="font-medium text-destructive">Delete account</p>
                <p className="text-sm text-muted-foreground">Permanently delete all your data</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="size-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </section>

        {/* App Info */}
        <section className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
          <p>Lemonade v1.0.0</p>
          <p className="mt-1">Made with care for productive people</p>
        </section>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your todos, lists, and settings will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createSupabaseBrowserClient, getSupabaseBrowserSession } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLemonadeStore } from "@/lib/store"
import { toast } from "sonner"

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

type Settings = {
  permission: "default" | "granted" | "denied"
  enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

const getPromptStorageKey = (userId: string) => `alessandro:notifications:prompted:${userId}`

const buildLocalDateTime = (dateKey: string, timeValue: string) => {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part))
  const [hour, minute] = timeValue.split(":").map((part) => Number(part))
  if (!year || !month || !day) return null
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

const computeReminderScheduleIso = (todo: {
  date?: string | null
  time?: string
  reminderOffsetMinutes?: number | null
  completed?: boolean
}) => {
  if (!todo.date || !todo.time) return null
  if (typeof todo.reminderOffsetMinutes !== "number" || !Number.isFinite(todo.reminderOffsetMinutes)) return null
  if (todo.completed) return null

  const base = buildLocalDateTime(todo.date, todo.time)
  if (!base) return null

  return new Date(base.getTime() - todo.reminderOffsetMinutes * 60 * 1000).toISOString()
}

export function NotificationManager() {
  const calendarTodos = useLemonadeStore((state) => state.calendarTodos)
  const isLocalDevHost =
    typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  const [settings, setSettings] = useState<Settings | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [notificationsApiAvailable, setNotificationsApiAvailable] = useState(true)
  const askedRef = useRef(false)
  const userIdRef = useRef<string | null>(null)
  const scheduledFingerprintsRef = useRef<Set<string>>(new Set())
  const pendingFingerprintsRef = useRef<Set<string>>(new Set())
  const shownReminderKeysRef = useRef<Set<string>>(new Set())

  const loadSettingsForSession = useCallback(async () => {
    if (!supabase) return

    try {
      const session = await getSupabaseBrowserSession(supabase)

      if (!session) {
        userIdRef.current = null
        setSettings(null)
        setShowPrompt(false)
        askedRef.current = false
        return
      }

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        userIdRef.current = session.user.id
        setNotificationsApiAvailable(false)
        setSettings({
          permission: typeof Notification === "undefined" ? "default" : Notification.permission,
          enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
        })
        return
      }

      userIdRef.current = session.user.id

      const response = await fetch("/api/notifications/settings")
      if (response.status === 401) {
        setSettings(null)
        setShowPrompt(false)
        askedRef.current = false
        return
      }

      if (!response.ok) {
        if (response.status === 503) {
          setNotificationsApiAvailable(false)
        }

        setSettings({
          permission: typeof Notification === "undefined" ? "default" : Notification.permission,
          enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
        })
        return
      }

      const data = (await response.json()) as Settings
      setNotificationsApiAvailable(true)
      setSettings(data)
    } catch {
      setNotificationsApiAvailable(false)
      setSettings({
        permission: typeof Notification === "undefined" ? "default" : Notification.permission,
        enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
      })
    }
  }, [supabase])

  const updateSettings = useCallback(async (next: Partial<{ permission: Settings["permission"] }>) => {
    try {
      const response = await fetch("/api/notifications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })

      if (response.status === 401) {
        return false
      }

      if (!response.ok) {
        if (response.status === 503) {
          setNotificationsApiAvailable(false)
        }
        return false
      }

      setNotificationsApiAvailable(true)
      setSettings((current) =>
        current
          ? {
              ...current,
              ...(typeof next.permission !== "undefined" ? { permission: next.permission } : {}),
            }
          : current
      )
      return true
    } catch {
      setNotificationsApiAvailable(false)
      return false
    }
  }, [])

  const ensureSubscribed = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return
    if (!("PushManager" in window)) return
    if (typeof Notification === "undefined") return
    if (!notificationsApiAvailable) return
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return

    const permission = await Notification.requestPermission()
    if (permission !== "granted") return

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }))

    const response = await fetch("/api/notifications/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    })

    if (!response.ok && response.status !== 401) {
      if (response.status === 503) {
        setNotificationsApiAvailable(false)
      }
      throw new Error("Subscription failed")
    }

    if (response.ok) {
      setNotificationsApiAvailable(true)
      setSettings((current) => (current ? { ...current, permission: "granted", enabled: true } : current))
    }
  }, [notificationsApiAvailable])

  useEffect(() => {
    if (isLocalDevHost) return
    if (!supabase) return

    queueMicrotask(() => {
      void loadSettingsForSession()
    })

    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => {
      askedRef.current = false
      void loadSettingsForSession()
    })

    return () => {
      authSubscription.subscription.unsubscribe()
    }
  }, [isLocalDevHost, loadSettingsForSession, supabase])

  useEffect(() => {
    if (isLocalDevHost) return
    if (!settings || !notificationsApiAvailable) return
    if (askedRef.current) return
    askedRef.current = true

    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return
    }

    const browserPermission = Notification.permission

    // If the browser already has an explicit permission, never prompt.
    if (browserPermission === "denied") {
      queueMicrotask(() => {
        void updateSettings({ permission: "denied" })
        setSettings((current) => (current ? { ...current, permission: "denied" } : current))
      })
      return
    }

    if (browserPermission === "granted") {
      queueMicrotask(() => {
        void updateSettings({ permission: "granted" })
        void ensureSubscribed()
      })
      return
    }

    if (settings.permission === "default") {
      // Show in-app prompt once; actual browser prompt only happens if user accepts.
      const userId = userIdRef.current
      if (userId) {
        const key = getPromptStorageKey(userId)
        const alreadyPrompted = window.localStorage.getItem(key) === "1"
        if (alreadyPrompted) {
          return
        }
      }
      queueMicrotask(() => {
        setShowPrompt(true)
      })
      return
    }

    if (settings.permission === "granted") {
      queueMicrotask(() => {
        void ensureSubscribed()
      })
    }
    // denied -> never ask again
  }, [ensureSubscribed, isLocalDevHost, notificationsApiAvailable, settings, updateSettings])

  useEffect(() => {
    if (isLocalDevHost) return
    if (!supabase) return

    let cancelled = false

    const syncEligibleReminders = async () => {
      const session = await getSupabaseBrowserSession(supabase)
      if (cancelled || !session) return

      const eligibleTodos = calendarTodos.filter((todo) => computeReminderScheduleIso(todo))
      const seenFingerprints = new Set<string>()

      for (const todo of eligibleTodos) {
        const scheduledFor = computeReminderScheduleIso(todo)
        if (!scheduledFor) continue

        const fingerprint = [
          todo.id,
          todo.text,
          todo.date ?? "",
          todo.time ?? "",
          todo.reminderOffsetMinutes ?? "",
          scheduledFor,
          todo.reminderLoopRule ?? "",
          todo.completed ? "done" : "todo",
        ].join("|")

        seenFingerprints.add(fingerprint)
        if (scheduledFingerprintsRef.current.has(fingerprint) || pendingFingerprintsRef.current.has(fingerprint)) {
          continue
        }

        pendingFingerprintsRef.current.add(fingerprint)
        try {
          const response = await fetch("/api/notifications/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: todo.id,
              title: todo.text,
              scheduledFor,
              loopRule:
                typeof todo.reminderLoopRule === "string" && todo.reminderLoopRule.trim()
                  ? todo.reminderLoopRule.trim()
                  : null,
            }),
          })

          if (!response.ok) {
            continue
          }

          scheduledFingerprintsRef.current.add(fingerprint)
          const data = (await response.json().catch(() => ({}))) as { scheduledNotificationId?: string }
          if (typeof data.scheduledNotificationId === "string" && data.scheduledNotificationId) {
            useLemonadeStore.getState().updateCalendarTodo(todo.id, {
              scheduledNotificationId: data.scheduledNotificationId,
            })
          }
        } catch {
          // ignore while offline or if auth changes mid-flight
        } finally {
          pendingFingerprintsRef.current.delete(fingerprint)
        }
      }

      scheduledFingerprintsRef.current.forEach((fingerprint) => {
        if (!seenFingerprints.has(fingerprint)) {
          scheduledFingerprintsRef.current.delete(fingerprint)
        }
      })

      pendingFingerprintsRef.current.forEach((fingerprint) => {
        if (!seenFingerprints.has(fingerprint)) {
          pendingFingerprintsRef.current.delete(fingerprint)
        }
      })
    }

    void syncEligibleReminders()

    return () => {
      cancelled = true
    }
  }, [calendarTodos, isLocalDevHost, supabase])

  useEffect(() => {
    if (isLocalDevHost) return

    const checkDueReminders = () => {
      const now = Date.now()
      const todos = useLemonadeStore.getState().calendarTodos

      for (const todo of todos) {
        const scheduledFor = computeReminderScheduleIso(todo)
        if (!scheduledFor) continue

        const scheduledTime = new Date(scheduledFor).getTime()
        if (Number.isNaN(scheduledTime) || scheduledTime > now) continue

        const reminderKey = `${todo.id}|${scheduledFor}`
        if (shownReminderKeysRef.current.has(reminderKey)) continue

        shownReminderKeysRef.current.add(reminderKey)
        toast(todo.text || "Task reminder", {
          description: todo.location ? `Location: ${todo.location}` : "Reminder",
        })
      }
    }

    let intervalId: number | null = null
    const start = () => {
      if (intervalId !== null) return
      checkDueReminders()
      intervalId = window.setInterval(checkDueReminders, 15_000)
    }
    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    // Only poll while the tab is visible — saves battery/CPU on the mobile PWA.
    const handleVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      stop()
    }
  }, [isLocalDevHost])

  const handleEnable = async () => {
    if (typeof Notification === "undefined") return
    setShowPrompt(false)

    const userId = userIdRef.current
    if (userId) {
      window.localStorage.setItem(getPromptStorageKey(userId), "1")
    }

    const result = await Notification.requestPermission()
    if (result === "denied") {
      await updateSettings({ permission: "denied" })
      setSettings((current) => (current ? { ...current, permission: "denied" } : current))
      return
    }

    if (result === "granted") {
      await updateSettings({ permission: "granted" })
      setSettings((current) => (current ? { ...current, permission: "granted" } : current))
      await ensureSubscribed()
    }
  }

  const handleNotNow = async () => {
    // Keep it 'default' so the user can enable later via Settings. But we won't nag.
    setShowPrompt(false)
    const userId = userIdRef.current
    if (userId && typeof window !== "undefined") {
      window.localStorage.setItem(getPromptStorageKey(userId), "1")
    }
  }


  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="max-w-[420px] rounded-[22px] border border-border/70 bg-background p-7 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="font-heading text-[16px] font-extrabold uppercase tracking-[0.18em]">
            Reminders
          </DialogTitle>
          <div className="h-px w-12 bg-border/70" />
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            Alessandro would like to send you reminders for your tasks.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => void handleNotNow()} className="rounded-full">
            Not now
          </Button>
          <Button type="button" onClick={() => void handleEnable()} className="rounded-full">
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

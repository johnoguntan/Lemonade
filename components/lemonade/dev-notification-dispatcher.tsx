"use client"

import { useEffect, useMemo, useRef } from "react"
import { createSupabaseBrowserClient, getSupabaseBrowserSession } from "@/lib/supabase/client"

// In production you should run a real scheduler (Supabase Cron / server cron)
// to call POST /api/notifications/dispatch.
//
// This dev-only component polls the dispatch endpoint so reminders work locally
// while the app is open, without needing cron.
export function DevNotificationDispatcher() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (!supabase) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
    if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return

    let cancelled = false

    const start = async () => {
      const session = await getSupabaseBrowserSession(supabase)
      if (cancelled || !session) return

      // Only poll if notifications are enabled + granted.
      try {
        const settingsRes = await fetch("/api/notifications/settings")
        if (settingsRes.status === 401 || settingsRes.status === 503) return
        if (!settingsRes.ok) return
        const settings = (await settingsRes.json()) as { enabled?: boolean; permission?: string }
        if (settings.enabled === false) return
        if ((settings.permission ?? "default") !== "granted") return
      } catch {
        return
      }

      intervalRef.current = window.setInterval(() => {
        void fetch("/api/notifications/dispatch", { method: "POST" }).catch(() => {})
      }, 30_000)
    }

    void start()

    return () => {
      cancelled = true
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [supabase])

  return null
}

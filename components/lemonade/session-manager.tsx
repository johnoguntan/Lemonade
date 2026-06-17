"use client"

import { useEffect, useMemo } from "react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { createSupabaseBrowserClient, getSupabaseBrowserSession } from "@/lib/supabase/client"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// Updates a lightweight cookie that middleware can use to avoid redirecting on hard refresh.
const touchLastAuthCookie = () => {
  try {
    const expires = new Date(Date.now() + THIRTY_DAYS_MS).toUTCString()
    document.cookie = `alessandro-auth-last=${Date.now()}; Path=/; SameSite=Lax; Expires=${expires}`
  } catch {
    // ignore
  }
}

export function SessionManager() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!supabase) return

    // Trigger Supabase's internal refresh logic (autoRefreshToken: true).
    void getSupabaseBrowserSession(supabase)
      .then((session) => {
        if (session) touchLastAuthCookie()
      })
      .catch(() => {})

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session) {
        touchLastAuthCookie()
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  return null
}

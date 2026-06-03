"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { useLemonadeStore } from "@/lib/store"
import { createSupabaseBrowserClient, getSupabaseBrowserSession } from "@/lib/supabase/client"

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
}

type AuthStoreActions = {
  initializeApp?: (userId: string) => void | Promise<void>
  setUserId?: (userId: string | null) => void
  setProfile?: (profile: ProfileRow | null) => void
}

async function loadProfile(userId: string) {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("users")
    .select("id, email, display_name")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data satisfies ProfileRow | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const initializedUserIdRef = useRef<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  useEffect(() => {
    let active = true
    const readAuthStore = () => useLemonadeStore.getState() as unknown as AuthStoreActions

    const clearStore = () => {
      const state = readAuthStore()
      state.setUserId?.(null)
      state.setProfile?.(null)
      initializedUserIdRef.current = null
    }

    const initializeForSession = async (session: Session | null) => {
      if (!active) {
        return
      }

      const userId = session?.user.id ?? null

      if (!userId) {
        clearStore()
        if (pathname !== "/login") {
          router.replace("/login")
        }
        if (active) {
          setResolved(true)
        }
        return
      }

      const state = readAuthStore()
      state.setUserId?.(userId)

      if (initializedUserIdRef.current !== userId) {
        initializedUserIdRef.current = userId
        await state.initializeApp?.(userId)
      }

      try {
        const profile = await loadProfile(userId)
        if (active) {
          readAuthStore().setProfile?.(profile)
        }
      } catch {
        if (active) {
          readAuthStore().setProfile?.(null)
        }
      }

      if (active) {
        setResolved(true)
      }
    }

    void getSupabaseBrowserSession(supabase)
      .then((session) => initializeForSession(session))
      .catch(() => {
        clearStore()
        if (active) {
          setResolved(true)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void initializeForSession(session)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [pathname, router, supabase])

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6F1]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D8D1C6] border-t-[#1A1A1A]" />
      </div>
    )
  }

  return <>{children}</>
}

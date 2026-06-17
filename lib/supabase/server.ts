import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { ALESSANDRO_AUTH_STORAGE_KEY, getSupabaseEnv } from "@/lib/supabase"

export const createSupabaseServerClient = async () => {
  const { url, anonKey } = getSupabaseEnv()
  if (!url || !anonKey) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookieOptions: { name: ALESSANDRO_AUTH_STORAGE_KEY },
    cookies: {
      encode: "tokens-only",
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components can't set cookies; ignore.
        }
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

// Server-side admin client (SERVICE_ROLE) — use ONLY in server code (route handlers / server actions).
export const createSupabaseAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  }
  if (!serviceRoleKey.startsWith("eyJ")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must use the legacy JWT format (eyJ...) for this app. The sb_secret... format is not supported here."
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

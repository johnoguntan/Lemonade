import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseEnv } from "@/lib/supabase"

export const createSupabaseMiddlewareClient = (request: NextRequest, response: NextResponse) => {
  const { url, anonKey } = getSupabaseEnv()
  if (!url || !anonKey) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  return createServerClient(url, anonKey, {
    cookies: {
      encode: "tokens-only",
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
    cookieOptions: { name: "alessandro-auth" },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

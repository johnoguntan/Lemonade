import { NextResponse } from "next/server"

import { normalizeAuthNextPath } from "@/lib/auth-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = normalizeAuthNextPath(requestUrl.searchParams.get("next"))

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("/auth/callback exchangeCodeForSession failed:", error.message)
      const loginUrl = new URL("/login", requestUrl.origin)
      loginUrl.searchParams.set("error", "auth_failed")
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

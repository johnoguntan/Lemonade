import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

const PUBLIC_PATH_PREFIXES = ["/auth/login", "/auth/callback", "/_next", "/icons", "/manifest.json", "/icon.svg", "/apple-icon.png"]
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

function isPublicPath(pathname: string) {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  return pathname === "/favicon.ico"
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createSupabaseMiddlewareClient(request, response)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Grace period: if the user had a valid session recently, allow the app shell to load
  // so the client can silently refresh the session (avoids showing login on refresh).
  const lastAuthCookie = request.cookies.get("alessandro-auth-last")?.value
  const lastAuthMs = lastAuthCookie ? Number.parseInt(lastAuthCookie, 10) : NaN
  const withinGracePeriod = Number.isFinite(lastAuthMs) && Date.now() - lastAuthMs <= THIRTY_DAYS_SECONDS * 1000

  if (!session && !isPublicPath(pathname) && !withinGracePeriod) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/auth/login"
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (session && pathname === "/auth/login") {
    const nextUrl = request.nextUrl.clone()
    nextUrl.pathname = "/"
    nextUrl.searchParams.delete("next")
    return NextResponse.redirect(nextUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

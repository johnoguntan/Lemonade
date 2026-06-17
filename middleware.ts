import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseEnv, ALESSANDRO_AUTH_STORAGE_KEY } from "@/lib/supabase"

const PUBLIC_PATH_PREFIXES = ["/login", "/auth/callback", "/_next", "/icons", "/manifest.json", "/icon.svg", "/apple-icon.png"]

function isPublicPath(pathname: string) {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  return pathname === "/favicon.ico"
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/auth/login") {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { url, anonKey } = getSupabaseEnv()
  if (!url || !anonKey) {
    return response
  }

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      name: ALESSANDRO_AUTH_STORAGE_KEY,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  if (session && pathname === "/login") {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = "/"
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

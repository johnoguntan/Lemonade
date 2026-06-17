import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function mapErrorToResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? String((error as { message?: unknown }).message)
        : "Unknown error"

  // Common misconfig: env vars missing
  if (message.includes("Missing Supabase env")) {
    console.error("/api/notifications/settings env missing:", message)
    // Treat "not initialized yet" as defaults (avoid breaking the UI).
    return NextResponse.json(
      { permission: "default", enabled: true, quiet_hours_start: null, quiet_hours_end: null },
      { status: 200 }
    )
  }

  // Common setup issue: migrations not applied
  if (message.includes('relation "') && message.includes('" does not exist')) {
    // Treat "not initialized yet" as empty defaults (avoid breaking the UI).
    return NextResponse.json(
      { permission: "default", enabled: true, quiet_hours_start: null, quiet_hours_end: null },
      { status: 200 }
    )
  }

  return NextResponse.json({ error: message }, { status: 503 })
}

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) {
    throw error
  }
  const user = session?.user ?? null
  return { supabase, user }
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("notification_settings")
      .select("permission, enabled, quiet_hours_start, quiet_hours_end")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      // Avoid generic 500s for missing table / misconfig
      console.error("/api/notifications/settings GET error:", error)
      return mapErrorToResponse(error)
    }

    return NextResponse.json(
      data ?? { permission: "default", enabled: true, quiet_hours_start: null, quiet_hours_end: null }
    )
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as Partial<{
      permission: "default" | "granted" | "denied"
      enabled: boolean
      quietHoursStart: string | null
      quietHoursEnd: string | null
    }>

    const permission =
      body.permission === "granted" || body.permission === "denied" || body.permission === "default"
        ? body.permission
        : undefined

    const payload: Record<string, unknown> = { user_id: user.id }
    if (permission) payload.permission = permission
    if (typeof body.enabled === "boolean") payload.enabled = body.enabled
    if ("quietHoursStart" in body) payload.quiet_hours_start = body.quietHoursStart
    if ("quietHoursEnd" in body) payload.quiet_hours_end = body.quietHoursEnd

    const { error } = await supabase.from("notification_settings").upsert(payload, { onConflict: "user_id" })
    if (error) {
      console.error("/api/notifications/settings POST error:", error)
      return mapErrorToResponse(error)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("/api/notifications/settings POST exception:", error)
    return mapErrorToResponse(error)
  }
}

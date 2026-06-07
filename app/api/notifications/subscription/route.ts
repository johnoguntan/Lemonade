import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function mapErrorToResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  if (message.includes("Missing Supabase env")) {
    return NextResponse.json({ error: message }, { status: 503 })
  }

  if (message.includes('relation "') && message.includes('" does not exist')) {
    return NextResponse.json(
      { error: "Notifications tables are not initialized. Apply Supabase migrations and try again." },
      { status: 409 }
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

  return { supabase, user: session?.user ?? null }
}

const getSubscriptionEndpoint = (value: unknown) => {
  if (!value || typeof value !== "object") return null
  const endpoint = (value as { endpoint?: unknown }).endpoint
  return typeof endpoint === "string" && endpoint.trim().length > 0 ? endpoint.trim() : null
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { subscription } = (await request.json()) as { subscription?: unknown }
    const endpoint = getSubscriptionEndpoint(subscription)
    if (!subscription || typeof subscription !== "object" || !endpoint) {
      return NextResponse.json({ error: "Missing subscription" }, { status: 400 })
    }

    const existingResult = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", user.id)

    if (existingResult.error) {
      return mapErrorToResponse(existingResult.error)
    }

    const existing = existingResult.data ?? []

    const duplicateIds = existing
      .filter((row) => getSubscriptionEndpoint(row.subscription) === endpoint)
      .map((row) => row.id)

    if (duplicateIds.length > 0) {
      const deleteResult = await supabase.from("push_subscriptions").delete().in("id", duplicateIds)
      if (deleteResult.error) {
        return mapErrorToResponse(deleteResult.error)
      }
    }

    // Prevent unbounded subscription accumulation (max 10 per user).
    const remainingCount = existing.length - duplicateIds.length
    if (remainingCount >= 10) {
      return NextResponse.json({ error: "Too many push subscriptions" }, { status: 429 })
    }

    const insertResult = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      subscription,
    })

    if (insertResult.error) {
      return mapErrorToResponse(insertResult.error)
    }

    const settingsResult = await supabase.from("notification_settings").upsert(
      {
        user_id: user.id,
        permission: "granted",
        enabled: true,
      },
      { onConflict: "user_id" }
    )

    if (settingsResult.error) {
      return mapErrorToResponse(settingsResult.error)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function DELETE() {
  try {
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const deleteResult = await supabase.from("push_subscriptions").delete().eq("user_id", user.id)
    if (deleteResult.error) return mapErrorToResponse(deleteResult.error)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

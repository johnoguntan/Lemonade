import { NextResponse } from "next/server"
import webpush from "web-push"

import { buildTaskReminderPushPayload } from "@/lib/notifications/push"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

function ensureWebPushConfigured() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("Missing VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)")
  }

  webpush.setVapidDetails("mailto:notifications@alessandro.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

function mapErrorToResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  if (message.includes("Missing Supabase env") || message.includes("Missing VAPID keys")) {
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

export async function POST(request: Request) {
  try {
    ensureWebPushConfigured()

    const supabase = await createSupabaseServerClient()
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError) throw authError
    const user = session?.user ?? null
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { taskId } = (await request.json()) as { taskId?: string }
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 })

    const settingsResult = await supabase
      .from("notification_settings")
      .select("permission, enabled")
      .eq("user_id", user.id)
      .maybeSingle()

    const permission = settingsResult.data?.permission ?? "default"
    const enabled = settingsResult.data?.enabled ?? true
    if (!enabled || permission !== "granted") {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const taskResult = await supabase
      .from("tasks")
      .select("id, title, date, time, location, notes")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (taskResult.error) throw taskResult.error
    if (!taskResult.data) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const subsResult = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", user.id)

    if (subsResult.error) throw subsResult.error

    const payload = JSON.stringify({
      ...buildTaskReminderPushPayload({
        notificationId: crypto.randomUUID(),
        task: taskResult.data,
        scheduledFor: taskResult.data.date && taskResult.data.time ? new Date().toISOString() : null,
      }),
    })

    await Promise.all(
      (subsResult.data ?? []).map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription as any, payload)
        } catch (error: any) {
          const statusCode = error?.statusCode
          // Remove invalid subscriptions.
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id)
          }
        }
      })
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

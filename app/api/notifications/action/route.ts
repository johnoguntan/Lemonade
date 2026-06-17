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

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError) throw authError
    const user = session?.user ?? null
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as { action?: string; taskId?: string; notificationId?: string }
    if (!body.taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 })

    if (body.action === "done") {
      await supabase
        .from("tasks")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", body.taskId)
        .eq("user_id", user.id)

      // Cancel any scheduled reminders tied to this task.
      if (body.notificationId) {
        await supabase
          .from("scheduled_notifications")
          .update({ status: "cancelled" })
          .eq("id", body.notificationId)
          .eq("user_id", user.id)
      }

      await supabase
        .from("tasks")
        .update({ scheduled_notification_id: null })
        .eq("id", body.taskId)
        .eq("user_id", user.id)

      return NextResponse.json({ ok: true })
    }

    if (body.action === "snooze-30") {
      const next = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      if (body.notificationId) {
        const updateResult = await supabase
          .from("scheduled_notifications")
          .update({
            scheduled_for: next,
            status: "scheduled",
          })
          .eq("id", body.notificationId)
          .eq("user_id", user.id)

        if (!updateResult.error) {
          return NextResponse.json({ ok: true })
        }
      }

      await supabase.from("scheduled_notifications").insert({
        user_id: user.id,
        task_id: body.taskId,
        scheduled_for: next,
        status: "scheduled",
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

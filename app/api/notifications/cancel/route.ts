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

    const { taskId } = (await request.json()) as { taskId?: string }
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 })

    const { data: task } = await supabase
      .from("tasks")
      .select("scheduled_notification_id")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    const scheduledId = task?.scheduled_notification_id as string | null | undefined
    if (scheduledId) {
      await supabase
        .from("scheduled_notifications")
        .update({ status: "cancelled" })
        .eq("id", scheduledId)
        .eq("user_id", user.id)
    }

    await supabase
      .from("tasks")
      .update({ scheduled_notification_id: null })
      .eq("id", taskId)
      .eq("user_id", user.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

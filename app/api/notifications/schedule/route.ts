import { NextResponse } from "next/server"
import { createHash } from "crypto"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function logScheduleStep(step: string, details?: Record<string, unknown>) {
  if (details) {
    console.error(`/api/notifications/schedule ${step}:`, details)
    return
  }

  console.error(`/api/notifications/schedule ${step}`)
}

function mapErrorToResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? String((error as { message?: unknown }).message)
        : "Unknown error"

  if (message.includes("Missing Supabase env")) {
    console.error("/api/notifications/schedule env missing:", message)
    return NextResponse.json({ items: [] }, { status: 200 })
  }

  if (message.includes('relation "') && message.includes('" does not exist')) {
    return NextResponse.json({ items: [] }, { status: 200 })
  }

  if (message.includes('violates foreign key constraint "scheduled_notifications_task_id_fkey"')) {
    return NextResponse.json({ ok: false, deferred: true, reason: "task-not-synced" }, { status: 202 })
  }

  return NextResponse.json({ error: message }, { status: 503 })
}

const parseIsoDateTime = (value: unknown) => {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const createDeterministicNotificationId = (userId: string, taskId: string, scheduledFor: string, loopRule: string | null) => {
  const seed = `${userId}|${taskId}|${scheduledFor}|${loopRule ?? ""}`
  const hash = createHash("sha256").update(seed).digest("hex")

  const part1 = hash.slice(0, 8)
  const part2 = hash.slice(8, 12)
  const part3 = `5${hash.slice(13, 16)}`
  const variantNibble = ((Number.parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
  const part4 = `${variantNibble}${hash.slice(17, 20)}`
  const part5 = hash.slice(20, 32)

  return `${part1}-${part2}-${part3}-${part4}-${part5}`
}

async function requireUser() {
  logScheduleStep("auth check starting")
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error("/api/notifications/schedule auth check error:", error)
    throw error
  }

  logScheduleStep("auth check result", {
    authenticated: Boolean(session?.user),
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
  })

  return { supabase, user: session?.user ?? null }
}

export async function POST(request: Request) {
  try {
    logScheduleStep("POST route start")
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as {
      taskId?: string
      title?: string
      scheduledFor?: string
      loopRule?: string | null
    }

    const taskId = body.taskId
    const title = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : null
    const scheduledFor = parseIsoDateTime(body.scheduledFor)
    logScheduleStep("POST payload parsed", {
      userId: user.id,
      taskId: taskId ?? null,
      title: title ?? null,
      scheduledFor: scheduledFor ?? null,
      loopRule: body.loopRule ?? null,
    })
    if (!taskId || !scheduledFor || !title) {
      logScheduleStep("POST missing required fields", {
        hasTaskId: Boolean(taskId),
        hasTitle: Boolean(title),
        hasScheduledFor: Boolean(scheduledFor),
      })
      return NextResponse.json({ error: "Missing taskId, title, or scheduledFor" }, { status: 400 })
    }

    logScheduleStep("POST verify task exists", {
      userId: user.id,
      taskId,
    })
    const taskResult = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (taskResult.error) {
      console.error("/api/notifications/schedule task lookup error:", taskResult.error)
      throw taskResult.error
    }

    if (!taskResult.data?.id) {
      logScheduleStep("POST task not synced yet", {
        userId: user.id,
        taskId,
      })
      return NextResponse.json({ ok: false, deferred: true, reason: "task-not-synced" }, { status: 202 })
    }

    const loopRule = typeof body.loopRule === "string" && body.loopRule.trim() ? body.loopRule.trim() : null
    const notificationId = createDeterministicNotificationId(user.id, taskId, scheduledFor, loopRule)

    // Cancel previous pending schedules for this task to avoid duplicates.
    logScheduleStep("POST cancel previous schedules", {
      userId: user.id,
      taskId,
      keepNotificationId: notificationId,
    })
    const cancelResult = await supabase
      .from("scheduled_notifications")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("task_id", taskId)
      .neq("id", notificationId)
    if (cancelResult.error) {
      // non-fatal; continue to schedule new notification
      console.error("/api/notifications/schedule cancel previous error:", cancelResult.error)
    }

    logScheduleStep("POST insert scheduled notification", {
      notificationId,
      userId: user.id,
      taskId,
      scheduledFor,
      status: "scheduled",
    })
    const insertResult = await supabase
      .from("scheduled_notifications")
      .upsert(
        {
          id: notificationId,
          user_id: user.id,
          task_id: taskId,
          scheduled_for: scheduledFor,
          status: "scheduled",
          loop_rule: loopRule,
          payload: { title, body: "Tap to open task" },
        },
        { onConflict: "id" }
      )

    if (insertResult.error) {
      console.error("/api/notifications/schedule insert error:", insertResult.error)
      throw insertResult.error
    }

    logScheduleStep("POST scheduled notification inserted", {
      notificationId,
      userId: user.id,
      taskId,
    })

    // Best-effort mirror on task row if schema supports it.
    logScheduleStep("POST update task scheduled_notification_id", {
      taskId,
      notificationId,
    })
    const taskUpdateResult = await supabase
      .from("tasks")
      .update({ scheduled_notification_id: notificationId })
      .eq("id", taskId)
      .eq("user_id", user.id)
    if (taskUpdateResult.error) {
      console.error("/api/notifications/schedule task update error:", taskUpdateResult.error)
    } else {
      logScheduleStep("POST task updated with scheduled_notification_id", {
        taskId,
        notificationId,
      })
    }

    // eslint-disable-next-line no-console
    console.log("Scheduled notification for task:", taskId)

    return NextResponse.json({ ok: true, scheduledNotificationId: notificationId })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function GET() {
  try {
    logScheduleStep("GET route start")
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("scheduled_notifications")
      .select("id, task_id, scheduled_for, status, loop_rule, created_at, updated_at")
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: true })

    if (error) return mapErrorToResponse(error)
    logScheduleStep("GET route success", {
      userId: user.id,
      itemCount: data?.length ?? 0,
    })
    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function DELETE() {
  try {
    logScheduleStep("DELETE route start")
    const { supabase, user } = await requireUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const deleteResult = await supabase.from("scheduled_notifications").delete().eq("user_id", user.id)
    if (deleteResult.error) return mapErrorToResponse(deleteResult.error)
    const updateResult = await supabase.from("tasks").update({ scheduled_notification_id: null }).eq("user_id", user.id)
    if (updateResult.error) return mapErrorToResponse(updateResult.error)

    logScheduleStep("DELETE route success", { userId: user.id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

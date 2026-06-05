import { NextResponse } from "next/server"
import webpush from "web-push"

import { buildTaskReminderPushPayload } from "@/lib/notifications/push"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message
  }

  return "Unknown dispatch error"
}

function ensureWebPushConfigured() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("Missing VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)")
  }
  webpush.setVapidDetails("mailto:notifications@alessandro.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const isWithinQuietHours = (now: Date, start: string | null | undefined, end: string | null | undefined) => {
  if (!start || !end) return false
  const [sh, sm] = start.split(":").map((x) => Number(x))
  const [eh, em] = end.split(":").map((x) => Number(x))
  if ([sh, sm, eh, em].some((x) => Number.isNaN(x))) return false

  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em

  // If quiet hours do not span midnight (e.g. 22:00 -> 08:00 does span midnight)
  if (startMin < endMin) {
    return minutesNow >= startMin && minutesNow < endMin
  }
  // Spans midnight
  return minutesNow >= startMin || minutesNow < endMin
}

const nextQuietHoursEnd = (now: Date, end: string) => {
  const [eh, em] = end.split(":").map((x) => Number(x))
  if (Number.isNaN(eh) || Number.isNaN(em)) return null
  const candidate = new Date(now)
  candidate.setHours(eh, em, 0, 0)
  // If end time already passed today, move to tomorrow.
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return candidate.toISOString()
}

// This endpoint is meant to be called by an external scheduler (e.g. Supabase Cron / GitHub Actions)
// It sends all due notifications and marks them as sent (and optionally schedules loops).
export async function POST(request: Request) {
  try {
    console.error("/api/notifications/dispatch start", {
      hasPublicVapidKey: Boolean(VAPID_PUBLIC_KEY),
      hasPrivateVapidKey: Boolean(VAPID_PRIVATE_KEY),
      webPushImportType: typeof webpush,
      hasSendNotification: typeof webpush?.sendNotification === "function",
    })

    const requiredSecret = process.env.NOTIFICATIONS_CRON_SECRET
    if (!requiredSecret) {
      // Fail closed: without a configured secret this endpoint would let anyone
      // trigger mass push dispatch and mutate every user's scheduled_notifications.
      console.error("/api/notifications/dispatch missing NOTIFICATIONS_CRON_SECRET; refusing to run")
      return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 })
    }
    const provided = request.headers.get("x-cron-secret")
    if (provided !== requiredSecret) {
      console.error("/api/notifications/dispatch unauthorized cron secret")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    ensureWebPushConfigured()
    const admin = createSupabaseAdminClient()
    console.error("/api/notifications/dispatch admin ready")

    const now = new Date().toISOString()
    const { data: due, error } = await admin
      .from("scheduled_notifications")
      .select("id, user_id, task_id, loop_rule, payload, scheduled_for, retry_count, status, tasks!scheduled_notifications_task_id_fkey(id, title, date, time, location, completed)")
      .in("status", ["scheduled", "failed"])
      .lte("scheduled_for", now)
      .limit(200)

    if (error) {
      console.error("/api/notifications/dispatch scheduled_notifications query failed:", error)
      throw error
    }

    const itemsToProcess = (due ?? []).filter((item: any) => 
      item.status === "scheduled" || (item.status === "failed" && (item.retry_count ?? 0) < 3)
    )

    console.error("/api/notifications/dispatch due count", { count: itemsToProcess.length })

    const processed: string[] = []

    for (const item of itemsToProcess) {
      console.error("/api/notifications/dispatch processing item", {
        id: item.id,
        userId: item.user_id,
        taskId: item.task_id,
        loopRule: item.loop_rule,
      })

      // Skip completed tasks.
      const taskCompleted = (item as any).tasks?.completed === true
      if (taskCompleted) {
        await admin.from("scheduled_notifications").update({ status: "cancelled" }).eq("id", item.id)
        continue
      }

      const { data: settings } = await admin
        .from("notification_settings")
        .select("enabled, permission, quiet_hours_start, quiet_hours_end")
        .eq("user_id", item.user_id)
        .maybeSingle()

      console.error("/api/notifications/dispatch notification settings", {
        itemId: item.id,
        enabled: settings?.enabled ?? true,
        permission: settings?.permission ?? "default",
      })

      if ((settings?.enabled ?? true) === false || (settings?.permission ?? "default") !== "granted") {
        await admin.from("scheduled_notifications").update({ status: "cancelled" }).eq("id", item.id)
        continue
      }

      const nowDate = new Date()
      if (isWithinQuietHours(nowDate, settings?.quiet_hours_start, settings?.quiet_hours_end)) {
        const next = nextQuietHoursEnd(nowDate, settings?.quiet_hours_end ?? "")
        if (next) {
          await admin.from("scheduled_notifications").update({ scheduled_for: next }).eq("id", item.id)
        }
        continue
      }

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, subscription")
        .eq("user_id", item.user_id)

      console.error("/api/notifications/dispatch subscriptions loaded", {
        itemId: item.id,
        count: subs?.length ?? 0,
      })

      const payload = JSON.stringify(
        buildTaskReminderPushPayload({
          notificationId: item.id,
          task: (item as any).tasks ?? {
            id: item.task_id,
            title: "Task reminder",
          },
          scheduledFor: item.scheduled_for,
        })
      )

      let hasFailures = false
      await Promise.all(
        (subs ?? []).map(async (row) => {
          try {
            await webpush.sendNotification(row.subscription as any, payload)
            console.error("/api/notifications/dispatch push sent", {
              itemId: item.id,
              subscriptionId: row.id,
            })
          } catch (err: any) {
            const code = err?.statusCode
            console.error("/api/notifications/dispatch push failed", {
              itemId: item.id,
              subscriptionId: row.id,
              statusCode: code ?? null,
              error: getErrorMessage(err),
            })
            if (code === 404 || code === 410) {
              await admin.from("push_subscriptions").delete().eq("id", row.id)
            } else {
              hasFailures = true
            }
          }
        })
      )

      if (hasFailures) {
        const newRetryCount = ((item as any).retry_count ?? 0) + 1
        const newStatus = newRetryCount >= 3 ? "permanently_failed" : "failed"
        await admin.from("scheduled_notifications").update({ 
          status: newStatus,
          retry_count: newRetryCount 
        }).eq("id", item.id)
        console.error("/api/notifications/dispatch item marked as", newStatus, { itemId: item.id, retryCount: newRetryCount })
      } else {
        await admin.from("scheduled_notifications").update({ status: "sent" }).eq("id", item.id)
        processed.push(item.id)

        // Simple looping support (minutes-based).
        const loopRule = item.loop_rule as string | null
        const minutes =
          loopRule === "every-5m"
            ? 5
            : loopRule === "every-15m"
              ? 15
              : loopRule === "every-30m"
                ? 30
                : loopRule === "every-60m"
                  ? 60
                  : null

        if (minutes) {
          const next = new Date(Date.now() + minutes * 60 * 1000).toISOString()
          await admin.from("scheduled_notifications").insert({
            user_id: item.user_id,
            task_id: item.task_id,
            scheduled_for: next,
            status: "scheduled",
            loop_rule: loopRule,
            payload: item.payload ?? null,
          })
        } else if (loopRule?.startsWith("every-morning:")) {
          const timeStr = loopRule.split(":", 2)[1] ?? ""
          const [h, m] = timeStr.split(":").map((x) => Number(x))
          if (!Number.isNaN(h) && !Number.isNaN(m)) {
            const next = new Date()
            next.setDate(next.getDate() + 1)
            next.setHours(h, m, 0, 0)
            await admin.from("scheduled_notifications").insert({
              user_id: item.user_id,
              task_id: item.task_id,
              scheduled_for: next.toISOString(),
              status: "scheduled",
              loop_rule: loopRule,
              payload: item.payload ?? null,
            })
          }
        }
      }
    }

    return NextResponse.json({ ok: true, processed })
  } catch (error) {
    console.error("/api/notifications/dispatch error:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import webpush from "web-push"

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

export async function POST() {
  // eslint-disable-next-line no-console
  console.log("Looking up push subscription...")
  const details: Record<string, unknown> = {
    foundSubscription: false,
    subscriptionCount: 0,
    attemptedSend: false,
    sent: false,
    errors: [] as string[],
  }

  try {
    ensureWebPushConfigured()

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error("TEST notifications: auth getUser error:", userError)
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", ...details }, { status: 401 })
    }

    const subsResult = await supabase.from("push_subscriptions").select("id, subscription").eq("user_id", user.id)
    if (subsResult.error) {
      console.error("TEST notifications: subscription lookup error:", subsResult.error)
      return NextResponse.json(
        { error: subsResult.error.message, ...details },
        { status: 503 }
      )
    }

    const subs = subsResult.data ?? []
    details.subscriptionCount = subs.length
    details.foundSubscription = subs.length > 0

    // eslint-disable-next-line no-console
    console.log(`Found subscription: ${subs.length > 0 ? "yes" : "no"}`)
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, ...details })
    }

    // eslint-disable-next-line no-console
    console.log("Sending push notification...")
    details.attemptedSend = true

    const payload = JSON.stringify({
      title: "Alessandro — notifications are working! 🎉",
      body: "Test notification",
      url: "/",
    })

    const sendResults = await Promise.all(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription as any, payload)
          return { id: row.id, ok: true }
        } catch (err: any) {
          const statusCode = err?.statusCode
          const message = err instanceof Error ? err.message : String(err)
          ;(details.errors as string[]).push(message)
          // Remove invalid subscriptions.
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", row.id)
          }
          return { id: row.id, ok: false, statusCode, message }
        }
      })
    )

    const anySuccess = sendResults.some((r) => r.ok)
    details.sent = anySuccess

    // eslint-disable-next-line no-console
    console.log(anySuccess ? "Push sent successfully" : "Push failed")
    return NextResponse.json({ ok: true, results: sendResults, ...details })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("TEST notifications error:", error)
    ;(details.errors as string[]).push(message)
    return NextResponse.json({ error: message, ...details }, { status: 503 })
  }
}

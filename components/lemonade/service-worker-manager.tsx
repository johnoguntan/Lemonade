"use client"

import { useEffect } from "react"

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    ;(async () => {
      // In development, older SW registrations can stick around and become "redundant".
      // Clean them up to keep only the latest worker.
      if (process.env.NODE_ENV !== "production") {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map((registration) => registration.unregister()))
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log("SW cleanup failed:", error)
        }
      }

      navigator.serviceWorker
        .register("/sw.js")
      .then(async (reg) => {
        // eslint-disable-next-line no-console
        console.log("SW registered:", reg)
        try {
          await reg.update()
        } catch {
          // ignore
        }

        // If notifications are already granted, ensure a push subscription exists.
        if (typeof Notification === "undefined") return
        if (Notification.permission !== "granted") return
        if (!("PushManager" in window)) return

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!publicKey) {
          // eslint-disable-next-line no-console
          console.log("SW: missing NEXT_PUBLIC_VAPID_PUBLIC_KEY")
          return
        }

        const ready = await navigator.serviceWorker.ready
        const existing = await ready.pushManager.getSubscription()
        const subscription =
          existing ??
          (await ready.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }))

        try {
          const response = await fetch("/api/notifications/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription }),
          })
          if (!response.ok) {
            // eslint-disable-next-line no-console
            console.log("SW: subscription save failed", response.status)
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log("SW: subscription save error", error)
        }

        // Debug logs requested: confirm subscription + scheduled notifications.
        try {
          const subRes = await fetch("/api/notifications/subscribe", { method: "GET" })
          const subJson = (await subRes.json().catch(() => ({}))) as any
          // eslint-disable-next-line no-console
          console.log(`Push subscription exists: ${subJson?.exists ? "yes" : "no"}`)
        } catch {
          // eslint-disable-next-line no-console
          console.log("Push subscription exists: no")
        }

        try {
          const scheduledRes = await fetch("/api/notifications/schedule", { method: "GET" })
          const scheduledJson = (await scheduledRes.json().catch(() => ({}))) as any
          const count = Array.isArray(scheduledJson?.items) ? scheduledJson.items.length : 0
          // eslint-disable-next-line no-console
          console.log(`Scheduled notifications count: ${count}`)
        } catch {
          // eslint-disable-next-line no-console
          console.log("Scheduled notifications count: 0")
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log("SW failed:", err)
      })
    })()
  }, [])

  return null
}

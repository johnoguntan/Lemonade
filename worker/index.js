// This file is loaded by next-pwa and injected into the generated service worker.
// It adds push notification support for task reminders.

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    try {
      data = { title: "Reminder", body: event.data ? event.data.text() : "" }
    } catch {
      data = { title: "Reminder", body: "" }
    }
  }

  const title = data.title || "Alessandro"
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-192x192.png",
    tag: data.notificationId || data.taskId || "alessandro-task-reminder",
    renotify: true,
    data: {
      url: data.url || "/",
      taskId: data.taskId || null,
      notificationId: data.notificationId || null,
    },
    actions: Array.isArray(data.actions) ? data.actions : [
      { action: "done", title: "Done" },
      { action: "snooze-30", title: "Snooze 30min" },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const taskId = event.notification?.data?.taskId
  const notificationId = event.notification?.data?.notificationId
  const url = event.notification?.data?.url || "/"
  const action = event.action || ""

  event.waitUntil((async () => {
    if (action === "done" || action === "snooze-30") {
      try {
        await fetch("/api/notifications/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, taskId, notificationId }),
        })
      } catch {
        // ignore
      }

      return
    }

    // Focus an existing tab if possible, otherwise open a new one.
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const client of windowClients) {
      if ("focus" in client) {
        await client.focus()
        client.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})

self.addEventListener("message", (event) => {
  const respond = (payload) => {
    try {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(payload)
      }
    } catch {
      // The sender may have closed the message channel already.
    }
  }

  try {
    if (event.data?.type === "SKIP_WAITING") {
      self.skipWaiting()
      respond({ ok: true })
      return
    }

    respond({ ok: true })
  } catch {
    respond({ ok: false })
  }
})

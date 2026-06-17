"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

export function PwaUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const controllerSeenRef = useRef(false)
  const reloadTriggeredRef = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    const attachRegistration = (registration: ServiceWorkerRegistration | null) => {
      if (!registration) {
        return
      }

      registrationRef.current = registration

      if (registration.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }

      const handleUpdateFound = () => {
        const installingWorker = registration.installing
        if (!installingWorker) {
          return
        }

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      }

      registration.addEventListener("updatefound", handleUpdateFound)
      return () => registration.removeEventListener("updatefound", handleUpdateFound)
    }

    let detachRegistrationListener: (() => void) | undefined

    navigator.serviceWorker.getRegistration().then((registration) => {
      detachRegistrationListener = attachRegistration(registration ?? null) ?? undefined
    })

    navigator.serviceWorker.ready.then((registration) => {
      detachRegistrationListener?.()
      detachRegistrationListener = attachRegistration(registration) ?? undefined
    })

    const handleControllerChange = () => {
      if (!controllerSeenRef.current) {
        controllerSeenRef.current = true
        return
      }

      if (reloadTriggeredRef.current) {
        window.location.reload()
        return
      }

      setUpdateAvailable(true)
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void registrationRef.current?.update()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      detachRegistrationListener?.()
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const handleUpdateNow = async () => {
    if (typeof window === "undefined") {
      return
    }

    setIsApplyingUpdate(true)
    reloadTriggeredRef.current = true

    const waitingWorker = registrationRef.current?.waiting
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" })
      return
    }

    window.location.reload()
  }

  if (!updateAvailable) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[120] flex justify-center px-4">
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/95 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-medium">A new version is available</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUpdateAvailable(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Later
          </button>
          <Button type="button" size="sm" onClick={() => void handleUpdateNow()} disabled={isApplyingUpdate}>
            {isApplyingUpdate ? "Updating..." : "Update now"}
          </Button>
        </div>
      </div>
    </div>
  )
}

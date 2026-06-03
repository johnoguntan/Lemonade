"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createSupabaseBrowserClient, getSupabaseBrowserSession } from "@/lib/supabase/client"
import {
  applyCloudSnapshotToStore,
  getCloudSnapshotFromStore,
  getImportPromptStorageKey,
  hasMeaningfulLocalData,
  readPendingCloudQueue,
  resetPersistedLocalStore,
  writePendingCloudQueue,
  type CloudSnapshot,
} from "@/lib/cloud-sync"
import { useLemonadeStore } from "@/lib/store"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type SyncGetResponse = {
  snapshot: CloudSnapshot
  isEmpty: boolean
  idMap?: Record<string, string>
}

type SyncErrorResponse = {
  error?: string
}

export function CloudSyncManager() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  const [userId, setUserId] = useState<string | null>(null)
  const [showImportPrompt, setShowImportPrompt] = useState(false)
  const [importing, setImporting] = useState(false)
  const [syncAvailable, setSyncAvailable] = useState(true)
  const lastBootstrappedUserRef = useRef<string | null>(null)
  const syncTimeoutRef = useRef<number | null>(null)
  const lastPushedAtRef = useRef<number>(0)

  useEffect(() => {
    if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
      return
    }
    if (!supabase) return
    let cancelled = false
    void getSupabaseBrowserSession(supabase)
      .then((session) => {
        if (cancelled) return
        setUserId(session?.user?.id ?? null)
      })
      .catch(() => setUserId(null))
    return () => {
      cancelled = true
    }
  }, [supabase])

  const fetchRemoteSnapshot = async (): Promise<SyncGetResponse | null> => {
    try {
      const response = await fetch("/api/sync", { method: "GET" })
      if (response.status === 401) {
        setSyncAvailable(true)
        return null
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as SyncErrorResponse
        if (response.status === 503) {
          setSyncAvailable(false)
        }
        console.warn("Cloud sync unavailable:", payload.error ?? response.statusText)
        return null
      }

      setSyncAvailable(true)
      return (await response.json()) as SyncGetResponse
    } catch {
      setSyncAvailable(false)
      return null
    }
  }

  const pushSnapshot = async (snapshot: Omit<CloudSnapshot, "latestUpdatedAt">) => {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    })
    if (!response.ok) {
      if (response.status === 503) {
        setSyncAvailable(false)
      }
      throw new Error("Sync failed")
    }
    setSyncAvailable(true)
    const data = (await response.json()) as SyncGetResponse
    if (data.idMap && Object.keys(data.idMap).length > 0) {
      useLemonadeStore.getState().applyTaskIdMap(data.idMap)
    }
    return data
  }

  // Bootstrap (load remote, merge/overwrite local as needed).
  useEffect(() => {
    if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
      return
    }
    if (!supabase || !userId || !syncAvailable) return
    if (lastBootstrappedUserRef.current === userId) return
    lastBootstrappedUserRef.current = userId

    const run = async () => {
      // 1) Flush pending offline queue first (offline-first).
      const pending = readPendingCloudQueue()
      if (pending && navigator.onLine) {
        try {
          await pushSnapshot(pending.snapshot)
          writePendingCloudQueue(null)
        } catch {
          // Keep it queued.
        }
      }

      // 2) Pull latest remote snapshot and apply (server wins).
      const remote = await fetchRemoteSnapshot()
      if (!remote) return

      if (remote.isEmpty) {
        // 3) First login migration prompt if there is meaningful local data.
        const promptKey = getImportPromptStorageKey(userId)
        const wasPrompted = typeof window !== "undefined" ? window.localStorage.getItem(promptKey) === "1" : true
        if (!wasPrompted && hasMeaningfulLocalData()) {
          setShowImportPrompt(true)
          return
        }
      }

      applyCloudSnapshotToStore(remote.snapshot)
    }

    void run()
  }, [supabase, syncAvailable, userId])

  // Background sync: local store is source of truth, push snapshot in the background (debounced).
  useEffect(() => {
    if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
      return
    }
    if (!supabase || !userId || !syncAvailable) return

    const unsubscribe = useLemonadeStore.subscribe(() => {
        const now = Date.now()
        // Debounce & avoid rapid-fire sync storms.
        if (now - lastPushedAtRef.current < 1000) return
        if (syncTimeoutRef.current) {
          window.clearTimeout(syncTimeoutRef.current)
        }

        syncTimeoutRef.current = window.setTimeout(async () => {
          const snapshot = getCloudSnapshotFromStore()
          const localUpdatedAt = new Date().toISOString()

          if (!navigator.onLine) {
            writePendingCloudQueue({ localUpdatedAt, snapshot })
            return
          }

          try {
            await pushSnapshot(snapshot)
            writePendingCloudQueue(null)
            lastPushedAtRef.current = Date.now()
          } catch {
            writePendingCloudQueue({ localUpdatedAt, snapshot })
          }
        }, 1200)
      })

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
      }
      unsubscribe()
    }
  }, [supabase, syncAvailable, userId])

  const handleImportDecision = async (shouldImport: boolean) => {
    if (!userId) return
    const promptKey = getImportPromptStorageKey(userId)
    window.localStorage.setItem(promptKey, "1")

    if (!shouldImport) {
      setShowImportPrompt(false)
      const remote = await fetchRemoteSnapshot()
      if (remote) {
        applyCloudSnapshotToStore(remote.snapshot)
      }
      return
    }

    setImporting(true)
    try {
      const localSnapshot = getCloudSnapshotFromStore()
      const result = await pushSnapshot(localSnapshot)
      // Clear local-only persisted store after successful upload (requested behavior).
      resetPersistedLocalStore()
      applyCloudSnapshotToStore(result.snapshot)
      setShowImportPrompt(false)
    } catch {
      // Keep the local data; user can retry later.
      setShowImportPrompt(false)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={showImportPrompt} onOpenChange={setShowImportPrompt}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Sync local data?</DialogTitle>
          <DialogDescription>
            We found local data — would you like to sync it to your account?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => void handleImportDecision(false)} disabled={importing}>
            Not now
          </Button>
          <Button type="button" onClick={() => void handleImportDecision(true)} disabled={importing}>
            {importing ? "Syncing..." : "Sync to account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

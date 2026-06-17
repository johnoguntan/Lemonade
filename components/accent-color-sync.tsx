"use client"

import { useEffect } from "react"
import { LEMONADE_STORAGE_KEY, useLemonadeStore } from "@/lib/store"

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "")
  if (normalized.length !== 6) {
    return null
  }

  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) {
    return null
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export function AccentColorSync() {
  const accentColor = useLemonadeStore((state) => state.preferences.accentColor)

  useEffect(() => {
    const root = document.documentElement
    const rgb = hexToRgb(accentColor)

    root.style.setProperty("--accent-color", accentColor)

    if (rgb) {
      root.style.setProperty("--accent-color-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`)
    } else {
      root.style.removeProperty("--accent-color-rgb")
    }
  }, [accentColor])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LEMONADE_STORAGE_KEY) {
        return
      }

      void useLemonadeStore.persist.rehydrate()
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  return null
}

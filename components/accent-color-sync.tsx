"use client"

import { useEffect } from "react"
import { useLemonadeStore } from "@/lib/store"

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

  return null
}

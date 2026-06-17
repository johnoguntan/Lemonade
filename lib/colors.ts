export const DEFAULT_COLOR_PALETTE = [
  "#ffffff",
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fbcfe8",
  "#fed7aa",
  "#0a0a0a",
  "#b7b08a",
  "#7f7a4f",
] as const

export const normalizeHexColor = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return undefined
  }

  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  return trimmed.toLowerCase()
}

export const mergeColorPalette = (palette: readonly string[] = [], extraColors: readonly string[] = []) => {
  const seen = new Set<string>()
  const merged: string[] = []

  for (const color of [...palette, ...extraColors]) {
    const normalized = normalizeHexColor(color)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    merged.push(normalized)
  }

  return merged
}

export const upsertColorPalette = (palette: readonly string[] = [], color?: string | null, limit = 12) => {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    return mergeColorPalette(palette, DEFAULT_COLOR_PALETTE)
  }

  const deduped = [normalized, ...mergeColorPalette(palette, DEFAULT_COLOR_PALETTE).filter((item) => item !== normalized)]
  return deduped.slice(0, limit)
}

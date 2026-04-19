"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEFAULT_COLOR_PALETTE, mergeColorPalette, normalizeHexColor, upsertColorPalette } from "@/lib/colors"

interface ColorPickerPanelProps {
  value?: string
  palette?: readonly string[]
  onChange: (color: string) => void
  onPaletteChange?: (palette: string[]) => void
  onClear?: () => void
  title?: string
  description?: string
  clearLabel?: string
}

type Hsv = { h: number; s: number; v: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return { r, g, b }
}

const rgbToHex = (r: number, g: number, b: number) => {
  const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`.toLowerCase()
}

// h: 0..360, s: 0..1, v: 0..1
const hsvToRgb = (h: number, s: number, v: number) => {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 1)
  const vv = clamp(v, 0, 1)
  const c = vv * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = vv - c
  let r1 = 0, g1 = 0, b1 = 0
  if (hh < 60) [r1, g1, b1] = [c, x, 0]
  else if (hh < 120) [r1, g1, b1] = [x, c, 0]
  else if (hh < 180) [r1, g1, b1] = [0, c, x]
  else if (hh < 240) [r1, g1, b1] = [0, x, c]
  else if (hh < 300) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  }
}

const rgbToHsv = (r: number, g: number, b: number): Hsv => {
  const rr = clamp(r / 255, 0, 1)
  const gg = clamp(g / 255, 0, 1)
  const bb = clamp(b / 255, 0, 1)
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / delta) % 6)
    else if (max === gg) h = 60 * ((bb - rr) / delta + 2)
    else h = 60 * ((rr - gg) / delta + 4)
  }
  if (h < 0) h += 360
  const s = max === 0 ? 0 : delta / max
  const v = max
  return { h, s, v }
}

export function ColorPickerPanel({
  value,
  palette = DEFAULT_COLOR_PALETTE,
  onChange,
  onPaletteChange,
  onClear,
  title = "Color",
  description = "Choose a saved swatch or pick a custom color.",
  clearLabel = "Clear",
}: ColorPickerPanelProps) {
  const normalizedValue = normalizeHexColor(value)
  const [draftHex, setDraftHex] = useState(normalizedValue ?? "#000000")
  const [isEditingHex, setIsEditingHex] = useState(false)
  const [hsv, setHsv] = useState<Hsv>(() => {
    const rgb = normalizedValue ? hexToRgb(normalizedValue) : null
    return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : { h: 210, s: 0.8, v: 1 }
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDraggingRef = useRef(false)

  const swatches = useMemo(
    () => mergeColorPalette(palette, DEFAULT_COLOR_PALETTE),
    [palette]
  )

  const applyColor = (nextColor: string) => {
    const normalized = normalizeHexColor(nextColor)
    if (!normalized) {
      return
    }

    setDraftHex(normalized)
    onChange(normalized)
    onPaletteChange?.(upsertColorPalette(palette, normalized))
  }

  useEffect(() => {
    if (!normalizedValue) return
    const rgb = hexToRgb(normalizedValue)
    if (!rgb) return
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b))
  }, [normalizedValue])

  const wheelSize = 160

  const drawWheel = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const sizePx = Math.max(1, Math.floor(wheelSize * dpr))
    canvas.width = sizePx
    canvas.height = sizePx
    canvas.style.width = `${wheelSize}px`
    canvas.style.height = `${wheelSize}px`

    const radiusPx = sizePx / 2
    const image = ctx.createImageData(sizePx, sizePx)
    const data = image.data

    for (let y = 0; y < sizePx; y++) {
      for (let x = 0; x < sizePx; x++) {
        const dx = x - radiusPx
        const dy = y - radiusPx
        const dist = Math.sqrt(dx * dx + dy * dy)
        const idx = (y * sizePx + x) * 4
        if (dist > radiusPx) {
          data[idx + 3] = 0
          continue
        }
        const s = clamp(dist / radiusPx, 0, 1)
        const angle = Math.atan2(dy, dx)
        const h = ((angle * 180) / Math.PI + 360) % 360
        const { r, g, b } = hsvToRgb(h, s, hsv.v)
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }

    ctx.putImageData(image, 0, 0)
  }

  useEffect(() => {
    drawWheel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsv.v])

  const pickFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const radius = wheelSize / 2
    const dx = x - radius
    const dy = y - radius
    const dist = Math.sqrt(dx * dx + dy * dy)
    const s = clamp(dist / radius, 0, 1)
    const angle = Math.atan2(dy, dx)
    const h = ((angle * 180) / Math.PI + 360) % 360
    const next: Hsv = { h, s, v: hsv.v }
    setHsv(next)
    const rgb = hsvToRgb(next.h, next.s, next.v)
    applyColor(rgbToHex(rgb.r, rgb.g, rgb.b))
  }

  const marker = useMemo(() => {
    const radius = wheelSize / 2
    const angle = (hsv.h * Math.PI) / 180
    const r = hsv.s * radius
    return {
      x: radius + r * Math.cos(angle),
      y: radius + r * Math.sin(angle),
    }
  }, [hsv.h, hsv.s, wheelSize])

  const sliderColor = useMemo(() => {
    const rgb = hsvToRgb(hsv.h, hsv.s, 1)
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  }, [hsv.h, hsv.s])

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
        </div>
        {onClear ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={onClear}>
            <RotateCcw className="mr-1.5 size-3.5" />
            {clearLabel}
          </Button>
        ) : null}
      </div>

      <div className="w-full">
        <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-4">
          <div
            className="relative shrink-0"
            style={{ width: `${wheelSize}px`, height: `${wheelSize}px` }}
          >
          <canvas
            ref={canvasRef}
            width={wheelSize}
            height={wheelSize}
            className="block rounded-full"
            onPointerDown={(event) => {
              event.preventDefault()
              isDraggingRef.current = true
              pickFromPointer(event.clientX, event.clientY)
              ;(event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (!isDraggingRef.current) return
              pickFromPointer(event.clientX, event.clientY)
            }}
            onPointerUp={() => {
              isDraggingRef.current = false
            }}
            onPointerCancel={() => {
              isDraggingRef.current = false
            }}
            aria-label="Color wheel"
          />
          {/* marker */}
          <div
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_2px_rgba(0,0,0,0.45)]"
            style={{ left: `${marker.x}px`, top: `${marker.y}px` }}
          />
          </div>

          {/* Controls directly under wheel */}
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-9 shrink-0 rounded-xl border shadow-sm",
                normalizedValue ? "border-black/10 dark:border-white/10" : "border-border bg-background"
              )}
              style={normalizedValue ? { backgroundColor: normalizedValue } : undefined}
              aria-label="Selected color"
            />
            <input
              type="text"
              value={isEditingHex ? draftHex : normalizedValue ?? ""}
              onChange={(event) => setDraftHex(event.target.value)}
              onFocus={() => {
                setIsEditingHex(true)
                setDraftHex(normalizedValue ?? "#000000")
              }}
              onBlur={() => {
                const normalized = normalizeHexColor(draftHex)
                if (normalized) {
                  applyColor(normalized)
                } else {
                  setDraftHex(normalizedValue ?? "#000000")
                }
                setIsEditingHex(false)
              }}
              placeholder="#rrggbb"
              className="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-[11px] uppercase outline-none"
              spellCheck={false}
            />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Brightness
                </div>
                <div className="text-[11px] text-muted-foreground">{Math.round(hsv.v * 100)}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(hsv.v * 100)}
                onChange={(event) => setHsv((current) => ({ ...current, v: clamp(Number(event.target.value) / 100, 0, 1) }))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(90deg, #000000 0%, ${sliderColor} 100%)`,
                }}
              />
            </div>
          </div>

          <div className="w-full">
            <div className="flex flex-wrap justify-center gap-2">
              {swatches.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => applyColor(hex)}
                  className={cn(
                    "size-7 rounded-md border transition-transform hover:scale-105",
                    hex === "#ffffff" ? "border-border" : "border-black/5 dark:border-white/10",
                    normalizedValue === hex && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: hex }}
                  title={hex.toUpperCase()}
                  aria-label={`Use ${hex}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* swatches moved under controls (centered) */}
    </div>
  )
}

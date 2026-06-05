"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Brush, Droplets, Image as ImageIcon, Palette, Pipette, SlidersHorizontal } from "lucide-react"

type ColorPickerProps = {
  value: string | null
  onChange: (value: string) => void
  onClose?: () => void
}

const presetSwatches = [
  "#000000", "#8b5cf6", "#fde047", "#84cc16", "#f87171", "#7dd3fc", "#f59e0b", "#ffffff",
  "#d4d4d8", "#c084fc", "#a3e635", "#fb7185", "#38bdf8", "#facc15", "#e5e7eb", "#f8fafc",
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const hsbToHex = (h: number, s: number, v: number) => {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "")
  const safe = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized
  const int = Number.parseInt(safe, 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

const rgbToHsb = (r: number, g: number, b: number) => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    b: max,
  }
}

export function ColorPicker({ value, onChange, onClose, anchorRef }: ColorPickerProps & { anchorRef?: { current: HTMLElement | null } }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastEmittedRef = useRef<string | null>(value)
  // Only propagate a color once the user actually interacts — opening the
  // picker must not overwrite the task's color on its own.
  const hasInteractedRef = useRef(false)
  // Keep a stable handle to onChange so the emit effect doesn't re-run (and
  // re-emit) every time the parent passes a new inline callback.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [position, setPosition] = useState<{ left: number; top: number; openToLeft: boolean } | null>(null)
  const [mounted, setMounted] = useState(false)
  const { h: initialHue, s: initialSaturation, b: initialBrightness } = useMemo(() => {
    // Default to full brightness so the wheel renders in color, not black.
    if (!value) return { h: 0, s: 0, b: 1 }
    const rgb = hexToRgb(value)
    return rgbToHsb(rgb.r, rgb.g, rgb.b)
  }, [value])

  const [hue, setHue] = useState(initialHue)
  const [saturation, setSaturation] = useState(initialSaturation)
  const [brightness, setBrightness] = useState(initialBrightness)
  const [opacity, setOpacity] = useState(100)

  useEffect(() => {
    // Ignore the parent echoing back the color we just emitted — re-syncing
    // internal state from our own output causes an infinite update loop.
    if (value === lastEmittedRef.current) return
    setHue(initialHue)
    setSaturation(initialSaturation)
    setBrightness(initialBrightness)
    lastEmittedRef.current = value
  }, [initialBrightness, initialHue, initialSaturation, value])

  useEffect(() => {
    setMounted(true)
  }, [])

  const PANEL_WIDTH = 320
  const PANEL_GAP = 16
  const PANEL_HEIGHT_FALLBACK = 420

  const computePosition = () => {
    if (typeof window === "undefined") return
    const anchor = anchorRef?.current
    if (!anchor) {
      setPosition({ left: window.innerWidth / 2 - PANEL_WIDTH / 2, top: 100, openToLeft: false })
      return
    }
    const rect = anchor.getBoundingClientRect()
    const wouldOverflowRight = rect.right + PANEL_WIDTH + PANEL_GAP > window.innerWidth
    const openToLeft = wouldOverflowRight && rect.left - PANEL_WIDTH - PANEL_GAP >= 0
    const left = openToLeft
      ? rect.left - PANEL_WIDTH - PANEL_GAP
      : Math.min(rect.right + PANEL_GAP, window.innerWidth - PANEL_WIDTH - 8)
    const top = Math.max(
      8,
      Math.min(rect.top, window.innerHeight - PANEL_HEIGHT_FALLBACK - 8)
    )
    setPosition({ left, top, openToLeft })
  }

  useLayoutEffect(() => {
    computePosition()
    if (typeof window === "undefined") return
    const handleResize = () => computePosition()
    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleResize, true)
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleResize, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorRef?.current])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node) &&
          !(anchorRef?.current?.contains(event.target as Node))) {
        onClose?.()
      }
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [onClose, anchorRef])

  const measureRef = (node: HTMLDivElement | null) => {
    containerRef.current = node
  }

  const WHEEL_SIZE = 320

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Throttle the ~100k-pixel redraw to one paint frame, coalescing rapid
    // brightness-slider changes so dragging it doesn't block the main thread.
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const size = WHEEL_SIZE
      canvas.width = size
      canvas.height = size

      const imageData = ctx.createImageData(size, size)
      const radius = size / 2

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const dx = x - radius
          const dy = y - radius
          const distance = Math.sqrt(dx * dx + dy * dy)
          const index = (y * size + x) * 4

          if (distance > radius) {
            imageData.data[index + 3] = 0
            continue
          }

          const angle = (Math.atan2(dy, dx) * 180) / Math.PI
          const nextHue = (angle + 360) % 360
          const nextSaturation = clamp(distance / radius, 0, 1)
          const color = hsbToHex(nextHue, nextSaturation, brightness)
          const rgb = hexToRgb(color)

          imageData.data[index] = rgb.r
          imageData.data[index + 1] = rgb.g
          imageData.data[index + 2] = rgb.b
          imageData.data[index + 3] = 255
        }
      }

      ctx.putImageData(imageData, 0, 0)
    })

    return () => cancelAnimationFrame(frame)
    // Depend on mounted/position too: the canvas only exists once the panel is
    // rendered, so without these the wheel would draw before the canvas mounts
    // and never re-run — leaving it blank.
  }, [brightness, mounted, position])

  useEffect(() => {
    if (!hasInteractedRef.current) {
      return
    }
    const nextColor = hsbToHex(hue, saturation, brightness)
    if (lastEmittedRef.current === nextColor) {
      return
    }
    lastEmittedRef.current = nextColor
    onChangeRef.current(nextColor)
  }, [brightness, hue, saturation])

  const handleCanvasPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    hasInteractedRef.current = true
    const bounds = canvas.getBoundingClientRect()
    const x = clientX - bounds.left
    const y = clientY - bounds.top
    const radius = bounds.width / 2
    const dx = x - radius
    const dy = y - radius
    const distance = Math.min(radius, Math.sqrt(dx * dx + dy * dy))
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    setHue((angle + 360) % 360)
    setSaturation(clamp(distance / radius, 0, 1))
  }

  const currentColor = hsbToHex(hue, saturation, brightness)
  const selectorStyle = {
    left: `${50 + Math.cos((hue * Math.PI) / 180) * saturation * 50}%`,
    top: `${50 + Math.sin((hue * Math.PI) / 180) * saturation * 50}%`,
  }

  if (!mounted || !position) {
    return null
  }

  const panel = (
    <div
      ref={measureRef}
      className="color-picker-panel fixed z-[2147483000] w-[320px] rounded-2xl border border-gray-200 bg-white shadow-2xl"
      style={{ left: position.left, top: position.top }}
    >
      <div className="border-b border-gray-100 px-4 py-2">
        <div className="mb-2 flex gap-1">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Droplets size={16} />
          <SlidersHorizontal size={16} />
          <Palette size={16} />
          <ImageIcon size={16} />
          <Brush size={16} />
        </div>
      </div>

      <div className="p-4">
        <div className="relative mx-auto h-[200px] w-[200px]">
          <canvas
            ref={canvasRef}
            width={200}
            height={200}
            className="h-full w-full cursor-crosshair rounded-full"
            onMouseDown={(event) => {
              handleCanvasPointer(event.clientX, event.clientY)
              const move = (moveEvent: MouseEvent) => handleCanvasPointer(moveEvent.clientX, moveEvent.clientY)
              const up = () => {
                window.removeEventListener("mousemove", move)
                window.removeEventListener("mouseup", up)
              }
              window.addEventListener("mousemove", move)
              window.addEventListener("mouseup", up)
            }}
          />
          <div
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ ...selectorStyle, backgroundColor: currentColor }}
          />
        </div>

        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={100}
            value={brightness * 100}
            onChange={(event) => {
              hasInteractedRef.current = true
              setBrightness(Number(event.target.value) / 100)
            }}
            className="h-2 w-full appearance-none rounded-full bg-gradient-to-r from-black via-gray-500 to-white"
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>Opacity</span>
            <span>{opacity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-gray-200"
          />
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="h-10 w-10 rounded-md border border-gray-300" style={{ backgroundColor: currentColor }} />
          <Pipette size={16} className="mb-1 text-gray-600" />
          <div className="grid flex-1 grid-cols-8 gap-1">
            {presetSwatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  hasInteractedRef.current = true
                  const rgb = hexToRgb(swatch)
                  const converted = rgbToHsb(rgb.r, rgb.g, rgb.b)
                  setHue(converted.h)
                  setSaturation(converted.s)
                  setBrightness(converted.b)
                }}
                className="h-5 w-5 rounded-sm border border-gray-300"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastEmittedRef = useRef<string | null>(value)
  const { h: initialHue, s: initialSaturation, b: initialBrightness } = useMemo(() => {
    if (!value) return { h: 0, s: 0, b: 0 }
    const rgb = hexToRgb(value)
    return rgbToHsb(rgb.r, rgb.g, rgb.b)
  }, [value])

  const [hue, setHue] = useState(initialHue)
  const [saturation, setSaturation] = useState(initialSaturation)
  const [brightness, setBrightness] = useState(initialBrightness)
  const [opacity, setOpacity] = useState(100)

  useEffect(() => {
    setHue(initialHue)
    setSaturation(initialSaturation)
    setBrightness(initialBrightness)
    lastEmittedRef.current = value
  }, [initialBrightness, initialHue, initialSaturation, value])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose?.()
      }
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [onClose])

  const PANEL_WIDTH = 336 // 320px panel + 16px margin
  const SAFETY = 16

  const measureRef = (node: HTMLDivElement | null) => {
    containerRef.current = node
    if (!node || typeof window === "undefined") return
    const rect = node.getBoundingClientRect()
    const overflowsRight = rect.right + PANEL_WIDTH + SAFETY > window.innerWidth
    if (overflowsRight) {
      node.classList.add("open-to-left")
    } else {
      node.classList.remove("open-to-left")
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleResize = () => {
      const node = containerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const overflowsRight = rect.right + PANEL_WIDTH + SAFETY > window.innerWidth
      node.classList.toggle("open-to-left", overflowsRight)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    const imageData = ctx.createImageData(width, height)
    const radius = width / 2

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = x - radius
        const dy = y - radius
        const distance = Math.sqrt(dx * dx + dy * dy)
        const index = (y * width + x) * 4

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
  }, [brightness])

  useEffect(() => {
    const nextColor = hsbToHex(hue, saturation, brightness)
    if (lastEmittedRef.current === nextColor) {
      return
    }
    lastEmittedRef.current = nextColor
    onChange(nextColor)
  }, [brightness, hue, onChange, saturation])

  const handleCanvasPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
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

  return (
    <div
      ref={measureRef}
      className="color-picker-panel absolute top-0 z-[80] w-[320px] rounded-2xl border border-gray-200 bg-white shadow-2xl left-full ml-4"
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
            onChange={(event) => setBrightness(Number(event.target.value) / 100)}
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
}

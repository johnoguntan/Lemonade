"use client"

import { useEffect, useMemo, useRef } from "react"
import { useLemonadeStore } from "@/lib/store"

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  vr: number
  color: string
  life: number
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function CelebrationOverlay() {
  const { celebrationEvent, clearCelebrationEvent, preferences } = useLemonadeStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const startRef = useRef<number>(0)

  const palette = useMemo(() => {
    const base = Array.isArray(preferences.colorPalette) ? preferences.colorPalette : []
    return base.length > 0 ? base : ["#2563eb", "#e54848", "#f4c430", "#2d9b6f"]
  }, [preferences.colorPalette])

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!celebrationEvent) return
    if (!preferences.showCelebrations) return
    if (prefersReducedMotion()) {
      clearCelebrationEvent()
      return
    }

    // Confetti only when a whole day is completed.
    if (!celebrationEvent.dayCompleted) {
      window.setTimeout(() => clearCelebrationEvent(), 750)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      clearCelebrationEvent()
      return
    }

    const parent = canvas.parentElement
    const rect = parent?.getBoundingClientRect()
    const width = rect?.width ?? window.innerWidth
    const height = rect?.height ?? window.innerHeight

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      clearCelebrationEvent()
      return
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const originX = width / 2
    const originY = height * 0.35

    const particleCount = 70
    particlesRef.current = Array.from({ length: particleCount }, () => {
      const angle = (Math.random() * Math.PI) / 1.3 + Math.PI * 0.85
      const speed = 3 + Math.random() * 4.5
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (2 + Math.random() * 2),
        size: 3 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        color: palette[Math.floor(Math.random() * palette.length)] ?? "#2563eb",
        life: 700 + Math.random() * 500,
      }
    })

    startRef.current = performance.now()

    const step = (now: number) => {
      const t = now - startRef.current
      ctx.clearRect(0, 0, width, height)

      const gravity = 0.085
      const drag = 0.992
      let alive = 0

      for (const p of particlesRef.current) {
        if (t > p.life) continue
        alive++
        p.vx *= drag
        p.vy = p.vy * drag + gravity
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.vr

        const alpha = Math.max(0, 1 - t / p.life)
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6)
        ctx.restore()
      }

      if (alive > 0 && t < 1400) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        ctx.clearRect(0, 0, width, height)
        clearCelebrationEvent()
      }
    }

    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(step)
  }, [celebrationEvent, clearCelebrationEvent, palette, preferences.showCelebrations])

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {celebrationEvent?.taskCompleted ? (
        <div key={celebrationEvent.id} className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-24 w-24">
            <span className="celebration-sparkle celebration-sparkle-1" />
            <span className="celebration-sparkle celebration-sparkle-2" />
            <span className="celebration-sparkle celebration-sparkle-3" />
            <span className="celebration-sparkle celebration-sparkle-4" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

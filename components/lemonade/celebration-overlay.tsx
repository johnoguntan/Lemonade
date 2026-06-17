"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLemonadeStore } from "@/lib/store"

// ─── Types ────────────────────────────────────────────────────────────────────

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  vr: number
  color: string
  shape: "rect" | "circle" | "star"
  life: number
  delay: number
}

type RippleRing = {
  maxR: number
  color: string
  life: number
  startTime: number
}

type EmojiParticle = {
  id: string
  x: number
  y: number
  emoji: string
  delay: number
  scale: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

const rand = (min: number, max: number) => min + Math.random() * (max - min)

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, points = 5) {
  const innerR = outerR * 0.42
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext("2d")
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CelebrationOverlay() {
  const { celebrationEvent, clearCelebrationEvent, preferences } = useLemonadeStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const ringsRef = useRef<RippleRing[]>([])
  const startRef = useRef<number>(0)
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const palette = useMemo(() => {
    const base = Array.isArray(preferences.colorPalette) ? preferences.colorPalette : []
    return base.length > 0
      ? base
      : ["#2563eb", "#e54848", "#f4c430", "#2d9b6f", "#9b5de5", "#f15bb5"]
  }, [preferences.colorPalette])

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    if (!celebrationEvent) return
    if (!preferences.showCelebrations) { clearCelebrationEvent(); return }
    if (prefersReducedMotion()) { clearCelebrationEvent(); return }

    const mode = preferences.celebrationMode ?? "burst"
    if (mode === "off") { clearCelebrationEvent(); return }

    const isDay = celebrationEvent.dayCompleted

    // Origin: use coords from the checkbox click, else center-ish of viewport
    const ox = celebrationEvent.originX ?? window.innerWidth / 2
    const oy = celebrationEvent.originY ?? window.innerHeight * 0.4

    // ── Emoji mode (DOM-based) ───────────────────────────────────────────────
    if (mode === "emoji") {
      const count = isDay ? 18 : 9
      const emoji = preferences.celebrationEmoji?.trim() || "🎉"
      const particles: EmojiParticle[] = Array.from({ length: count }, (_, i) => ({
        id: `${celebrationEvent.id}-${i}`,
        x: ox + rand(-80, 80),
        y: oy,
        emoji,
        delay: i * 50,
        scale: rand(0.8, 1.8),
      }))
      setEmojiParticles(particles)
      const clearAfter = (isDay ? 1800 : 950) + count * 50
      window.setTimeout(() => {
        setEmojiParticles([])
        clearCelebrationEvent()
      }, clearAfter)
      return
    }

    // ── Ripple / Minimal (canvas ring animations) ────────────────────────────
    if (mode === "ripple" || mode === "minimal") {
      const canvas = canvasRef.current
      if (!canvas) { clearCelebrationEvent(); return }
      const { ctx, w, h } = setupCanvas(canvas)
      if (!ctx) { clearCelebrationEvent(); return }

      const ringCount = mode === "ripple" ? (isDay ? 5 : 3) : (isDay ? 2 : 1)
      const maxRadius = mode === "ripple" ? (isDay ? 200 : 110) : (isDay ? 70 : 45)
      const ringDuration = mode === "ripple" ? (isDay ? 1100 : 700) : (isDay ? 600 : 420)

      ringsRef.current = Array.from({ length: ringCount }, (_, i) => ({
        maxR: maxRadius + i * (mode === "ripple" ? 28 : 18),
        color: palette[i % palette.length] ?? "#2563eb",
        life: ringDuration,
        startTime: i * 130,
      }))

      startRef.current = performance.now()

      const stepRipple = (now: number) => {
        const t = now - startRef.current
        ctx.clearRect(0, 0, w, h)
        let alive = 0

        for (const ring of ringsRef.current) {
          const rt = t - ring.startTime
          if (rt < 0) { alive++; continue }
          if (rt > ring.life) continue
          alive++

          const progress = rt / ring.life
          const eased = 1 - (1 - progress) ** 2
          const alpha = Math.max(0, 1 - progress * 1.15)
          const radius = eased * ring.maxR

          ctx.beginPath()
          ctx.arc(ox, oy, radius, 0, Math.PI * 2)
          ctx.strokeStyle = ring.color
          ctx.globalAlpha = alpha
          ctx.lineWidth = mode === "minimal" ? 1.5 : 2.5
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        if (alive > 0) {
          frameRef.current = requestAnimationFrame(stepRipple)
        } else {
          ctx.clearRect(0, 0, w, h)
          clearCelebrationEvent()
        }
      }

      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(stepRipple)
      return
    }

    // ── Particle modes: burst, confetti, firework, stars ─────────────────────
    const canvas = canvasRef.current
    if (!canvas) { clearCelebrationEvent(); return }
    const { ctx, w, h } = setupCanvas(canvas)
    if (!ctx) { clearCelebrationEvent(); return }

    const baseCount = isDay ? 120 : 60

    if (mode === "burst") {
      particlesRef.current = Array.from({ length: baseCount }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = rand(5, isDay ? 18 : 13)
        return {
          x: ox, y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(2, 5),
          size: rand(10, isDay ? 24 : 18),
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          color: palette[Math.floor(Math.random() * palette.length)] ?? "#2563eb",
          shape: "rect" as const,
          life: rand(900, isDay ? 2000 : 1500),
          delay: 0,
        }
      })
    } else if (mode === "confetti") {
      particlesRef.current = Array.from({ length: baseCount + 40 }, () => ({
        x: rand(ox - 120, ox + 120),
        y: oy - rand(0, 80),
        vx: rand(-4, 4),
        vy: rand(-12, -4),
        size: rand(8, 18),
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        color: palette[Math.floor(Math.random() * palette.length)] ?? "#f4c430",
        shape: (Math.random() > 0.5 ? "rect" : "circle") as "rect" | "circle",
        life: rand(1200, isDay ? 2500 : 1800),
        delay: Math.random() * 300,
      }))
    } else if (mode === "firework") {
      particlesRef.current = Array.from({ length: baseCount }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = rand(4, isDay ? 18 : 12)
        return {
          x: ox, y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(5, isDay ? 12 : 9),
          rotation: 0,
          vr: 0,
          color: palette[Math.floor(Math.random() * palette.length)] ?? "#f4c430",
          shape: "circle" as const,
          life: rand(800, isDay ? 1800 : 1300),
          delay: Math.random() * 80,
        }
      })
    } else if (mode === "stars") {
      particlesRef.current = Array.from({ length: isDay ? 60 : 30 }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = rand(3, isDay ? 12 : 8)
        return {
          x: ox, y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(1, 3),
          size: rand(16, isDay ? 32 : 24),
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.18,
          color: palette[Math.floor(Math.random() * palette.length)] ?? "#f4c430",
          shape: "star" as const,
          life: rand(1000, isDay ? 2200 : 1600),
          delay: Math.random() * 150,
        }
      })
    }

    const totalDuration = isDay ? 2800 : 2000
    const gravity = mode === "confetti" ? 0.18 : 0.1
    const drag = mode === "confetti" ? 0.982 : 0.988

    startRef.current = performance.now()

    const stepParticles = (now: number) => {
      const t = now - startRef.current
      ctx.clearRect(0, 0, w, h)

      let alive = 0
      for (const p of particlesRef.current) {
        if (t < p.delay) { alive++; continue }
        const pt = t - p.delay
        if (pt > p.life) continue
        alive++

        p.vx *= drag
        p.vy = p.vy * drag + gravity
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.vr

        const alpha = Math.max(0, 1 - pt / p.life)

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color

        if (p.shape === "circle") {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.shape === "star") {
          drawStar(ctx, 0, 0, p.size / 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.55)
        }

        ctx.restore()
      }

      if (alive > 0 && t < totalDuration) {
        frameRef.current = requestAnimationFrame(stepParticles)
      } else {
        ctx.clearRect(0, 0, w, h)
        clearCelebrationEvent()
      }
    }

    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(stepParticles)
  }, [
    celebrationEvent,
    clearCelebrationEvent,
    palette,
    preferences.showCelebrations,
    preferences.celebrationMode,
    preferences.celebrationEmoji,
  ])

  if (!mounted) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Canvas for all non-emoji modes */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* DOM-based emoji particles */}
      {emojiParticles.map((p) => (
        <span
          key={p.id}
          className="absolute select-none"
          style={{
            left: p.x,
            top: p.y,
            fontSize: `${Math.round(p.scale * 28)}px`,
            lineHeight: 1,
            transform: "translate(-50%, -50%)",
            animation: `celebEmojiFloat 900ms ease-out ${p.delay}ms forwards`,
            opacity: 0,
            willChange: "transform, opacity",
          }}
        >
          {p.emoji}
        </span>
      ))}

      <style>{`
        @keyframes celebEmojiFloat {
          0%   { opacity: 0;   transform: translate(-50%, -50%) scale(0.3); }
          18%  { opacity: 1;   transform: translate(-50%, -58%) scale(1.2); }
          65%  { opacity: 0.9; transform: translate(-50%, -110%) scale(1); }
          100% { opacity: 0;   transform: translate(-50%, -160%) scale(0.8); }
        }
      `}</style>
    </div>,
    document.body
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"

type QuotePayload = {
  quote: string
  author: string
}

const FALLBACK_QUOTE: QuotePayload = {
  quote: "Discipline is remembering what you want.",
  author: "David Campbell",
}

const STORAGE_PREFIX = "allsenadro-quote-"

export function SolairBoard() {
  const [payload, setPayload] = useState<QuotePayload>(FALLBACK_QUOTE)

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const storageKey = `${STORAGE_PREFIX}${todayKey}`

    const cached = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null
    if (cached) {
      try {
        setPayload(JSON.parse(cached) as QuotePayload)
        return
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }

    let cancelled = false

    const loadQuote = async () => {
      try {
        const response = await fetch("/api/quotes", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Quote request failed")
        }

        const data = (await response.json()) as QuotePayload
        if (cancelled) return

        const nextPayload = {
          quote: data.quote || FALLBACK_QUOTE.quote,
          author: data.author || FALLBACK_QUOTE.author,
        }

        setPayload(nextPayload)
        window.localStorage.setItem(storageKey, JSON.stringify(nextPayload))
      } catch {
        if (!cancelled) {
          setPayload(FALLBACK_QUOTE)
        }
      }
    }

    void loadQuote()

    return () => {
      cancelled = true
    }
  }, [])

  const boardText = useMemo(() => `${payload.quote} - ${payload.author}`.toUpperCase(), [payload])

  return (
    <section className="px-5 py-4">
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#787878]">
        Solair board · quote of the day
      </p>

      <div className="overflow-hidden bg-[#141414] px-2 py-2">
        <div className="flex flex-wrap gap-[2px] font-mono text-[10px] leading-4 text-white">
          {boardText.split("").map((character, index) => (
            <span
              key={`${character}-${index}`}
              className={[
                "inline-flex h-5 min-w-[0.9rem] items-center justify-center bg-[#1a1a1a] px-1 text-center",
                character === " " ? "bg-transparent px-[0.18rem]" : "",
                "solair-tile",
              ].join(" ")}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {character === " " ? "\u00A0" : character}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .solair-tile {
          animation: solairFlip 560ms ease-out both;
          transform-origin: center;
          backface-visibility: hidden;
        }

        @keyframes solairFlip {
          0% {
            opacity: 0;
            transform: perspective(160px) rotateX(-88deg) translateY(-5px);
          }
          48% {
            opacity: 0.9;
            transform: perspective(160px) rotateX(12deg) translateY(1px);
          }
          100% {
            opacity: 1;
            transform: perspective(160px) rotateX(0deg) translateY(0);
          }
        }
      `}</style>
    </section>
  )
}

import { NextResponse } from "next/server"

const FALLBACK_QUOTE = {
  quote: "Discipline is remembering what you want.",
  author: "David Campbell",
}

type ZenQuoteResponse = Array<{
  q?: string
  a?: string
}>

export async function GET() {
  try {
    const response = await fetch("https://zenquotes.io/api/today", {
      next: { revalidate: 60 * 60 * 12 },
    })

    if (!response.ok) {
      return NextResponse.json(FALLBACK_QUOTE)
    }

    const data = (await response.json()) as ZenQuoteResponse
    const item = data[0]

    if (!item?.q) {
      return NextResponse.json(FALLBACK_QUOTE)
    }

    return NextResponse.json({
      quote: item.q,
      author: item.a ?? "Unknown",
    })
  } catch {
    return NextResponse.json(FALLBACK_QUOTE)
  }
}

"use client"

import { useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { resolveAuthRedirectOrigin } from "@/lib/auth-redirect"

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const origin = resolveAuthRedirectOrigin(window.location.origin)
      const redirectTo = `${origin}/auth/callback?next=/reset-password`

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (resetError) throw resetError

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-4 py-10 text-[#1A1A1A]">
      <section className="w-full max-w-md rounded-3xl border border-[#E3DDD3] bg-white p-8 shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:p-10">

        {sent ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EBE2] text-3xl">
              ✉️
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
              <p className="text-sm text-[#6F675D]">
                We sent a password reset link to <span className="font-medium text-[#1A1A1A]">{email}</span>.
                It expires in 1 hour.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-[#1A1A1A] underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8E8579]">Allsenadro</p>
              <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
              <p className="text-sm text-[#6F675D]">
                Enter your email and we'll send you a link to reset it.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#4E473F]">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-2xl border border-[#DDD5CA] bg-white px-4 text-sm outline-none transition focus:border-[#1A1A1A]"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-[#E9B7B7] bg-[#FFF1F1] px-4 py-3 text-sm text-[#A12A2A]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-2xl bg-[#1A1A1A] text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#6F675D]">
              Remember it?{" "}
              <Link href="/login" className="font-medium text-[#1A1A1A] underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  )
}

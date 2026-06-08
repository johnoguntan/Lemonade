"use client"

import { useMemo, useState, useEffect, type FormEvent } from "react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type PageState = "loading" | "form" | "success" | "invalid"

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>("loading")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase fires PASSWORD_RECOVERY once the callback route has exchanged the
  // recovery code and the user lands here with an active recovery session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("form")
      } else if (event === "SIGNED_IN" && session) {
        // Already has a session (e.g. navigated directly after callback exchange)
        setPageState("form")
      } else if (event === "SIGNED_OUT") {
        setPageState("invalid")
      }
    })

    // Also check for an existing recovery session on first load
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const { session } = data
      if (session) {
        setPageState("form")
      } else {
        // Give onAuthStateChange a moment to fire before showing invalid
        const timer = setTimeout(() => setPageState("invalid"), 1500)
        return () => clearTimeout(timer)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPageState("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  if (pageState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A1A1A] border-t-transparent" />
      </main>
    )
  }

  if (pageState === "invalid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-4">
        <section className="w-full max-w-md rounded-3xl border border-[#E3DDD3] bg-white p-8 text-center shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F1] text-3xl">⚠️</div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Link expired or invalid</h1>
          <p className="mt-2 text-sm text-[#6F675D]">
            This reset link has expired or already been used. Request a new one below.
          </p>
          <button
            type="button"
            onClick={() => router.push("/forgot-password")}
            className="mt-6 h-12 w-full rounded-2xl bg-[#1A1A1A] text-sm font-semibold text-white transition hover:opacity-90"
          >
            Request new link
          </button>
        </section>
      </main>
    )
  }

  if (pageState === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-4">
        <section className="w-full max-w-md rounded-3xl border border-[#E3DDD3] bg-white p-8 text-center shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EBE2] text-3xl">🎉</div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="mt-2 text-sm text-[#6F675D]">Your password has been reset. You're now signed in.</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 h-12 w-full rounded-2xl bg-[#1A1A1A] text-sm font-semibold text-white transition hover:opacity-90"
          >
            Go to app
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-4 py-10 text-[#1A1A1A]">
      <section className="w-full max-w-md rounded-3xl border border-[#E3DDD3] bg-white p-8 shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:p-10">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8E8579]">Allsenadro</p>
          <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
          <p className="text-sm text-[#6F675D]">Choose a strong password — at least 8 characters.</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4E473F]">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className="h-12 w-full rounded-2xl border border-[#DDD5CA] bg-white px-4 text-sm outline-none transition focus:border-[#1A1A1A]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4E473F]">Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
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
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  )
}

"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const supabase = useMemo(() => createSupabaseBrowserClient({ rememberMe }), [rememberMe])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw signInError
        }

        router.replace(nextPath)
        router.refresh()
        return
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
              : undefined,
        },
      })

      if (signUpError) {
        throw signUpError
      }

      setMessage("Account created. Check your email.")
      setMode("login")
    } catch (caughtError) {
      if (mode === "login") {
        setError("Incorrect email or password")
      } else {
        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F6F1] px-6 py-10 text-[#1A1A1A]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-[420px]">
          <div className="rounded-[22px] border border-[#E0E0E0] bg-white px-10 py-10 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
            <div className="text-center">
              <h1 className="font-heading text-[34px] font-extrabold uppercase tracking-[0.14em] text-[#1A1A1A]">
                Alessandro
              </h1>
              <hr className="mx-auto mt-5 w-16 border-t border-[#E0E0E0]" />
            </div>

            <form className="mt-10 space-y-7" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#888888]">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-11 w-full rounded-[10px] border border-[#E0E0E0] bg-white px-4 text-[14px] outline-none focus:border-[#1A1A1A] focus:ring-0"
                />
              </label>

              <label className="block space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#888888]">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-11 w-full rounded-[10px] border border-[#E0E0E0] bg-white px-4 text-[14px] outline-none focus:border-[#1A1A1A] focus:ring-0"
                />
              </label>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-[#888888]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#1A1A1A]"
                  />
                  <span className="select-none">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-[10px] bg-[#1A1A1A] text-[12px] font-semibold uppercase tracking-[0.18em] text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "ENTER…" : "ENTER"}
              </button>

              {error ? (
                <div className="text-center text-[12px] text-red-600">{error}</div>
              ) : null}
              {!error && message ? (
                <div className="text-center text-[12px] text-[#888888]">{message}</div>
              ) : null}

              <div className="text-center text-[12px] text-[#888888]">
                {mode === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button type="button" className="text-[#1A1A1A]" onClick={() => setMode("signup")}>
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" className="text-[#1A1A1A]" onClick={() => setMode("login")}>
                      Enter
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F8F6F1]" />}>
      <LoginPageInner />
    </Suspense>
  )
}

"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type AuthMode = "signin" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [mode, setMode] = useState<AuthMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw signInError
        }

        router.push("/")
        router.refresh()
        return
      }

      const trimmedDisplayName = displayName.trim()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: trimmedDisplayName,
          },
        },
      })

      if (signUpError) {
        throw signUpError
      }

      if (data.user && data.session) {
        const { error: profileError } = await supabase
          .from("users")
          .update({ display_name: trimmedDisplayName || null })
          .eq("id", data.user.id)

        if (profileError) {
          throw profileError
        }

        router.push("/")
        router.refresh()
        return
      }

      setError("Account created. Complete email verification, then sign in.")
      setMode("signin")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-4 py-10 text-[#1A1A1A]">
      <section className="w-full max-w-md rounded-3xl border border-[#E3DDD3] bg-white p-8 shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:p-10">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8E8579]">Welcome</p>
          <h1 className="text-3xl font-semibold tracking-tight">Allsenadro</h1>
          <p className="text-sm text-[#6F675D]">Sign in to continue or create a new account.</p>
        </div>

        <div className="mt-8 grid grid-cols-2 rounded-2xl bg-[#F1EBE2] p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-xl px-4 py-2 font-medium transition ${
              mode === "signin" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#7B7267]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl px-4 py-2 font-medium transition ${
              mode === "signup" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#7B7267]"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4E473F]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="h-12 w-full rounded-2xl border border-[#DDD5CA] bg-white px-4 text-sm outline-none transition focus:border-[#1A1A1A]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#4E473F]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              className="h-12 w-full rounded-2xl border border-[#DDD5CA] bg-white px-4 text-sm outline-none transition focus:border-[#1A1A1A]"
            />
          </label>

          {mode === "signup" ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#4E473F]">Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                required
                className="h-12 w-full rounded-2xl border border-[#DDD5CA] bg-white px-4 text-sm outline-none transition focus:border-[#1A1A1A]"
              />
            </label>
          ) : null}

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
            {submitting ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  )
}

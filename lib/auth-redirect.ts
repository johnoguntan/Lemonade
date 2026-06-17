const FALLBACK_AUTH_NEXT_PATH = "/"

export const normalizeAuthNextPath = (value: string | null | undefined) => {
  if (!value) {
    return FALLBACK_AUTH_NEXT_PATH
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return FALLBACK_AUTH_NEXT_PATH
  }

  try {
    const url = new URL(trimmed, "http://localhost")
    return `${url.pathname}${url.search}${url.hash}` || FALLBACK_AUTH_NEXT_PATH
  } catch {
    return FALLBACK_AUTH_NEXT_PATH
  }
}

export const resolveAuthRedirectOrigin = (browserOrigin?: string) => {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "")
  }

  return browserOrigin?.replace(/\/+$/, "") ?? ""
}

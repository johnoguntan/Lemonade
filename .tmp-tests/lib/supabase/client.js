"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseBrowserSession = exports.createSupabaseBrowserClient = void 0;
const ssr_1 = require("@supabase/ssr");
const supabase_1 = require("@/lib/supabase");
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const ALESSANDRO_SESSION_AUTH_STORAGE_KEY = `${supabase_1.ALESSANDRO_AUTH_STORAGE_KEY}-session`;
const browserClientStorageKeys = new WeakMap();
// Persist across Next.js dev HMR by storing on globalThis (browser only).
const getGlobalCache = () => {
    const g = globalThis;
    return g;
};
const createSupabaseBrowserClient = (options = {}) => {
    const { url, anonKey } = (0, supabase_1.getSupabaseEnv)();
    if (!url || !anonKey) {
        throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    const rememberMe = options.rememberMe ?? true;
    const authStorageKey = rememberMe ? supabase_1.ALESSANDRO_AUTH_STORAGE_KEY : ALESSANDRO_SESSION_AUTH_STORAGE_KEY;
    // Avoid creating multiple Supabase browser clients at once.
    // Multiple instances can race on the same storage key and throw:
    // "Lock 'lock:alessandro-auth' was released because another request stole it"
    if (typeof window !== "undefined") {
        const cache = getGlobalCache();
        if (rememberMe && cache.__alessandroSupabaseLocalClient)
            return cache.__alessandroSupabaseLocalClient;
        if (!rememberMe && cache.__alessandroSupabaseSessionClient)
            return cache.__alessandroSupabaseSessionClient;
    }
    const userStorage = typeof window === "undefined"
        ? undefined
        : rememberMe
            ? window.localStorage
            : window.sessionStorage;
    const client = (0, ssr_1.createBrowserClient)(url, anonKey, {
        // IMPORTANT:
        // Do NOT provide a custom `cookies` implementation in the browser.
        // @supabase/ssr will automatically use `document.cookie` (with correct cookie serialization),
        // which is required for server routes/middleware to see the session.
        cookieOptions: rememberMe
            ? { name: supabase_1.ALESSANDRO_AUTH_STORAGE_KEY, path: "/", sameSite: "lax", maxAge: THIRTY_DAYS_SECONDS }
            : { name: supabase_1.ALESSANDRO_AUTH_STORAGE_KEY, path: "/", sameSite: "lax" },
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            storageKey: authStorageKey,
            // In tokens-only mode, user object is stored separately.
            userStorage,
        },
    });
    if (typeof window !== "undefined") {
        const cache = getGlobalCache();
        if (rememberMe)
            cache.__alessandroSupabaseLocalClient = client;
        else
            cache.__alessandroSupabaseSessionClient = client;
    }
    browserClientStorageKeys.set(client, authStorageKey);
    return client;
};
exports.createSupabaseBrowserClient = createSupabaseBrowserClient;
/**
 * Prevent concurrent session reads/refreshes from racing on the Supabase storage lock.
 * This is especially important in Next.js dev where multiple components mount and call
 * auth.getSession/getUser at the same time.
 */
const getSupabaseBrowserSession = async (client) => {
    if (typeof window === "undefined") {
        const { data } = await client.auth.getSession();
        return data.session ?? null;
    }
    const cache = getGlobalCache();
    const storageKey = browserClientStorageKeys.get(client) ?? supabase_1.ALESSANDRO_AUTH_STORAGE_KEY;
    const promiseKey = storageKey === ALESSANDRO_SESSION_AUTH_STORAGE_KEY
        ? "__alessandroSupabaseSessionSessionPromise"
        : "__alessandroSupabaseLocalSessionPromise";
    if (cache[promiseKey]) {
        return (await cache[promiseKey]);
    }
    cache[promiseKey] = client.auth
        .getSession()
        .then((result) => result.data.session ?? null)
        .finally(() => {
        // Release on next tick so multiple callers in same render frame share the promise.
        window.setTimeout(() => {
            cache[promiseKey] = undefined;
        }, 0);
    });
    return (await cache[promiseKey]);
};
exports.getSupabaseBrowserSession = getSupabaseBrowserSession;

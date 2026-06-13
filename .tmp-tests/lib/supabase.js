"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALESSANDRO_AUTH_STORAGE_KEY = exports.getSupabaseEnv = void 0;
const getSupabaseEnv = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return { url, anonKey };
};
exports.getSupabaseEnv = getSupabaseEnv;
exports.ALESSANDRO_AUTH_STORAGE_KEY = "alessandro-auth";

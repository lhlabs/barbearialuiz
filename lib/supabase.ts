"use client";

import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";

const tabSessionStorage = {
  getItem(key: string) {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  publicSupabaseConfig.url,
  publicSupabaseConfig.publishableKey,
  {
    auth: {
      // Keep the admin token only for this browser tab. Closing the tab clears it.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "reserva-auth-session",
      storage: tabSessionStorage,
    },
  },
);

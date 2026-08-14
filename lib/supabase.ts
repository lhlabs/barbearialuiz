"use client";

import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";

export const supabase = createClient(
  publicSupabaseConfig.url,
  publicSupabaseConfig.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "reserva-auth-session",
    },
  },
);


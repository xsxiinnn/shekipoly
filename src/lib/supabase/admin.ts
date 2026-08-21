import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

export function hasSupabaseAdminConfig() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  const { url } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

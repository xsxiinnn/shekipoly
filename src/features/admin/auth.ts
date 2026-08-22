import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { AdminIdentity, AdminRole } from "./types";

function isAdminRole(value: unknown): value is AdminRole {
  return value === "admin" || value === "super_admin";
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: admin, error } = await supabase
    .from("admins")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !admin || !isAdminRole(admin.role)) return null;

  const email =
    typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;
  return { userId, email, role: admin.role };
}

export async function requireAdminIdentity() {
  const identity = await getAdminIdentity();
  if (!identity) throw new Error("ADMIN_FORBIDDEN");
  return identity;
}

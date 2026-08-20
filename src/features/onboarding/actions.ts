"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type { OnboardingActionState } from "./types";

function parsePositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export async function saveProfile(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const nameValue = formData.get("name");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const teamGroupId = parsePositiveInteger(formData.get("team_group_id"));
  const zoneId = parsePositiveInteger(formData.get("zone_id"));
  const teamValue = formData.get("team_id");
  const teamId = typeof teamValue === "string" ? teamValue.trim() : "";
  const fieldErrors: NonNullable<OnboardingActionState["fieldErrors"]> = {};

  if (name.length === 0) {
    fieldErrors.name = "請輸入姓名。";
  } else if (name.length > 80) {
    fieldErrors.name = "姓名不可超過 80 個字。";
  }

  if (!teamGroupId) fieldErrors.teamGroupId = "請選擇團隊。";
  if (!zoneId) fieldErrors.zoneId = "請選擇區。";
  if (!teamId) fieldErrors.teamId = "請選擇小組。";

  if (Object.keys(fieldErrors).length > 0) {
    return { message: "請確認尚未完成的欄位。", fieldErrors };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { message: "登入狀態已失效，請重新整理頁面後再試。" };
  }

  const { data: validZone, error: zoneError } = await supabase
    .from("zones")
    .select("id")
    .eq("id", zoneId!)
    .eq("team_group_id", teamGroupId!)
    .eq("is_active", true)
    .maybeSingle();

  if (zoneError) {
    return { message: "目前無法驗證區域資料，請稍後再試。" };
  }

  if (!validZone) {
    return {
      message: "選擇的區與團隊不相符，請重新選擇。",
      fieldErrors: { zoneId: "請重新選擇區。" },
    };
  }

  const { data: validTeam, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("zone_id", zoneId!)
    .eq("is_active", true)
    .maybeSingle();

  if (teamError) {
    return { message: "目前無法驗證小組資料，請稍後再試。" };
  }

  if (!validTeam) {
    return {
      message: "選擇的小組與區不相符，請重新選擇。",
      fieldErrors: { teamId: "請重新選擇小組。" },
    };
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      name,
      team_id: teamId,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("Unable to save profile", profileError);
    return { message: "儲存資料時發生問題，請稍後再試。" };
  }

  revalidatePath("/report");
  revalidatePath("/map");
  redirect("/report");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { requireAdminIdentity } from "./auth";

export type AdminActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function adminLoginAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", message: "請輸入管理員 Email 與密碼。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || data.user.is_anonymous) {
    return { status: "error", message: "登入資料不正確，請重新確認。" };
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (adminError || !admin) {
    await supabase.auth.signOut();
    return { status: "error", message: "這個帳號沒有管理後台權限。" };
  }

  redirect("/admin");
}

export async function adminLogoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function voidReportAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdminIdentity();
    const reportId = String(formData.get("report_id") ?? "");
    const reason = String(formData.get("void_reason") ?? "").trim();
    if (!isUuid(reportId) || reason.length < 2 || reason.length > 500) {
      return { status: "error", message: "請選擇並填寫有效的作廢原因。" };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_void_report", {
      p_report_id: reportId,
      p_reason: reason,
    });
    if (error) {
      console.error("Unable to void admin report", error);
      return { status: "error", message: "作廢失敗，請重新整理後再試。" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/reports/${reportId}`);
    revalidatePath("/map");
    revalidatePath("/photos");
    return { status: "success", message: "回報已作廢，該小組本週分數已重新計算。" };
  } catch (error) {
    console.error("Unauthorized admin void attempt", error);
    return { status: "error", message: "你沒有執行這項操作的權限。" };
  }
}

export async function setPhotoVisibilityAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdminIdentity();
    const reportId = String(formData.get("report_id") ?? "");
    const visibility = String(formData.get("visibility") ?? "");
    if (!isUuid(reportId) || !["visible", "hidden"].includes(visibility)) {
      return { status: "error", message: "照片狀態格式不正確。" };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_photo_visibility", {
      p_report_id: reportId,
      p_visibility: visibility,
    });
    if (error) {
      console.error("Unable to change photo visibility", error);
      return { status: "error", message: "照片狀態更新失敗，請稍後再試。" };
    }

    revalidatePath("/admin/photos");
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/reports/${reportId}`);
    revalidatePath("/photos");
    return {
      status: "success",
      message: visibility === "hidden" ? "照片已從照片牆隱藏。" : "照片已重新顯示。",
    };
  } catch (error) {
    console.error("Unauthorized admin photo attempt", error);
    return { status: "error", message: "你沒有執行這項操作的權限。" };
  }
}

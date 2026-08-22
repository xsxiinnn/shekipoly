"use server";

import { revalidatePath } from "next/cache";

import {
  createAdminClient,
  hasSupabaseAdminConfig,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { resolveDevelopmentActivityWeek } from "./development-week";
import { detectPhotoMime, photoMimeMatchesPath } from "./photo-signature";
import type { ReportActionState, ReportSuccess } from "./types";

function parseMissionId(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : null;
}

function isReportSuccess(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toReportSuccess(value: Record<string, unknown>): ReportSuccess | null {
  const requiredNumbers = [
    "mission_score",
    "photo_bonus",
    "raw_score",
    "accepted_score",
    "activity_week",
    "team_weekly_score",
    "team_total_score",
    "current_square",
    "steps_to_next_square",
  ] as const;

  if (
    typeof value.report_id !== "string" ||
    typeof value.mission_name !== "string" ||
    typeof value.is_3x5 !== "boolean" ||
    typeof value.has_photo !== "boolean" ||
    typeof value.team_name !== "string" ||
    requiredNumbers.some((key) => typeof value[key] !== "number")
  ) {
    return null;
  }

  return {
    reportId: value.report_id,
    missionName: value.mission_name,
    is3x5: value.is_3x5,
    missionScore: value.mission_score as number,
    photoBonus: value.photo_bonus as number,
    hasPhoto: value.has_photo,
    rawScore: value.raw_score as number,
    acceptedScore: value.accepted_score as number,
    activityWeek: value.activity_week as number,
    teamName: value.team_name,
    teamWeeklyScore: value.team_weekly_score as number,
    teamTotalScore: value.team_total_score as number,
    currentSquare: value.current_square as number,
    stepsToNextSquare: value.steps_to_next_square as number,
  };
}

function friendlyRpcError(message: string) {
  if (message.includes("REPORT_AUTH_REQUIRED")) {
    return "登入狀態已失效，請重新整理後再試。";
  }
  if (message.includes("REPORT_PROFILE_REQUIRED")) {
    return "找不到你的小組資料，請先修改個人資料。";
  }
  if (message.includes("REPORT_MISSION_INVALID")) {
    return "這個任務目前無法回報，請重新選擇。";
  }
  if (message.includes("REPORT_OUTSIDE_ACTIVITY")) {
    return "目前不在活動回報期間，暫時無法送出。";
  }
  if (message.includes("REPORT_PHOTO_CONSENT_REQUIRED")) {
    return "上傳照片前，請先確認照片使用同意。";
  }
  if (
    message.includes("REPORT_PHOTO_NOT_OWNED") ||
    message.includes("REPORT_PHOTO_INVALID")
  ) {
    return "照片驗證沒有成功，請重新選擇照片後再試一次。";
  }
  if (message.includes("REPORT_PHOTO_ALREADY_USED")) {
    return "這張照片已經完成回報，請選擇另一張照片。";
  }
  return "回報沒有成功送出，請確認網路後再試一次。";
}

async function cleanupUploadedPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  photoPath: string | null,
) {
  if (!photoPath || !photoPath.startsWith(`${userId}/`)) return;

  const { error } = await supabase.storage
    .from("mission-photos")
    .remove([photoPath]);
  if (error) {
    console.error("Unable to clean up unreferenced mission photo", error);
  }
}

async function verifyUploadedPhotoBytes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoPath: string,
) {
  const { data, error } = await supabase.storage
    .from("mission-photos")
    .download(photoPath);
  if (error || !data || data.size <= 0 || data.size > 2 * 1024 * 1024) {
    if (error) console.error("Unable to download mission photo for validation", error);
    return false;
  }

  const signature = new Uint8Array(await data.slice(0, 16).arrayBuffer());
  const detectedMime = detectPhotoMime(signature);
  return Boolean(detectedMime && photoMimeMatchesPath(detectedMime, photoPath));
}

export async function submitReport(
  _previousState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const friendValue = formData.get("friend_alias");
  const friendAlias = typeof friendValue === "string" ? friendValue.trim() : "";
  const missionId = parseMissionId(formData.get("mission_id"));
  const is3x5Value = formData.get("is_3x5");
  const is3x5 =
    is3x5Value === "true" ? true : is3x5Value === "false" ? false : null;
  const storyValue = formData.get("story");
  const story = typeof storyValue === "string" ? storyValue.trim() : "";
  const photoPathValue = formData.get("photo_path");
  const photoPath =
    typeof photoPathValue === "string" && photoPathValue.trim()
      ? photoPathValue.trim()
      : null;
  const photoConsent = formData.get("photo_consent") === "true";
  const fieldErrors: NonNullable<ReportActionState["fieldErrors"]> = {};

  if (!friendAlias) {
    fieldErrors.friendAlias = "請填寫這次關心的朋友稱呼。";
  } else if (friendAlias.length > 80) {
    fieldErrors.friendAlias = "朋友稱呼不可超過 80 個字。";
  }

  if (is3x5 === null) fieldErrors.is3x5 = "請選擇是否為 3×5 禱告名單。";
  if (!missionId) fieldErrors.missionId = "請選擇這次完成的任務。";
  if (story.length > 2000) fieldErrors.story = "故事不可超過 2000 個字。";
  if (photoPath && !photoConsent) fieldErrors.photo = "請確認照片使用同意。";
  if (photoPath && photoPath.length > 200) fieldErrors.photo = "照片路徑格式不正確。";

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let authenticatedUserId: string | null = null;
  try {
    supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
      return { status: "error", message: "登入狀態已失效，請重新整理後再試。" };
    }
    authenticatedUserId = claimsData.claims.sub;

    if (Object.keys(fieldErrors).length > 0) {
      await cleanupUploadedPhoto(supabase, authenticatedUserId, photoPath);
      return {
        status: "error",
        message: "還有欄位尚未完成，請確認後再送出。",
        fieldErrors,
      };
    }

    const developmentWeek = resolveDevelopmentActivityWeek(
      process.env.NODE_ENV,
      process.env.DEV_ACTIVITY_WEEK,
    );
    if (developmentWeek.error) {
      console.error("Invalid server-only DEV_ACTIVITY_WEEK; expected 1 through 6.");
      await cleanupUploadedPhoto(supabase, authenticatedUserId, photoPath);
      return {
        status: "error",
        message: "目前的開發測試週次設定有誤，請聯絡開發人員。",
      };
    }

    if (
      (developmentWeek.week !== null || photoPath !== null) &&
      !hasSupabaseAdminConfig()
    ) {
      console.error(
        "Trusted report submission requires server-only SUPABASE_SERVICE_ROLE_KEY.",
      );
      await cleanupUploadedPhoto(supabase, authenticatedUserId, photoPath);
      return {
        status: "error",
        message: "照片回報服務尚未完成安全設定，請聯絡開發人員。",
      };
    }

    if (photoPath && !(await verifyUploadedPhotoBytes(supabase, photoPath))) {
      console.error("Mission photo content signature validation failed.");
      await cleanupUploadedPhoto(supabase, authenticatedUserId, photoPath);
      return {
        status: "error",
        message: "照片驗證沒有成功，請重新選擇照片後再試一次。",
      };
    }

    let rpcResult;
    if (developmentWeek.week !== null) {
      rpcResult = photoPath
        ? await createAdminClient().rpc("submit_report_for_development_v2", {
            p_reporter_id: authenticatedUserId,
            p_friend_alias: friendAlias,
            p_mission_id: missionId!,
            p_is_3x5: is3x5!,
            p_story: story,
            p_activity_week: developmentWeek.week,
            p_photo_path: photoPath,
            p_photo_consent: photoConsent,
          })
        : await createAdminClient().rpc("submit_report_for_development", {
            p_reporter_id: authenticatedUserId,
            p_friend_alias: friendAlias,
            p_mission_id: missionId!,
            p_is_3x5: is3x5!,
            p_story: story,
            p_activity_week: developmentWeek.week,
          });
    } else if (photoPath) {
      rpcResult = await createAdminClient().rpc("submit_report_with_photo", {
        p_reporter_id: authenticatedUserId,
        p_friend_alias: friendAlias,
        p_mission_id: missionId!,
        p_is_3x5: is3x5!,
        p_story: story,
        p_photo_path: photoPath,
        p_photo_consent: photoConsent,
      });
    } else {
      rpcResult = await supabase.rpc("submit_report", {
            p_friend_alias: friendAlias,
            p_mission_id: missionId!,
            p_is_3x5: is3x5!,
            p_story: story,
          });
    }

    const { data, error } = rpcResult;

    if (error) {
      console.error("Unable to submit report", error);
      await cleanupUploadedPhoto(supabase, authenticatedUserId, photoPath);
      return { status: "error", message: friendlyRpcError(error.message) };
    }

    const result = isReportSuccess(data) ? toReportSuccess(data) : null;
    if (!result) {
      console.error("Unexpected submit_report response", data);
      return { status: "error", message: "回報已送出，但進度載入失敗，請查看地圖確認。" };
    }

    revalidatePath("/report");
    revalidatePath("/map");
    revalidatePath("/photos");

    return { status: "success", message: null, result };
  } catch (error) {
    console.error("Unexpected report submission error", error);
    if (supabase && authenticatedUserId) {
      await cleanupUploadedPhoto(supabase, authenticatedUserId, photoPath);
    }
    return {
      status: "error",
      message: "目前無法連線到回報服務，請稍後再試。",
    };
  }
}

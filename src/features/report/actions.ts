"use server";

import { revalidatePath } from "next/cache";

import {
  createAdminClient,
  hasSupabaseAdminConfig,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { resolveDevelopmentActivityWeek } from "./development-week";
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
    typeof value.team_name !== "string" ||
    requiredNumbers.some((key) => typeof value[key] !== "number")
  ) {
    return null;
  }

  return {
    reportId: value.report_id,
    missionName: value.mission_name,
    is3x5: value.is_3x5,
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
  return "回報沒有成功送出，請確認網路後再試一次。";
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
  const fieldErrors: NonNullable<ReportActionState["fieldErrors"]> = {};

  if (!friendAlias) {
    fieldErrors.friendAlias = "請填寫這次關心的朋友稱呼。";
  } else if (friendAlias.length > 80) {
    fieldErrors.friendAlias = "朋友稱呼不可超過 80 個字。";
  }

  if (is3x5 === null) fieldErrors.is3x5 = "請選擇是否為 3×5 禱告名單。";
  if (!missionId) fieldErrors.missionId = "請選擇這次完成的任務。";
  if (story.length > 2000) fieldErrors.story = "故事不可超過 2000 個字。";

  if (Object.keys(fieldErrors).length > 0) {
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
    return {
      status: "error",
      message: "目前的開發測試週次設定有誤，請聯絡開發人員。",
    };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
      return { status: "error", message: "登入狀態已失效，請重新整理後再試。" };
    }

    if (developmentWeek.week !== null && !hasSupabaseAdminConfig()) {
      console.error(
        "DEV_ACTIVITY_WEEK requires the server-only SUPABASE_SERVICE_ROLE_KEY.",
      );
      return {
        status: "error",
        message: "開發週次尚未完成安全設定，請聯絡開發人員。",
      };
    }

    const { data, error } =
      developmentWeek.week !== null
        ? await createAdminClient().rpc("submit_report_for_development", {
            p_reporter_id: claimsData.claims.sub,
            p_friend_alias: friendAlias,
            p_mission_id: missionId!,
            p_is_3x5: is3x5!,
            p_story: story,
            p_activity_week: developmentWeek.week,
          })
        : await supabase.rpc("submit_report", {
            p_friend_alias: friendAlias,
            p_mission_id: missionId!,
            p_is_3x5: is3x5!,
            p_story: story,
          });

    if (error) {
      console.error("Unable to submit report", error);
      return { status: "error", message: friendlyRpcError(error.message) };
    }

    const result = isReportSuccess(data) ? toReportSuccess(data) : null;
    if (!result) {
      console.error("Unexpected submit_report response", data);
      return { status: "error", message: "回報已送出，但進度載入失敗，請查看地圖確認。" };
    }

    revalidatePath("/report");
    revalidatePath("/map");

    return { status: "success", message: null, result };
  } catch (error) {
    console.error("Unexpected report submission error", error);
    return {
      status: "error",
      message: "目前無法連線到回報服務，請稍後再試。",
    };
  }
}

import "server-only";

import { unstable_rethrow } from "next/navigation";

import { getTeamTheme } from "@/config/team-themes";
import { getCurrentProfileSummary } from "@/features/profile/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { startPerformanceTimer } from "@/lib/performance";
import { createClient } from "@/lib/supabase/server";

import type { ReportPageData } from "./types";

const EMPTY_DATA: ReportPageData = {
  profile: null,
  missions: [],
  error: null,
  errorKind: null,
};

export async function getReportPageData(): Promise<ReportPageData> {
  const finishTiming = startPerformanceTimer("getReportData");
  if (!hasSupabaseConfig()) {
    finishTiming();
    return {
      ...EMPTY_DATA,
      error: "尚未設定 Supabase 連線。",
      errorKind: "config",
    };
  }

  try {
    const supabase = await createClient();
    const finishQueryTiming = startPerformanceTimer("getReportData queries");
    const [profileResult, missionsResult] = await Promise.all([
      getCurrentProfileSummary(),
      supabase
        .from("missions")
        .select("id, name, description, base_score")
        .eq("is_active", true)
        .order("id"),
    ]).finally(finishQueryTiming);

    if (missionsResult.error) throw missionsResult.error;
    if (!profileResult.profile) {
      return {
        ...EMPTY_DATA,
        error: profileResult.error,
        errorKind:
          profileResult.errorKind === "session"
            ? "session"
            : profileResult.errorKind === "config"
              ? "config"
              : profileResult.errorKind === "unknown"
                ? "unknown"
                : "profile",
      };
    }

    const missions = (missionsResult.data ?? []).map((mission) => ({
      id: mission.id,
      name: mission.name,
      description: mission.description,
      baseScore: mission.base_score,
      // The current schema defines the formal mission order directly as the
      // constrained primary key (1 through 6); there is no sort_order column.
      sortOrder: mission.id,
    }));

    const teamTheme = getTeamTheme(profileResult.profile.teamGroupName);
    if (!teamTheme) {
      console.warn("Unknown team group theme; report will use text mission cards.", {
        teamGroupName: profileResult.profile.teamGroupName,
      });
    }

    return {
      profile: {
        name: profileResult.profile.name,
        teamGroupName: profileResult.profile.teamGroupName,
        zoneName: profileResult.profile.zoneName,
        teamName: profileResult.profile.teamName,
        teamThemeSlug: teamTheme?.slug ?? null,
      },
      missions,
      error:
        missions.length === 0
          ? "任務資料暫時無法載入，請稍後再試。"
          : null,
      errorKind: missions.length === 0 ? "missions" : null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load report page data", error);
    return {
      ...EMPTY_DATA,
      error: "目前無法載入回報資料，請稍後再試。",
      errorKind: "unknown",
    };
  } finally {
    finishTiming();
  }
}

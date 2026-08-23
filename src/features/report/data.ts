import "server-only";

import { unstable_rethrow } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import type { ReportPageData } from "./types";

const EMPTY_DATA: ReportPageData = {
  profile: null,
  missions: [],
  error: null,
  errorKind: null,
};

export async function getReportPageData(): Promise<ReportPageData> {
  if (!hasSupabaseConfig()) {
    return {
      ...EMPTY_DATA,
      error: "尚未設定 Supabase 連線。",
      errorKind: "config",
    };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return { ...EMPTY_DATA, errorKind: "session" };
    }

    const [profileResult, missionsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("name, team_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("missions")
        .select("id, name, description, base_score")
        .eq("is_active", true)
        .order("id"),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (missionsResult.error) throw missionsResult.error;

    if (!profileResult.data?.team_id) {
      return { ...EMPTY_DATA, errorKind: "profile" };
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("name, zone_id")
      .eq("id", profileResult.data.team_id)
      .eq("is_active", true)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) return { ...EMPTY_DATA, errorKind: "profile" };

    const { data: zone, error: zoneError } = await supabase
      .from("zones")
      .select("name, team_group_id")
      .eq("id", team.zone_id)
      .eq("is_active", true)
      .maybeSingle();

    if (zoneError) throw zoneError;
    if (!zone?.team_group_id) return { ...EMPTY_DATA, errorKind: "profile" };

    const { data: teamGroup, error: teamGroupError } = await supabase
      .from("team_groups")
      .select("name")
      .eq("id", zone.team_group_id)
      .eq("is_active", true)
      .maybeSingle();

    if (teamGroupError) throw teamGroupError;
    if (!teamGroup) return { ...EMPTY_DATA, errorKind: "profile" };

    const missions = (missionsResult.data ?? []).map((mission) => ({
      id: mission.id,
      name: mission.name,
      description: mission.description,
      baseScore: mission.base_score,
    }));

    return {
      profile: {
        name: profileResult.data.name,
        teamGroupName: teamGroup.name,
        zoneName: zone.name,
        teamName: team.name,
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
  }
}

import "server-only";

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { startPerformanceTimer } from "@/lib/performance";
import { createClient } from "@/lib/supabase/server";

export type ProfileSummary = {
  name: string;
  teamGroupName: string;
  zoneName: string;
  teamName: string;
};

export type ProfileSummaryResult = {
  profile: ProfileSummary | null;
  error: string | null;
  errorKind: "config" | "session" | "profile" | "unknown" | null;
};

/** React cache is request-scoped and only deduplicates this user's active render. */
export const getCurrentProfileSummary = cache(async (): Promise<ProfileSummaryResult> => {
  const finishTiming = startPerformanceTimer("getProfile");
  if (!hasSupabaseConfig()) {
    finishTiming();
    return {
      profile: null,
      error: "尚未設定 Supabase 連線。",
      errorKind: "config",
    };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      return { profile: null, error: null, errorKind: "session" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "name, team_id, zone_id, team:teams!profiles_team_zone_fkey(name, zone_id, is_active, zone:zones!teams_zone_id_fkey(name, team_group_id, is_active, team_group:team_groups!zones_team_group_id_fkey(name, is_active)))",
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    const team = Array.isArray(profile?.team) ? profile.team[0] : profile?.team;
    const zone = Array.isArray(team?.zone) ? team.zone[0] : team?.zone;
    const teamGroup = Array.isArray(zone?.team_group)
      ? zone.team_group[0]
      : zone?.team_group;
    if (
      !profile?.team_id ||
      !profile.zone_id ||
      !team ||
      !team.is_active ||
      team.zone_id !== profile.zone_id ||
      !zone ||
      !zone.is_active ||
      !zone.team_group_id ||
      !teamGroup ||
      !teamGroup.is_active
    ) {
      return { profile: null, error: null, errorKind: "profile" };
    }

    return {
      profile: {
        name: profile.name,
        teamGroupName: teamGroup.name,
        zoneName: zone.name,
        teamName: team.name,
      },
      error: null,
      errorKind: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load profile summary", error);
    return {
      profile: null,
      error: "目前無法載入個人資料。",
      errorKind: "unknown",
    };
  } finally {
    finishTiming();
  }
});

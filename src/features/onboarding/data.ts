import "server-only";

import { unstable_rethrow } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import type { OnboardingData } from "./types";

const EMPTY_DATA: OnboardingData = {
  teamGroups: [],
  zones: [],
  teams: [],
  profile: null,
  hasSession: false,
  error: null,
};

export async function getOnboardingData(): Promise<OnboardingData> {
  if (!hasSupabaseConfig()) {
    return {
      ...EMPTY_DATA,
      error: "尚未設定 Supabase 連線，請先完成環境變數設定。",
    };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    const profileQuery = userId
      ? supabase
          .from("profiles")
          .select("name, team_id")
          .eq("id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [teamGroupsResult, zonesResult, teamsResult, profileResult] =
      await Promise.all([
        supabase
          .from("team_groups")
          .select("id, name")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("zones")
          .select("id, name, team_group_id")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("teams")
          .select("id, name, zone_id")
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),
        profileQuery,
      ]);

    const queryError =
      teamGroupsResult.error ??
      zonesResult.error ??
      teamsResult.error ??
      profileResult.error;

    if (queryError) {
      throw queryError;
    }

    const profile = profileResult.data
      ? {
          name: profileResult.data.name,
          teamId: profileResult.data.team_id,
        }
      : null;

    return {
      teamGroups: (teamGroupsResult.data ?? []).map((teamGroup) => ({
        id: teamGroup.id,
        name: teamGroup.name,
      })),
      zones: (zonesResult.data ?? []).map((zone) => ({
        id: zone.id,
        name: zone.name,
        teamGroupId: zone.team_group_id,
      })),
      teams: (teamsResult.data ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        zoneId: team.zone_id,
      })),
      profile,
      hasSession: Boolean(userId),
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load onboarding data", error);
    return {
      ...EMPTY_DATA,
      error: "目前無法載入基本資料，請稍後再試。",
    };
  }
}

import "server-only";

import { unstable_rethrow } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
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
};

export async function getCurrentProfileSummary(): Promise<ProfileSummaryResult> {
  if (!hasSupabaseConfig()) {
    return { profile: null, error: "尚未設定 Supabase 連線。" };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      return { profile: null, error: null };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, team_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return { profile: null, error: null };

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("name, zone_id")
      .eq("id", profile.team_id)
      .single();

    if (teamError) throw teamError;

    const { data: zone, error: zoneError } = await supabase
      .from("zones")
      .select("name, team_group_id")
      .eq("id", team.zone_id)
      .single();

    if (zoneError) throw zoneError;

    if (!zone.team_group_id) {
      return {
        profile: {
          name: profile.name,
          teamGroupName: "待重新選擇團隊",
          zoneName: zone.name,
          teamName: team.name,
        },
        error: null,
      };
    }

    const { data: teamGroup, error: teamGroupError } = await supabase
      .from("team_groups")
      .select("name")
      .eq("id", zone.team_group_id)
      .single();

    if (teamGroupError) throw teamGroupError;

    return {
      profile: {
        name: profile.name,
        teamGroupName: teamGroup.name,
        zoneName: zone.name,
        teamName: team.name,
      },
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load profile summary", error);
    return { profile: null, error: "目前無法載入個人資料。" };
  }
}

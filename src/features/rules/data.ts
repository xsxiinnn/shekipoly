import "server-only";

import { unstable_rethrow } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type RulesData = {
  missions: Array<{
    id: number;
    name: string;
    description: string;
    baseScore: number;
  }>;
  teamGroups: Array<{
    id: number;
    name: string;
    zones: Array<{ id: number; name: string }>;
  }>;
  error: string | null;
};

const EMPTY_DATA: RulesData = { missions: [], teamGroups: [], error: null };

export async function getRulesData(): Promise<RulesData> {
  if (!hasSupabaseConfig()) {
    return { ...EMPTY_DATA, error: "遊戲資料暫時無法載入，請稍後再試。" };
  }

  try {
    const supabase = await createClient();
    const [missionsResult, groupsResult, zonesResult] = await Promise.all([
      supabase
        .from("missions")
        .select("id, name, description, base_score")
        .eq("is_active", true)
        .order("id"),
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
    ]);

    const error = missionsResult.error ?? groupsResult.error ?? zonesResult.error;
    if (error) throw error;

    const zones = zonesResult.data ?? [];
    return {
      missions: (missionsResult.data ?? []).map((mission) => ({
        id: mission.id,
        name: mission.name,
        description: mission.description,
        baseScore: mission.base_score,
      })),
      teamGroups: (groupsResult.data ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        zones: zones
          .filter((zone) => zone.team_group_id === group.id)
          .map((zone) => ({ id: zone.id, name: zone.name })),
      })),
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load rules reference data", error);
    return { ...EMPTY_DATA, error: "遊戲資料暫時無法載入，請稍後再試。" };
  }
}

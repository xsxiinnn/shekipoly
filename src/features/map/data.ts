import "server-only";

import { unstable_rethrow } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { getCurrentSquare, getPointsToNextSquare } from "./scoring";
import type { MapData, MapTeam, MapTeamGroup } from "./types";

const FLAG_COLORS = [
  "#e85d4a",
  "#287f72",
  "#e2a93b",
  "#6f68b3",
  "#3284b8",
  "#c65c8a",
] as const;

function makeTeam(
  id: string,
  name: string,
  zoneName: string,
  totalScore: number,
  colorIndex: number,
): MapTeam {
  return {
    id,
    name,
    zoneName,
    totalScore,
    currentSquare: getCurrentSquare(totalScore),
    pointsToNextSquare: getPointsToNextSquare(totalScore),
    flagColor: FLAG_COLORS[colorIndex % FLAG_COLORS.length],
  };
}

function getEmptyData(error: string | null = null): MapData {
  return { teamGroups: [], initialTeamGroupId: null, error };
}

export async function getMapData(): Promise<MapData> {
  if (!hasSupabaseConfig()) {
    return getEmptyData("尚未設定 Supabase 連線。");
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    const profileQuery = userId
      ? supabase
          .from("profiles")
          .select("team_id")
          .eq("id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [teamGroupsResult, zonesResult, teamsResult, progressResult, profileResult] =
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
        supabase.from("team_progress").select("team_id, accepted_score"),
        profileQuery,
      ]);

    const queryError =
      teamGroupsResult.error ??
      zonesResult.error ??
      teamsResult.error ??
      progressResult.error ??
      profileResult.error;

    if (queryError) {
      throw queryError;
    }

    const scoreByTeam = new Map<string, number>();
    for (const progress of progressResult.data ?? []) {
      scoreByTeam.set(
        progress.team_id,
        (scoreByTeam.get(progress.team_id) ?? 0) + progress.accepted_score,
      );
    }

    const zoneById = new Map(
      (zonesResult.data ?? []).map((zone) => [zone.id, zone] as const),
    );
    const teamsByTeamGroup = new Map<number, MapTeam[]>();

    for (const [index, team] of (teamsResult.data ?? []).entries()) {
      const zone = zoneById.get(team.zone_id);
      if (!zone?.team_group_id) continue;

      const totalScore = scoreByTeam.get(team.id) ?? 0;
      const mapTeam = makeTeam(team.id, team.name, zone.name, totalScore, index);
      const existingTeams = teamsByTeamGroup.get(zone.team_group_id) ?? [];
      existingTeams.push(mapTeam);
      teamsByTeamGroup.set(zone.team_group_id, existingTeams);
    }

    const teamGroups: MapTeamGroup[] = (teamGroupsResult.data ?? []).map(
      (teamGroup) => ({
        id: teamGroup.id,
        name: teamGroup.name,
        teams: teamsByTeamGroup.get(teamGroup.id) ?? [],
      }),
    );

    if (teamGroups.length === 0) {
      return getEmptyData();
    }

    const profileTeam = (teamsResult.data ?? []).find(
      (team) => team.id === profileResult.data?.team_id,
    );
    const profileTeamGroupId = profileTeam
      ? zoneById.get(profileTeam.zone_id)?.team_group_id
      : null;
    const hasProfileTeamGroup = teamGroups.some(
      (teamGroup) => teamGroup.id === profileTeamGroupId,
    );

    return {
      teamGroups,
      initialTeamGroupId: hasProfileTeamGroup
        ? (profileTeamGroupId ?? teamGroups[0].id)
        : teamGroups[0].id,
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load map data", error);
    return getEmptyData("目前無法載入地圖資料。");
  }
}

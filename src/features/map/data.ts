import "server-only";

import { unstable_rethrow } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getServerActivityDataScope } from "@/features/activity/server";

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
  currentSquare: number,
  pointsToNextSquare: number,
  colorIndex: number,
): MapTeam {
  return {
    id,
    name,
    zoneName,
    totalScore,
    currentSquare,
    pointsToNextSquare,
    flagColor: FLAG_COLORS[colorIndex % FLAG_COLORS.length],
  };
}

function getEmptyData(error: string | null = null, isTestMode = false): MapData {
  return { teamGroups: [], initialTeamGroupId: null, error, isTestMode };
}

export async function getMapData(): Promise<MapData> {
  const { isTestMode } = getServerActivityDataScope();
  if (!hasSupabaseConfig()) {
    return getEmptyData("尚未設定 Supabase 連線。", isTestMode);
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
        supabase
          .from("team_map_progress")
          .select(
            "team_id, accepted_total, current_square, steps_to_next_square",
          )
          .eq("is_prelaunch_test", isTestMode),
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

    const progressByTeam = new Map<
      string,
      {
        acceptedTotal: number;
        currentSquare: number;
        stepsToNextSquare: number;
      }
    >();
    for (const progress of progressResult.data ?? []) {
      progressByTeam.set(progress.team_id, {
        acceptedTotal: progress.accepted_total,
        currentSquare: progress.current_square,
        stepsToNextSquare: progress.steps_to_next_square,
      });
    }

    const zoneById = new Map(
      (zonesResult.data ?? []).map((zone) => [zone.id, zone] as const),
    );
    const teamsByTeamGroup = new Map<number, MapTeam[]>();

    for (const [index, team] of (teamsResult.data ?? []).entries()) {
      const zone = zoneById.get(team.zone_id);
      if (!zone?.team_group_id) continue;

      const progress = progressByTeam.get(team.id);
      const mapTeam = makeTeam(
        team.id,
        team.name,
        zone.name,
        progress?.acceptedTotal ?? 0,
        progress?.currentSquare ?? 1,
        progress?.stepsToNextSquare ?? 5,
        index,
      );
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
      return getEmptyData(null, isTestMode);
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
      isTestMode,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load map data", error);
    return getEmptyData("目前無法載入地圖資料。", isTestMode);
  }
}

import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getCurrentSquare, getPointsToNextSquare } from "./scoring";
import type { MapAgeGroup, MapData, MapTeam } from "./types";

const REQUIRED_AGE_GROUPS = ["國中", "高中", "大學", "研究生+社青"] as const;

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
  totalScore: number,
  colorIndex: number,
): MapTeam {
  return {
    id,
    name,
    totalScore,
    currentSquare: getCurrentSquare(totalScore),
    pointsToNextSquare: getPointsToNextSquare(totalScore),
    flagColor: FLAG_COLORS[colorIndex % FLAG_COLORS.length],
  };
}

function getPreviewData(): MapData {
  const ageGroups: MapAgeGroup[] = REQUIRED_AGE_GROUPS.map((name, index) => ({
    id: index + 1,
    name,
    teams:
      index === 0
        ? [
            makeTeam("preview-1", "晨光小隊", 20, 0),
            makeTeam("preview-2", "橄欖枝小隊", 21, 1),
            makeTeam("preview-3", "星火小隊", 23, 2),
            makeTeam("preview-4", "同行小隊", 24, 3),
            makeTeam("preview-5", "暖陽小隊", 42, 4),
            makeTeam("preview-6", "好鄰舍小隊", 61, 5),
            makeTeam("preview-7", "蒲公英小隊", 174, 1),
          ]
        : index === 1
          ? [makeTeam("preview-8", "飛鳥小隊", 8, 4)]
          : [],
  }));

  return { ageGroups, initialAgeGroupId: 1 };
}

function getEmptyData(): MapData {
  const ageGroups = REQUIRED_AGE_GROUPS.map((name, index) => ({
    id: index + 1,
    name,
    teams: [],
  }));

  return { ageGroups, initialAgeGroupId: ageGroups[0].id };
}

export async function getMapData(): Promise<MapData> {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.MAP_USE_PREVIEW_DATA === "true"
  ) {
    return getPreviewData();
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const profileQuery = user
      ? supabase
          .from("profiles")
          .select("age_group_id")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [ageGroupsResult, teamsResult, progressResult, profileResult] =
      await Promise.all([
        supabase
          .from("age_groups")
          .select("id, name")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("teams").select("id, name, age_group_id").order("name"),
        supabase.from("team_progress").select("team_id, accepted_score"),
        profileQuery,
      ]);

    const queryError =
      ageGroupsResult.error ??
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

    const teamsByAgeGroup = new Map<number, MapTeam[]>();
    for (const [index, team] of (teamsResult.data ?? []).entries()) {
      const totalScore = scoreByTeam.get(team.id) ?? 0;
      const mapTeam = makeTeam(team.id, team.name, totalScore, index);
      const existingTeams = teamsByAgeGroup.get(team.age_group_id) ?? [];
      existingTeams.push(mapTeam);
      teamsByAgeGroup.set(team.age_group_id, existingTeams);
    }

    const ageGroups: MapAgeGroup[] = (ageGroupsResult.data ?? []).map(
      (ageGroup) => ({
        id: ageGroup.id,
        name: ageGroup.name,
        teams: teamsByAgeGroup.get(ageGroup.id) ?? [],
      }),
    );

    if (ageGroups.length === 0) {
      return getEmptyData();
    }

    const profileAgeGroupId = profileResult.data?.age_group_id;
    const hasProfileAgeGroup = ageGroups.some(
      (ageGroup) => ageGroup.id === profileAgeGroupId,
    );

    return {
      ageGroups,
      initialAgeGroupId: hasProfileAgeGroup
        ? profileAgeGroupId
        : ageGroups[0].id,
    };
  } catch (error) {
    console.error("Unable to load map data", error);
    return getEmptyData();
  }
}

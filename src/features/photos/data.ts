import "server-only";

import { unstable_rethrow } from "next/navigation";

import { createAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import type { PhotoWallData, PhotoWallItem } from "./types";

const PAGE_SIZE = 24;
const SIGNED_URL_SECONDS = 60 * 60;

function emptyData(error: string | null = null): PhotoWallData {
  return {
    teamGroups: [],
    selectedTeamGroupId: null,
    items: [],
    page: 1,
    hasMore: false,
    error,
    errorKind: null,
  };
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) ? Math.min(20, Math.max(1, page)) : 1;
}

export async function getPhotoWallData(options: {
  teamGroupId?: string;
  page?: string;
}): Promise<PhotoWallData> {
  if (!hasSupabaseConfig()) {
    return { ...emptyData("尚未設定 Supabase 連線。"), errorKind: "config" };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return { ...emptyData(), errorKind: "session" };
    }

    if (!hasSupabaseAdminConfig()) {
      console.error("Photo wall requires server-only SUPABASE_SERVICE_ROLE_KEY.");
      return {
        ...emptyData("照片牆尚未完成安全連線設定。"),
        errorKind: "config",
      };
    }

    const [profileResult, teamGroupsResult, zonesResult, teamsResult, missionsResult] =
      await Promise.all([
        supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle(),
        supabase
          .from("team_groups")
          .select("id, name")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("zones")
          .select("id, name, team_group_id")
          .eq("is_active", true),
        supabase
          .from("teams")
          .select("id, name, zone_id")
          .eq("is_active", true),
        supabase.from("missions").select("id, name").eq("is_active", true),
      ]);

    const referenceError =
      profileResult.error ??
      teamGroupsResult.error ??
      zonesResult.error ??
      teamsResult.error ??
      missionsResult.error;
    if (referenceError) throw referenceError;
    if (!profileResult.data?.team_id) {
      return { ...emptyData(), errorKind: "profile" };
    }

    const teamGroups = teamGroupsResult.data ?? [];
    const zones = zonesResult.data ?? [];
    const teams = teamsResult.data ?? [];
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const zoneById = new Map(zones.map((zone) => [zone.id, zone] as const));
    const missionById = new Map(
      (missionsResult.data ?? []).map((mission) => [mission.id, mission.name] as const),
    );
    const profileTeam = teamById.get(profileResult.data.team_id);
    const profileTeamGroupId = profileTeam
      ? zoneById.get(profileTeam.zone_id)?.team_group_id
      : null;
    if (!profileTeamGroupId) {
      return { ...emptyData(), errorKind: "profile" };
    }

    const requestedTeamGroupId = Number(options.teamGroupId);
    const selectedTeamGroupId = teamGroups.some(
      (teamGroup) => teamGroup.id === requestedTeamGroupId,
    )
      ? requestedTeamGroupId
      : profileTeamGroupId;
    const selectedTeamGroup = teamGroups.find(
      (teamGroup) => teamGroup.id === selectedTeamGroupId,
    );
    const selectedZoneIds = new Set(
      zones
        .filter((zone) => zone.team_group_id === selectedTeamGroupId)
        .map((zone) => zone.id),
    );
    const selectedTeamIds = teams
      .filter((team) => selectedZoneIds.has(team.zone_id))
      .map((team) => team.id);
    const page = parsePage(options.page);
    const requestedCount = PAGE_SIZE * page;

    if (!selectedTeamGroup || selectedTeamIds.length === 0) {
      return {
        ...emptyData(),
        teamGroups,
        selectedTeamGroupId,
        page,
      };
    }

    const admin = createAdminClient();
    const { data: reports, error: reportsError, count } = await admin
      .from("reports")
      .select("id, team_id, mission_id, photo_path, created_at", { count: "exact" })
      .eq("status", "active")
      .eq("photo_is_valid", true)
      .eq("photo_consent", true)
      .eq("photo_visibility", "visible")
      .not("photo_path", "is", null)
      .in("team_id", selectedTeamIds)
      .order("created_at", { ascending: false })
      .range(0, requestedCount - 1);
    if (reportsError) throw reportsError;

    const paths = (reports ?? [])
      .map((report) => report.photo_path)
      .filter((path): path is string => typeof path === "string");
    const { data: signedRows, error: signedError } = paths.length
      ? await admin.storage
          .from("mission-photos")
          .createSignedUrls(paths, SIGNED_URL_SECONDS)
      : { data: [], error: null };
    if (signedError) throw signedError;

    const signedUrlByPath = new Map(
      (signedRows ?? [])
        .filter((row) => row.signedUrl && !row.error)
        .map((row) => [row.path, row.signedUrl] as const),
    );
    const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
    });

    const items: PhotoWallItem[] = [];
    for (const report of reports ?? []) {
      if (!report.photo_path) continue;
      const signedUrl = signedUrlByPath.get(report.photo_path);
      const team = teamById.get(report.team_id);
      const zone = team ? zoneById.get(team.zone_id) : null;
      const missionName = missionById.get(report.mission_id);
      if (!signedUrl || !team || !zone || !missionName) continue;

      items.push({
        id: report.id,
        signedUrl,
        teamGroupName: selectedTeamGroup.name,
        zoneName: zone.name,
        teamName: team.name,
        missionName,
        dateLabel: dateFormatter.format(new Date(report.created_at)),
      });
    }

    return {
      teamGroups,
      selectedTeamGroupId,
      items,
      page,
      hasMore: (count ?? 0) > requestedCount,
      error: null,
      errorKind: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load private photo wall", error);
    return {
      ...emptyData("目前無法載入照片牆，請稍後再試。"),
      errorKind: "unknown",
    };
  }
}

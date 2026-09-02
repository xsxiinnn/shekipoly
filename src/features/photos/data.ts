import "server-only";

import { unstable_rethrow } from "next/navigation";

import { createAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { getCurrentProfileSummary } from "@/features/profile/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { startPerformanceTimer } from "@/lib/performance";
import { createClient } from "@/lib/supabase/server";
import { getServerActivityDataScope } from "@/features/activity/server";

import type { PhotoWallData, PhotoWallItem } from "./types";
import { isPhotoWallEligible, normalizePhotoWallStory } from "./visibility";

const PAGE_SIZE = 16;
const SIGNED_URL_SECONDS = 60 * 60;

function emptyData(error: string | null = null, isTestMode = false): PhotoWallData {
  return {
    teamGroups: [],
    selectedTeamGroupId: null,
    items: [],
    page: 1,
    hasMore: false,
    error,
    errorKind: null,
    isTestMode,
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
  const finishTiming = startPerformanceTimer("getPhotoWallData");
  const { isTestMode } = getServerActivityDataScope();
  if (!hasSupabaseConfig()) {
    finishTiming();
    return { ...emptyData("尚未設定 Supabase 連線。", isTestMode), errorKind: "config" };
  }

  try {
    const supabase = await createClient();

    if (!hasSupabaseAdminConfig()) {
      console.error("Photo wall requires server-only SUPABASE_SERVICE_ROLE_KEY.");
      return {
        ...emptyData("照片牆尚未完成安全連線設定。", isTestMode),
        errorKind: "config",
      };
    }

    const finishReferenceTiming = startPerformanceTimer(
      "getPhotoWallData references",
    );
    const [profileResult, teamGroupsResult, zonesResult, teamsResult, missionsResult] =
      await Promise.all([
        getCurrentProfileSummary(),
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
      ]).finally(finishReferenceTiming);

    const referenceError =
      teamGroupsResult.error ??
      zonesResult.error ??
      teamsResult.error ??
      missionsResult.error;
    if (referenceError) throw referenceError;
    if (!profileResult.profile) {
      return {
        ...emptyData(null, isTestMode),
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

    const teamGroups = teamGroupsResult.data ?? [];
    const zones = zonesResult.data ?? [];
    const teams = teamsResult.data ?? [];
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const zoneById = new Map(zones.map((zone) => [zone.id, zone] as const));
    const missionById = new Map(
      (missionsResult.data ?? []).map((mission) => [mission.id, mission.name] as const),
    );
    const profileTeamGroupId = teamGroups.find(
      (teamGroup) => teamGroup.name === profileResult.profile?.teamGroupName,
    )?.id;
    if (!profileTeamGroupId) {
      return { ...emptyData(null, isTestMode), errorKind: "profile" };
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
        ...emptyData(null, isTestMode),
        teamGroups,
        selectedTeamGroupId,
        page,
      };
    }

    const admin = createAdminClient();
    const finishReportsTiming = startPerformanceTimer("getPhotoWallData reports");
    const { data: reports, error: reportsError, count } = await admin
      .from("reports")
      .select(
        "id, user_id, team_id, mission_id, photo_path, photo_is_valid, photo_visibility, status, created_at, story",
        { count: "exact" },
      )
      .eq("status", "active")
      .eq("photo_is_valid", true)
      .eq("photo_visibility", "visible")
      .eq("is_prelaunch_test", isTestMode)
      .not("photo_path", "is", null)
      .in("team_id", selectedTeamIds)
      .order("created_at", { ascending: false })
      .range(0, requestedCount - 1);
    finishReportsTiming();
    if (reportsError) throw reportsError;

    const reportRows = reports ?? [];
    const paths = reportRows
      .map((report) => report.photo_path)
      .filter((path): path is string => typeof path === "string");
    const reporterIds = [...new Set(reportRows.map((report) => report.user_id))];
    const finishSignedTiming = startPerformanceTimer(
      "getPhotoWallData signed URLs",
    );
    const [signedResult, reportersResult] = await Promise.all([
      paths.length
        ? admin.storage
            .from("mission-photos")
            .createSignedUrls(paths, SIGNED_URL_SECONDS)
        : Promise.resolve({ data: [], error: null }),
      reporterIds.length
        ? admin.from("profiles").select("id, name").in("id", reporterIds)
        : Promise.resolve({ data: [], error: null }),
    ]).finally(finishSignedTiming);
    if (signedResult.error) throw signedResult.error;
    if (reportersResult.error) throw reportersResult.error;

    const signedUrlByPath = new Map(
      (signedResult.data ?? [])
        .filter((row) => row.signedUrl && !row.error)
        .map((row) => [row.path, row.signedUrl] as const),
    );
    const reporterNameById = new Map(
      (reportersResult.data ?? []).map((profile) => [profile.id, profile.name] as const),
    );
    const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
    });

    const items: PhotoWallItem[] = [];
    for (const report of reportRows) {
      if (
        !isPhotoWallEligible({
          status: report.status,
          photoPath: report.photo_path,
          photoIsValid: report.photo_is_valid,
          photoVisibility: report.photo_visibility,
        }) ||
        !report.photo_path
      ) continue;
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
        reporterName: reporterNameById.get(report.user_id) ?? "活動夥伴",
        missionName,
        dateLabel: dateFormatter.format(new Date(report.created_at)),
        story: normalizePhotoWallStory(report.story),
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
      isTestMode,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load private photo wall", error);
    return {
      ...emptyData("目前無法載入照片牆，請稍後再試。", isTestMode),
      errorKind: "unknown",
      isTestMode,
    };
  } finally {
    finishTiming();
  }
}

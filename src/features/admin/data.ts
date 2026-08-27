import "server-only";

import { unstable_rethrow } from "next/navigation";

import { createAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { requireAdminIdentity } from "./auth";
import type {
  AdminDashboardData,
  AdminReferenceData,
  AdminReportDetailData,
  AdminReportFilters,
  AdminReportRow,
  AdminReportsPageData,
  AdminTeamProgressRow,
} from "./types";

const EMPTY_REFERENCES: AdminReferenceData = {
  teamGroups: [],
  zones: [],
  teams: [],
  missions: [],
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseReportRow(value: unknown): AdminReportRow | null {
  const row = objectValue(value);
  if (!row.id || !row.created_at || !row.team_id) return null;
  const status = row.status === "void" ? "void" : "active";
  const photoVisibility = row.photo_visibility === "hidden" ? "hidden" : "visible";
  return {
    id: stringValue(row.id),
    createdAt: stringValue(row.created_at),
    activityWeek: numberValue(row.activity_week),
    reporterName: stringValue(row.reporter_name),
    teamGroupId: numberValue(row.team_group_id),
    teamGroupName: stringValue(row.team_group_name),
    zoneId: numberValue(row.zone_id),
    zoneName: stringValue(row.zone_name),
    teamId: stringValue(row.team_id),
    teamName: stringValue(row.team_name),
    friendAlias: stringValue(row.friend_alias),
    missionId: numberValue(row.mission_id),
    missionName: stringValue(row.mission_name),
    is3x5: row.is_3x5 === true,
    missionScore: numberValue(row.mission_score),
    photoBonus: numberValue(row.photo_bonus),
    rawScore: numberValue(row.raw_score),
    acceptedScore: numberValue(row.accepted_score),
    story: stringValue(row.story),
    photoPath: typeof row.photo_path === "string" ? row.photo_path : null,
    photoVisibility,
    status,
    voidedAt: typeof row.voided_at === "string" ? row.voided_at : null,
    voidReason: typeof row.void_reason === "string" ? row.void_reason : null,
    isTest: row.is_prelaunch_test === true,
  };
}

function scopeValue(scope: AdminReportFilters["dataScope"]) {
  return scope === "all" ? null : scope === "test";
}

function reportRpcArgs(filters: AdminReportFilters, limit: number, offset: number) {
  return {
    p_activity_week: filters.activityWeek,
    p_team_group_id: filters.teamGroupId,
    p_zone_id: filters.zoneId,
    p_team_id: filters.teamId,
    p_mission_id: filters.missionId,
    p_is_3x5: filters.is3x5,
    p_has_photo: filters.hasPhoto,
    p_status: filters.status,
    p_photo_visibility: filters.photoVisibility,
    p_search: filters.search,
    p_limit: limit,
    p_offset: offset,
    p_is_test: scopeValue(filters.dataScope),
  };
}

export async function getAdminReferenceData(): Promise<AdminReferenceData> {
  await requireAdminIdentity();
  const supabase = await createClient();
  const [groups, zones, teams, missions] = await Promise.all([
    supabase.from("team_groups").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("zones").select("id, name, team_group_id").eq("is_active", true).order("sort_order"),
    supabase.from("teams").select("id, name, zone_id").eq("is_active", true).order("sort_order"),
    supabase.from("missions").select("id, name").eq("is_active", true).order("id"),
  ]);
  const error = groups.error ?? zones.error ?? teams.error ?? missions.error;
  if (error) throw error;
  return {
    teamGroups: (groups.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    zones: (zones.data ?? []).flatMap((row) =>
      row.team_group_id
        ? [{ id: row.id, name: row.name, teamGroupId: row.team_group_id }]
        : [],
    ),
    teams: (teams.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      zoneId: row.zone_id,
    })),
    missions: (missions.data ?? []).map((row) => ({ id: row.id, name: row.name })),
  };
}

export async function getAdminDashboardData(options: {
  activityWeek: number | null;
  teamGroupId: number | null;
  zoneId: number | null;
  teamId: string | null;
  dataScope: AdminReportFilters["dataScope"];
}): Promise<AdminDashboardData> {
  try {
    await requireAdminIdentity();
    const supabase = await createClient();
    const [summaryResult, progressResult, references] = await Promise.all([
      supabase.rpc("admin_dashboard_summary", {
        p_activity_week: options.activityWeek,
        p_is_test: scopeValue(options.dataScope),
      }),
      supabase.rpc("admin_team_progress_rows", {
        p_activity_week: options.activityWeek,
        p_team_group_id: options.teamGroupId,
        p_zone_id: options.zoneId,
        p_team_id: options.teamId,
        p_is_test: scopeValue(options.dataScope),
      }),
      getAdminReferenceData(),
    ]);
    if (summaryResult.error) throw summaryResult.error;
    if (progressResult.error) throw progressResult.error;

    const summary = objectValue(summaryResult.data);
    const kpis = objectValue(summary.kpis);
    const groups = Array.isArray(summary.team_groups) ? summary.team_groups : [];
    const progressRows = Array.isArray(progressResult.data) ? progressResult.data : [];

    return {
      kpis: {
        reportCount: numberValue(kpis.report_count),
        careCount: numberValue(kpis.care_count),
        threeByFiveCount: numberValue(kpis.three_by_five_count),
        photoCount: numberValue(kpis.photo_count),
        rawSteps: numberValue(kpis.raw_steps),
        acceptedSteps: numberValue(kpis.accepted_steps),
        participatingTeamCount: numberValue(kpis.participating_team_count),
      },
      teamGroups: groups.map((value) => {
        const row = objectValue(value);
        return {
          id: numberValue(row.id),
          name: stringValue(row.name),
          teamCount: numberValue(row.team_count),
          participatingTeamCount: numberValue(row.participating_team_count),
          reportCount: numberValue(row.report_count),
          rawSteps: numberValue(row.raw_steps),
          acceptedSteps: numberValue(row.accepted_steps),
          photoCount: numberValue(row.photo_count),
        };
      }),
      progress: progressRows.map((value): AdminTeamProgressRow => {
        const row = objectValue(value);
        return {
          teamGroupId: numberValue(row.team_group_id),
          teamGroupName: stringValue(row.team_group_name),
          zoneId: numberValue(row.zone_id),
          zoneName: stringValue(row.zone_name),
          teamId: stringValue(row.team_id),
          teamName: stringValue(row.team_name),
          weeks: [1, 2, 3, 4, 5, 6].map((week) =>
            numberValue(row[`w${week}`]),
          ) as AdminTeamProgressRow["weeks"],
          rawTotal: numberValue(row.raw_total),
          acceptedTotal: numberValue(row.accepted_total),
          currentSquare: numberValue(row.current_square),
          remainder: numberValue(row.remainder),
        };
      }),
      references,
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load admin dashboard", error);
    return {
      kpis: {
        reportCount: 0,
        careCount: 0,
        threeByFiveCount: 0,
        photoCount: 0,
        rawSteps: 0,
        acceptedSteps: 0,
        participatingTeamCount: 0,
      },
      teamGroups: [],
      progress: [],
      references: EMPTY_REFERENCES,
      error: "目前無法載入管理資料，請稍後再試。",
    };
  }
}

export async function getAdminReportsPage(
  filters: AdminReportFilters,
  page: number,
  pageSize = 25,
): Promise<AdminReportsPageData> {
  try {
    await requireAdminIdentity();
    const supabase = await createClient();
    const [result, references] = await Promise.all([
      supabase.rpc("admin_reports_page", reportRpcArgs(filters, pageSize, (page - 1) * pageSize)),
      getAdminReferenceData(),
    ]);
    if (result.error) throw result.error;
    const body = objectValue(result.data);
    const items = Array.isArray(body.items)
      ? body.items.map(parseReportRow).filter((row): row is AdminReportRow => Boolean(row))
      : [];
    return {
      items,
      total: numberValue(body.total),
      page,
      pageSize,
      references,
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load admin reports", error);
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      references: EMPTY_REFERENCES,
      error: "目前無法載入回報紀錄，請稍後再試。",
    };
  }
}

export async function getAdminReportRowsForExport(filters: AdminReportFilters) {
  const page = await getAdminReportsPage(filters, 1, 10000);
  if (page.error) throw new Error("ADMIN_EXPORT_FAILED");
  return page.items;
}

export async function getAdminReportDetail(
  reportId: string,
): Promise<AdminReportDetailData> {
  try {
    await requireAdminIdentity();
    if (!hasSupabaseAdminConfig()) throw new Error("ADMIN_CONFIG_REQUIRED");
    const admin = createAdminClient();
    const { data: report, error } = await admin
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();
    if (error) throw error;
    if (!report) return { report: null, auditLogs: [], error: null };

    const [profile, team, mission, audit] = await Promise.all([
      admin.from("profiles").select("name").eq("id", report.user_id).maybeSingle(),
      admin.from("teams").select("name, zone_id").eq("id", report.team_id).maybeSingle(),
      admin.from("missions").select("name").eq("id", report.mission_id).maybeSingle(),
      admin
        .from("admin_audit_logs")
        .select("id, action, admin_user_id, metadata, created_at")
        .eq("target_report_id", reportId)
        .order("created_at", { ascending: false }),
    ]);
    const queryError = profile.error ?? team.error ?? mission.error ?? audit.error;
    if (queryError) throw queryError;
    const zone = team.data
      ? await admin.from("zones").select("id, name, team_group_id").eq("id", team.data.zone_id).single()
      : { data: null, error: null };
    if (zone.error) throw zone.error;
    const group = zone.data?.team_group_id
      ? await admin.from("team_groups").select("id, name").eq("id", zone.data.team_group_id).single()
      : { data: null, error: null };
    if (group.error) throw group.error;

    let signedUrl: string | null = null;
    if (report.photo_path) {
      const signed = await admin.storage
        .from("mission-photos")
        .createSignedUrl(report.photo_path, 60 * 60);
      if (signed.error) console.error("Unable to sign admin report photo", signed.error);
      else signedUrl = signed.data.signedUrl;
    }

    const parsed = parseReportRow({
      ...report,
      reporter_name: profile.data?.name,
      team_name: team.data?.name,
      zone_id: zone.data?.id,
      zone_name: zone.data?.name,
      team_group_id: group.data?.id,
      team_group_name: group.data?.name,
      mission_name: mission.data?.name,
    });
    if (parsed) parsed.signedUrl = signedUrl;

    return {
      report: parsed,
      auditLogs: (audit.data ?? []).map((row) => ({
        id: row.id,
        action: row.action,
        adminUserId: row.admin_user_id,
        metadata: objectValue(row.metadata),
        createdAt: row.created_at,
      })),
      error: null,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to load admin report detail", error);
    return { report: null, auditLogs: [], error: "目前無法載入回報明細。" };
  }
}

export async function attachSignedUrls(rows: AdminReportRow[]) {
  await requireAdminIdentity();
  if (!hasSupabaseAdminConfig()) throw new Error("ADMIN_CONFIG_REQUIRED");
  const paths = rows.flatMap((row) => (row.photoPath ? [row.photoPath] : []));
  if (paths.length === 0) return rows;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("mission-photos")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const urls = new Map(
    (data ?? []).filter((row) => row.signedUrl).map((row) => [row.path, row.signedUrl]),
  );
  return rows.map((row) => ({
    ...row,
    signedUrl: row.photoPath ? (urls.get(row.photoPath) ?? null) : null,
  }));
}

import type { AdminReportFilters } from "./types";

export type AdminSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function integerInRange(
  value: string | string[] | undefined,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function positiveInteger(value: string | string[] | undefined) {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function optionalBoolean(value: string | string[] | undefined) {
  const normalized = first(value);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function parseAdminReportFilters(
  params: AdminSearchParams,
): AdminReportFilters {
  const statusValue = first(params.status);
  const visibilityValue = first(params.visibility);
  const searchValue = first(params.search)?.trim();
  const scopeValue = first(params.scope);

  return {
    dataScope:
      scopeValue === "test" || scopeValue === "all" ? scopeValue : "official",
    activityWeek: integerInRange(params.week, 1, 6),
    teamGroupId: positiveInteger(params.group),
    zoneId: positiveInteger(params.zone),
    teamId: first(params.team) || null,
    missionId: integerInRange(params.mission, 1, 6),
    is3x5: optionalBoolean(params.is3x5),
    hasPhoto: optionalBoolean(params.photo),
    status: statusValue === "active" || statusValue === "void" ? statusValue : null,
    photoVisibility:
      visibilityValue === "visible" || visibilityValue === "hidden"
        ? visibilityValue
        : null,
    search: searchValue ? searchValue.slice(0, 100) : null,
  };
}

export function parseAdminPage(value: string | string[] | undefined) {
  return Math.min(400, positiveInteger(value) ?? 1);
}

export function filtersToSearchParams(
  filters: AdminReportFilters,
  additions: Record<string, string | number | null> = {},
) {
  const params = new URLSearchParams();
  if (filters.dataScope !== "official") params.set("scope", filters.dataScope);
  if (filters.activityWeek) params.set("week", String(filters.activityWeek));
  if (filters.teamGroupId) params.set("group", String(filters.teamGroupId));
  if (filters.zoneId) params.set("zone", String(filters.zoneId));
  if (filters.teamId) params.set("team", filters.teamId);
  if (filters.missionId) params.set("mission", String(filters.missionId));
  if (filters.is3x5 !== null) params.set("is3x5", String(filters.is3x5));
  if (filters.hasPhoto !== null) params.set("photo", String(filters.hasPhoto));
  if (filters.status) params.set("status", filters.status);
  if (filters.photoVisibility) params.set("visibility", filters.photoVisibility);
  if (filters.search) params.set("search", filters.search);
  for (const [key, value] of Object.entries(additions)) {
    if (value === null) params.delete(key);
    else params.set(key, String(value));
  }
  return params;
}

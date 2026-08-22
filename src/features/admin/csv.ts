import type { AdminReportRow } from "./types";

function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | boolean | null) {
  const normalized = protectSpreadsheetFormula(value === null ? "" : String(value));
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function formatTaipeiTimestamp(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date(value))
    .replace(" ", "T");
}

export function createReportsCsv(rows: AdminReportRow[]) {
  const headers = [
    "created_at_taipei",
    "activity_week",
    "reporter_name",
    "team_group",
    "zone",
    "team",
    "friend_alias",
    "mission",
    "is_3x5",
    "mission_score",
    "photo_bonus",
    "raw_score",
    "accepted_score",
    "story",
    "has_photo",
    "photo_visibility",
    "status",
  ];
  const lines = rows.map((row) =>
    [
      formatTaipeiTimestamp(row.createdAt),
      row.activityWeek,
      row.reporterName,
      row.teamGroupName,
      row.zoneName,
      row.teamName,
      row.friendAlias,
      row.missionName,
      row.is3x5,
      row.missionScore,
      row.photoBonus,
      row.rawScore,
      row.acceptedScore,
      row.story,
      Boolean(row.photoPath),
      row.photoVisibility,
      row.status,
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${headers.join(",")}\r\n${lines.join("\r\n")}`;
}

export function getReportsCsvFilename(activityWeek: number | null, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `reports-${activityWeek ? `W${activityWeek}` : "all"}-${date}.csv`;
}

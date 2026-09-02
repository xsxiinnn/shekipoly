import assert from "node:assert/strict";
import test from "node:test";

import { createReportsCsv, getReportsCsvFilename } from "./csv.ts";
import type { AdminReportRow } from "./types.ts";

const row: AdminReportRow = {
  id: "private-report-id",
  createdAt: "2026-09-10T15:30:00.000Z",
  activityWeek: 2,
  reporterName: "王小明",
  teamGroupId: 3,
  teamGroupName: "洞見團隊",
  zoneId: 9,
  zoneName: "9區",
  teamId: "private-team-id",
  teamName: "品凡小組",
  friendAlias: "=HYPERLINK(\"bad\")",
  missionId: 5,
  missionName: "任務五｜邀約烤肉",
  is3x5: true,
  missionScore: 6,
  photoBonus: 3,
  rawScore: 9,
  acceptedScore: 3,
  story: "有逗號, 也有\"引號\"",
  photoPath: "private-user/private-photo.webp",
  photoVisibility: "visible",
  status: "active",
  voidedAt: null,
  voidReason: null,
  signedUrl: "https://signed.example/private",
  isTest: true,
};

test("CSV is BOM encoded, Taipei formatted, escaped, and privacy-safe", () => {
  const csv = createReportsCsv([row]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /2026-09-10T23:30:00/);
  assert.match(csv, /'\=HYPERLINK/);
  assert.match(csv, /有逗號, 也有""引號""/);
  assert.match(csv, /"test"/);
  assert.doesNotMatch(csv, /private-report-id|private-team-id|private-photo|signed\.example/);
});

test("CSV filename includes week and Taipei date", () => {
  assert.equal(
    getReportsCsvFilename(2, new Date("2026-09-13T16:30:00.000Z")),
    "reports-W2-2026-09-14.csv",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { filtersToSearchParams, parseAdminReportFilters } from "./filters.ts";

test("admin filters accept only supported values", () => {
  const filters = parseAdminReportFilters({
    week: "2",
    group: "3",
    zone: "9",
    team: "team-id",
    mission: "5",
    is3x5: "false",
    photo: "true",
    status: "void",
    visibility: "hidden",
    search: "  永恩  ",
    scope: "test",
  });
  assert.deepEqual(filters, {
    dataScope: "test",
    activityWeek: 2,
    teamGroupId: 3,
    zoneId: 9,
    teamId: "team-id",
    missionId: 5,
    is3x5: false,
    hasPhoto: true,
    status: "void",
    photoVisibility: "hidden",
    search: "永恩",
  });
  assert.match(filtersToSearchParams(filters).toString(), /week=2/);
  assert.match(filtersToSearchParams(filters).toString(), /scope=test/);
});

test("invalid admin filters fail closed to no filter", () => {
  const filters = parseAdminReportFilters({
    week: "7",
    mission: "99",
    is3x5: "maybe",
    status: "deleted",
    visibility: "public",
  });
  assert.equal(filters.activityWeek, null);
  assert.equal(filters.missionId, null);
  assert.equal(filters.is3x5, null);
  assert.equal(filters.status, null);
  assert.equal(filters.photoVisibility, null);
  assert.equal(filters.dataScope, "official");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  getFormalActivityStatus,
  resolveActivityStatus,
} from "./activity-status.ts";

test("production ignores DEV_ACTIVITY_WEEK before launch", () => {
  assert.equal(
    resolveActivityStatus({
      now: new Date("2026-08-21T12:00:00+08:00"),
      nodeEnv: "production",
      developmentWeek: "1",
    }).phase,
    "before",
  );
});

test("development accepts a valid server-only override", () => {
  assert.deepEqual(
    resolveActivityStatus({
      now: new Date("2026-08-21T12:00:00+08:00"),
      nodeEnv: "development",
      developmentWeek: "2",
    }),
    { phase: "active", week: 2, isDevelopmentOverride: true },
  );
});

test("invalid development override fails closed to formal dates", () => {
  assert.equal(
    resolveActivityStatus({
      now: new Date("2026-08-21T12:00:00+08:00"),
      nodeEnv: "development",
      developmentWeek: "7",
    }).phase,
    "before",
  );
});

test("Asia/Taipei W1 starts at 2026-08-31 00:00", () => {
  assert.equal(
    getFormalActivityStatus(new Date("2026-08-31T00:00:00+08:00")).week,
    1,
  );
});

test("a production date inside W2 resolves to W2", () => {
  assert.equal(
    getFormalActivityStatus(new Date("2026-09-10T12:00:00+08:00")).week,
    2,
  );
});

test("Asia/Taipei W6 includes its final minute", () => {
  assert.equal(
    getFormalActivityStatus(new Date("2026-10-11T23:59:59+08:00")).week,
    6,
  );
});

test("activity is over at 2026-10-12 00:00 Asia/Taipei", () => {
  assert.equal(
    getFormalActivityStatus(new Date("2026-10-12T00:00:00+08:00")).phase,
    "after",
  );
});

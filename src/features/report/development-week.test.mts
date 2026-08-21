import assert from "node:assert/strict";
import test from "node:test";

import { resolveDevelopmentActivityWeek } from "./development-week.ts";

test("development uses a valid server-only week override", () => {
  assert.deepEqual(resolveDevelopmentActivityWeek("development", "1"), {
    week: 1,
    error: null,
  });
});

test("development without an override falls back to formal database dates", () => {
  assert.deepEqual(resolveDevelopmentActivityWeek("development", undefined), {
    week: null,
    error: null,
  });
});

test("development rejects an invalid week safely", () => {
  assert.deepEqual(resolveDevelopmentActivityWeek("development", "7"), {
    week: null,
    error: "invalid",
  });
});

test("production ignores an accidentally configured override", () => {
  assert.deepEqual(resolveDevelopmentActivityWeek("production", "1"), {
    week: null,
    error: null,
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import { resolvePrelaunchTestMode } from "./prelaunch-test-mode.ts";

test("enables a valid server-configured prelaunch week before launch", () => {
  assert.deepEqual(resolvePrelaunchTestMode("true", "1", new Date("2026-08-24T12:00:00+08:00")), {
    enabled: true,
    week: 1,
    error: null,
  });
});

test("is disabled unless the mode value is exactly true", () => {
  const beforeLaunch = new Date("2026-08-24T12:00:00+08:00");
  assert.deepEqual(resolvePrelaunchTestMode(undefined, "1", beforeLaunch), {
    enabled: false,
    week: null,
    error: null,
  });
  assert.deepEqual(resolvePrelaunchTestMode("false", "1", beforeLaunch), {
    enabled: false,
    week: null,
    error: null,
  });
});

test("fails closed when the prelaunch week is invalid", () => {
  for (const week of [undefined, "0", "7", "1.5", "W1"]) {
    assert.deepEqual(resolvePrelaunchTestMode("true", week, new Date("2026-08-24T12:00:00+08:00")), {
      enabled: false,
      week: null,
      error: "invalid",
    });
  }
});

test("automatically ignores prelaunch mode at the Asia/Taipei launch boundary", () => {
  assert.deepEqual(
    resolvePrelaunchTestMode("true", "1", new Date("2026-08-31T00:00:00+08:00")),
    { enabled: false, week: null, error: null },
  );
});

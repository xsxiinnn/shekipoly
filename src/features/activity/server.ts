import "server-only";

import {
  isTestActivityStatus,
  resolveActivityStatus,
} from "./activity-status";
import { resolvePrelaunchTestMode } from "./prelaunch-test-mode";

export function getServerPrelaunchTestMode(now = new Date()) {
  return resolvePrelaunchTestMode(
    process.env.PRELAUNCH_TEST_MODE,
    process.env.PRELAUNCH_TEST_WEEK,
    now,
  );
}

export function getServerActivityStatus(now = new Date()) {
  const prelaunch = getServerPrelaunchTestMode(now);
  if (prelaunch.enabled) {
    return {
      phase: "active" as const,
      week: prelaunch.week,
      isDevelopmentOverride: false,
      isPrelaunchTest: true,
    };
  }

  return resolveActivityStatus({
    now,
    nodeEnv: process.env.NODE_ENV,
    developmentWeek: process.env.DEV_ACTIVITY_WEEK,
  });
}

/**
 * Selects the database scope used by student-facing progress pages.
 * Both local DEV_ACTIVITY_WEEK reports and public prelaunch reports are stored
 * in the isolated test scope; formal activity traffic always uses official.
 */
export function getServerActivityDataScope(now = new Date()) {
  const status = getServerActivityStatus(now);
  return {
    status,
    isTestMode: isTestActivityStatus(status),
  };
}

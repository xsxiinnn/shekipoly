export type PrelaunchTestModeResolution =
  | { enabled: false; week: null; error: null }
  | { enabled: true; week: number; error: null }
  | { enabled: false; week: null; error: "invalid" };

export const PRELAUNCH_CUTOFF_UTC = Date.parse("2026-08-30T16:00:00.000Z");

/**
 * Resolve the server-configured public test mode. Callers must only pass values
 * read from server-only environment variables.
 */
export function resolvePrelaunchTestMode(
  configuredMode: string | undefined,
  configuredWeek: string | undefined,
  now = new Date(),
): PrelaunchTestModeResolution {
  if (configuredMode !== "true" || now.getTime() >= PRELAUNCH_CUTOFF_UTC) {
    return { enabled: false, week: null, error: null };
  }

  const week = Number(configuredWeek);
  if (!Number.isInteger(week) || week < 1 || week > 6) {
    return { enabled: false, week: null, error: "invalid" };
  }

  return { enabled: true, week, error: null };
}

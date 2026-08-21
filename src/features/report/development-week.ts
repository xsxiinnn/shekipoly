export type DevelopmentWeekResolution =
  | { week: number; error: null }
  | { week: null; error: null }
  | { week: null; error: "invalid" };

/**
 * Resolve the server-only development override. Production always returns null,
 * even if DEV_ACTIVITY_WEEK was accidentally configured in the deployment.
 */
export function resolveDevelopmentActivityWeek(
  nodeEnv: string | undefined,
  configuredWeek: string | undefined,
): DevelopmentWeekResolution {
  if (nodeEnv === "production" || !configuredWeek) {
    return { week: null, error: null };
  }

  const week = Number(configuredWeek);
  if (!Number.isInteger(week) || week < 1 || week > 6) {
    return { week: null, error: "invalid" };
  }

  return { week, error: null };
}

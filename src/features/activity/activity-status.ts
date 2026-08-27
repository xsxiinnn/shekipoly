export const ACTIVITY_WEEKS = [
  { week: 1, startsOn: "2026-08-31", endsOn: "2026-09-06" },
  { week: 2, startsOn: "2026-09-07", endsOn: "2026-09-13" },
  { week: 3, startsOn: "2026-09-14", endsOn: "2026-09-20" },
  { week: 4, startsOn: "2026-09-21", endsOn: "2026-09-27" },
  { week: 5, startsOn: "2026-09-28", endsOn: "2026-10-04" },
  { week: 6, startsOn: "2026-10-05", endsOn: "2026-10-11" },
] as const;

export type ActivityStatus =
  | { phase: "before"; week: null; isDevelopmentOverride: false; isPrelaunchTest: false }
  | { phase: "active"; week: number; isDevelopmentOverride: boolean; isPrelaunchTest: boolean }
  | { phase: "after"; week: null; isDevelopmentOverride: false; isPrelaunchTest: false };

export function isTestActivityStatus(status: ActivityStatus) {
  return (
    status.phase === "active" &&
    (status.isDevelopmentOverride || status.isPrelaunchTest)
  );
}

const ACTIVITY_START_UTC = Date.parse("2026-08-30T16:00:00.000Z");
const ACTIVITY_END_UTC = Date.parse("2026-10-11T16:00:00.000Z");
const WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

/** Formal activity status at Asia/Taipei boundaries, represented as UTC instants. */
export function getFormalActivityStatus(now: Date): ActivityStatus {
  const timestamp = now.getTime();
  if (timestamp < ACTIVITY_START_UTC) {
    return { phase: "before", week: null, isDevelopmentOverride: false, isPrelaunchTest: false };
  }
  if (timestamp >= ACTIVITY_END_UTC) {
    return { phase: "after", week: null, isDevelopmentOverride: false, isPrelaunchTest: false };
  }

  return {
    phase: "active",
    week: Math.floor((timestamp - ACTIVITY_START_UTC) / WEEK_IN_MILLISECONDS) + 1,
    isDevelopmentOverride: false,
    isPrelaunchTest: false,
  };
}

export function resolveActivityStatus(options: {
  now: Date;
  nodeEnv: string | undefined;
  developmentWeek: string | undefined;
}): ActivityStatus {
  if (options.nodeEnv !== "production" && options.developmentWeek) {
    const week = Number(options.developmentWeek);
    if (Number.isInteger(week) && week >= 1 && week <= 6) {
      return { phase: "active", week, isDevelopmentOverride: true, isPrelaunchTest: false };
    }
  }

  return getFormalActivityStatus(options.now);
}

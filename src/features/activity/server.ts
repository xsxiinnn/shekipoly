import "server-only";

import { resolveActivityStatus } from "./activity-status";

export function getServerActivityStatus(now = new Date()) {
  return resolveActivityStatus({
    now,
    nodeEnv: process.env.NODE_ENV,
    developmentWeek: process.env.DEV_ACTIVITY_WEEK,
  });
}

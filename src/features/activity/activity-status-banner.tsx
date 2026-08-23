import type { ActivityStatus } from "./activity-status";

export function ActivityStatusBanner({ status }: { status: ActivityStatus }) {
  const message =
    status.phase === "before"
      ? "活動將於 8/31 開始 🚩"
      : status.phase === "after"
        ? "本次大富翁活動已結束，謝謝你的參與！"
        : `W${status.week}｜本週關懷進行中`;

  return (
    <aside
      aria-label="活動狀態"
      className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-black leading-6 ${
        status.phase === "active"
          ? "border-brand/20 bg-brand-soft text-brand"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {message}
      {status.isDevelopmentOverride ? (
        <span className="mt-0.5 block text-xs font-semibold opacity-75">
          本機開發測試週次
        </span>
      ) : null}
    </aside>
  );
}

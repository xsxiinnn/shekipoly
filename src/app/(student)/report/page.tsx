import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActivityStatusBanner } from "@/features/activity/activity-status-banner";
import { getServerActivityStatus } from "@/features/activity/server";
import { getReportPageData } from "@/features/report/data";
import { ReportForm } from "@/features/report/report-form";

export const metadata: Metadata = {
  title: "探訪回報",
};

export default async function ReportPage() {
  const [data, activityStatus] = await Promise.all([
    getReportPageData(),
    Promise.resolve(getServerActivityStatus()),
  ]);

  if (data.errorKind === "session") {
    redirect("/onboarding");
  }

  return (
    <div className="min-w-0 overflow-x-clip pb-4 pt-2">
      <header className="text-team-on-primary">
        <p className="text-xs font-bold tracking-[0.18em]">
          青年關懷大富翁
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">探訪回報</h1>
        <p className="mt-2 text-sm leading-6 text-team-on-primary/75">
          每一次關心都很重要，完成後由系統計算小組步數。
        </p>
      </header>

      <ActivityStatusBanner status={activityStatus} />

      {data.profile ? (
        <section className="mt-5 rounded-3xl border border-team-control-border bg-team-control p-5 text-team-control-text shadow-[0_10px_28px_rgba(29,39,36,0.16)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-team-control-text/70">回報人</p>
              <h2 className="mt-1 truncate text-2xl font-black">{data.profile.name}</h2>
            </div>
            <Link
              href="/onboarding?edit=1"
              className="shrink-0 rounded-full border border-team-control-border bg-white/70 px-3 py-2 text-xs font-bold text-team-control-text backdrop-blur"
            >
              修改資料
            </Link>
          </div>
          <p className="mt-4 break-words rounded-2xl bg-white/65 px-3.5 py-3 text-sm font-black leading-6">
            {data.profile.teamGroupName}｜{data.profile.zoneName}｜{data.profile.teamName}
          </p>
        </section>
      ) : null}

      {data.errorKind === "profile" ? (
        <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-black text-amber-900">請先確認你的小組資料</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            目前找不到有效的小組，因此還不能建立回報。請重新選擇團隊、區與小組。
          </p>
          <Link
            href="/onboarding?edit=1"
            className="mt-5 flex h-11 items-center justify-center rounded-2xl bg-amber-800 text-sm font-black text-white"
          >
            修改我的資料
          </Link>
        </section>
      ) : data.error ? (
        <section className="mt-7 rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-red-700">
            {data.errorKind === "missions" ? "目前沒有可回報任務" : "資料載入失敗"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{data.error}</p>
          <a
            href="/report"
            className="mt-5 flex h-11 items-center justify-center rounded-2xl bg-foreground text-sm font-black text-white"
          >
            重新整理
          </a>
        </section>
      ) : data.profile && data.missions.length > 0 ? (
        <ReportForm missions={data.missions} profile={data.profile} />
      ) : null}
    </div>
  );
}

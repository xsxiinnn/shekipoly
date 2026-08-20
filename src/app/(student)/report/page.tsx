import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfileSummary } from "@/features/profile/data";

export const metadata: Metadata = {
  title: "任務回報",
};

export default async function ReportPage() {
  const result = await getCurrentProfileSummary();

  if (!result.profile && !result.error) {
    redirect("/onboarding");
  }

  return (
    <div className="pb-4 pt-2">
      <header>
        <p className="text-xs font-bold tracking-[0.18em] text-brand">青年關懷大富翁</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">任務回報</h1>
      </header>

      {result.profile ? (
        <section className="mt-5 rounded-3xl bg-brand p-5 text-white shadow-[0_10px_28px_rgba(23,124,101,0.2)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white/70">你好</p>
              <h2 className="mt-1 truncate text-2xl font-black">{result.profile.name}</h2>
            </div>
            <Link
              href="/onboarding?edit=1"
              className="shrink-0 rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur"
            >
              修改我的資料
            </Link>
          </div>
          <div className="mt-5 rounded-2xl bg-white/10 px-3.5 py-3">
            <p className="text-[11px] font-semibold text-white/65">所屬團隊</p>
            <p className="mt-1 break-words text-sm font-black leading-6">
              {result.profile.teamGroupName}｜{result.profile.zoneName}｜
              {result.profile.teamName}
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-red-700">個人資料載入失敗</p>
          <p className="mt-2 text-sm leading-6 text-muted">{result.error}</p>
          <a
            href="/report"
            className="mt-4 flex h-10 items-center justify-center rounded-xl bg-foreground text-sm font-bold text-white"
          >
            重新整理
          </a>
        </section>
      )}

      <section className="mt-7 rounded-3xl border border-dashed border-border bg-surface/60 px-5 py-14 text-center">
        <p className="text-sm font-black text-foreground">任務回報功能即將開放</p>
        <p className="mt-2 text-sm text-muted">這一階段先完成使用者與個人資料設定。</p>
      </section>
    </div>
  );
}

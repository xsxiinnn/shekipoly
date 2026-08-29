import type { Metadata } from "next";

import { getOnboardingData } from "@/features/onboarding/data";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";

export const metadata: Metadata = {
  title: "設定個人資料",
};

export default async function OnboardingPage() {
  const data = await getOnboardingData();

  if (!data.error && data.teamGroups.length > 0) {
    return <OnboardingForm {...data} />;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md overflow-x-clip bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] shadow-[0_0_40px_rgba(29,39,36,0.08)]">
      <header>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand text-xl font-black text-white shadow-[0_8px_20px_rgba(23,124,101,0.2)]">
          走
        </div>
        <p className="mt-6 text-xs font-bold tracking-[0.18em] text-brand">
          青年關懷大富翁
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {data.profile ? "修改我的資料" : "先認識你一下"}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
          {data.profile
            ? "更新後，地圖與任務會套用新的團隊與小組資料。"
            : "完成基本資料後，就可以開始參與任務與查看小組進度。"}
        </p>
      </header>

      {data.error ? (
        <section className="mt-8 rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-red-700">資料載入失敗</p>
          <p className="mt-2 text-sm leading-6 text-muted">{data.error}</p>
          <a
            href="/onboarding"
            className="mt-5 flex h-11 items-center justify-center rounded-2xl bg-foreground text-sm font-bold text-white"
          >
            重新整理
          </a>
        </section>
      ) : (
        <section className="mt-8 rounded-3xl border border-dashed border-border bg-white/60 px-5 py-10 text-center">
          <p className="text-sm font-black">尚未設定團隊</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            請聯絡管理員完成基本資料設定後再回來。
          </p>
        </section>
      )}
    </main>
  );
}

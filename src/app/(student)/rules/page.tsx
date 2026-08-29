import type { Metadata } from "next";

import { ACTIVITY_WEEKS } from "@/features/activity/activity-status";
import { getRulesData } from "@/features/rules/data";
import { getServerActivityDataScope } from "@/features/activity/server";

export const metadata: Metadata = {
  title: "遊戲規則",
};

const HOW_TO_PLAY = [
  "關心一位新朋友",
  "完成一項任務",
  "回報並獲得步數",
  "小組旗子一起往前走",
] as const;

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-black tracking-[0.16em] text-brand">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black tracking-tight">{children}</h2>
    </div>
  );
}

export default async function RulesPage() {
  const [data, activityScope] = await Promise.all([
    getRulesData(),
    Promise.resolve(getServerActivityDataScope()),
  ]);

  return (
    <div className="min-w-0 overflow-x-clip pb-4 pt-2">
      <header className="text-team-on-primary">
        <p className="text-xs font-bold tracking-[0.18em]">青年關懷大富翁</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">遊戲規則</h1>
        <p className="mt-2 text-base font-bold text-team-on-primary/75">一起走進他的世界</p>
      </header>

      {activityScope.isTestMode ? (
        <aside className="mt-5 rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-black text-violet-950">
          🧪 目前為測試模式，測試資料不會計入正式活動。
        </aside>
      ) : null}

      <section className="mt-7" aria-labelledby="how-to-play-title">
        <div id="how-to-play-title"><SectionTitle eyebrow="HOW TO PLAY">怎麼玩</SectionTitle></div>
        <ol className="mt-4 grid gap-3">
          {HOW_TO_PLAY.map((step, index) => (
            <li key={step} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-team-control-border bg-team-control text-sm font-black text-team-control-text">
                {index + 1}
              </span>
              <span className="text-sm font-black leading-6">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-3xl bg-foreground p-5 text-sm font-bold leading-7 text-white">
          <p>每 10 步，大富翁前進 1 格。</p>
          <p>每小組每週步數不設上限。</p>
          <p>地圖最高為第 36 格。</p>
        </div>
      </section>

      <section className="mt-9" aria-labelledby="mission-rules-title">
        <div id="mission-rules-title"><SectionTitle eyebrow="MISSIONS">六項任務</SectionTitle></div>
        {data.missions.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {data.missions.map((mission) => (
              <article key={mission.id} className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <h3 className="min-w-0 text-base font-black leading-6">{mission.name}</h3>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-black text-brand">
                    任務 {mission.baseScore} 步
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">{mission.description}</p>
                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-background p-3">
                    <dt className="text-xs font-bold text-muted">一般</dt>
                    <dd className="mt-1 text-lg font-black text-brand">+{mission.baseScore}步</dd>
                  </div>
                  <div className="rounded-2xl bg-brand-soft p-3">
                    <dt className="text-xs font-bold text-brand">3×5 認領名單</dt>
                    <dd className="mt-1 text-lg font-black text-brand">+{mission.baseScore * 2}步</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">
            {data.error ?? "任務資料暫時無法載入，請稍後再試。"}
          </p>
        )}
      </section>

      <section className="mt-9 rounded-3xl border border-[#d7c6f0] bg-[#f4edff] p-5" aria-labelledby="photo-bonus-title">
        <h2 id="photo-bonus-title" className="text-xl font-black">📸 照片 BONUS</h2>
        <p className="mt-3 text-base font-black leading-7">上傳一張有效關懷照片：BONUS +3步</p>
        <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-muted">
          <li>照片 BONUS 不因 3×5 加倍。</li>
          <li>上傳前，請確認照片中的人物知道並同意出現在活動照片牆。</li>
        </ul>
        <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm leading-7">
          <p className="font-black">3×5「來烤肉」</p>
          <p>任務 6 步 ＋ 照片 3 步 ＝ <strong className="text-brand">總共 9 步</strong></p>
          <p className="font-bold text-red-700">不是 12 步。</p>
        </div>
      </section>

      <section className="mt-9" aria-labelledby="important-rules-title">
        <div id="important-rules-title"><SectionTitle eyebrow="IMPORTANT">重要規則</SectionTitle></div>
        <div className="mt-4 space-y-3">
          <article className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h3 className="font-black">同一次關懷只記最高任務</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              如果同一次和同一位朋友完成聊天、送飲料、禱告與邀請烤肉，只選步數最高的「來烤肉」，不要把所有任務加總。
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h3 className="font-black">3×5 加碼</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              沒有 3×5 認領名單也能參加所有任務；如果對象是自己的認領禱告名單，任務步數加倍，照片 BONUS 不加倍。
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h3 className="font-black">每週步數不設上限</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              每一筆有效關懷都會完整計入小組累積步數，不會因為當週回報較多而被截掉。
            </p>
          </article>
        </div>
      </section>

      <section className="mt-9" aria-labelledby="teams-title">
        <div id="teams-title"><SectionTitle eyebrow="TEAMS">四大團隊</SectionTitle></div>
        {data.teamGroups.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.teamGroups.map((group) => (
              <article key={group.id} className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                <h3 className="font-black text-brand">{group.name}</h3>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${group.name}所屬區`}>
                  {group.zones.map((zone) => (
                    <li key={zone.id} className="rounded-full bg-background px-3 py-1.5 text-sm font-bold">{zone.name}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">
            團隊資料暫時無法載入，請稍後再試。
          </p>
        )}
      </section>

      <section className="mt-9" aria-labelledby="dates-title">
        <div id="dates-title"><SectionTitle eyebrow="SCHEDULE">活動日期</SectionTitle></div>
        <ol className="mt-4 grid grid-cols-2 gap-2">
          {ACTIVITY_WEEKS.map((period) => (
            <li key={period.week} className="rounded-2xl border border-border bg-white p-3.5 shadow-sm">
              <p className="text-sm font-black text-brand">W{period.week}</p>
              <p className="mt-1 text-xs font-semibold tabular-nums text-muted">
                {period.startsOn.slice(5).replace("-", "/")}–{period.endsOn.slice(5).replace("-", "/")}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs font-semibold text-muted">活動時間以 Asia/Taipei（台北時間）為準。</p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";

import { AdminFilters } from "@/features/admin/admin-filters";
import { getAdminDashboardData } from "@/features/admin/data";
import { parseAdminReportFilters, type AdminSearchParams } from "@/features/admin/filters";

export const metadata: Metadata = { title: "管理儀表板" };

const KPI_LABELS = [
  ["reportCount", "總回報數"],
  ["careCount", "關懷回報次數"],
  ["threeByFiveCount", "3×5 回報數"],
  ["photoCount", "有照片回報數"],
  ["rawSteps", "Raw Steps"],
  ["acceptedSteps", "Accepted Steps"],
  ["cappedTeamCount", "本週達 30 步小組"],
  ["participatingTeamCount", "有參與小組"],
] as const;

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const filters = parseAdminReportFilters(await searchParams);
  const data = await getAdminDashboardData({
    activityWeek: filters.activityWeek,
    teamGroupId: filters.teamGroupId,
    zoneId: filters.zoneId,
    teamId: filters.teamId,
  });
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-bold text-brand">活動資料中心</p>
        <h1 className="mt-1 text-3xl font-black">儀表板</h1>
        <p className="mt-2 text-sm text-muted">{filters.activityWeek ? `目前顯示 W${filters.activityWeek}` : "目前顯示全活動"}</p>
      </header>
      <AdminFilters references={data.references} filters={filters} />
      {data.error ? <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{data.error}</p> : null}
      <section>
        <h2 className="text-xl font-black">活動總覽</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI_LABELS.map(([key, label]) => (
            <article key={key} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-muted">{label}</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{data.kpis[key]}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-black">團隊進度</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.teamGroups.map((group) => (
            <article key={group.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-brand">{group.name}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">小組</dt><dd className="font-black">{group.teamCount} 組</dd></div>
                <div><dt className="text-muted">已參與</dt><dd className="font-black">{group.participatingTeamCount} 組</dd></div>
                <div><dt className="text-muted">回報</dt><dd className="font-black">{group.reportCount} 筆</dd></div>
                <div><dt className="text-muted">照片</dt><dd className="font-black">{group.photoCount} 張</dd></div>
                <div><dt className="text-muted">Raw</dt><dd className="font-black">{group.rawSteps} 步</dd></div>
                <div><dt className="text-muted">有效</dt><dd className="font-black">{group.acceptedSteps} 步</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-black">小組進度</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-[#edf2ef] text-xs"><tr>{["團隊","區","小組","W1","W2","W3","W4","W5","W6","Raw Total","Accepted Total","Current Square","Remainder"].map((label) => <th key={label} className="px-3 py-3 font-black">{label}</th>)}</tr></thead>
            <tbody>
              {data.progress.map((row) => (
                <tr key={row.teamId} className="border-t border-border">
                  <td className="px-3 py-3 font-bold">{row.teamGroupName}</td><td className="px-3 py-3">{row.zoneName}</td><td className="px-3 py-3 font-black">{row.teamName}</td>
                  {row.weeks.map((score, index) => <td key={index} className={`px-3 py-3 tabular-nums ${filters.activityWeek === index + 1 ? "bg-brand-soft font-black text-brand" : ""}`}>{Math.min(score, 30)} / 30</td>)}
                  <td className="px-3 py-3 font-bold">{row.rawTotal}</td><td className="px-3 py-3 font-bold">{row.acceptedTotal}</td><td className="px-3 py-3 font-black text-brand">第 {row.currentSquare} 格</td><td className="px-3 py-3">{row.remainder}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.progress.length === 0 ? <p className="p-8 text-center text-sm font-bold text-muted">沒有符合條件的小組。</p> : null}
        </div>
      </section>
    </div>
  );
}

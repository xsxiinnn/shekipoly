import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilters } from "@/features/admin/admin-filters";
import { getAdminReportsPage } from "@/features/admin/data";
import {
  filtersToSearchParams,
  parseAdminPage,
  parseAdminReportFilters,
  type AdminSearchParams,
} from "@/features/admin/filters";
import { formatAdminDateTime } from "@/features/admin/format";

export const metadata: Metadata = { title: "回報紀錄" };

function StatusBadge({ status }: { status: "active" | "void" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{status === "active" ? "Active" : "Void"}</span>;
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const query = await searchParams;
  const filters = parseAdminReportFilters(query);
  const page = parseAdminPage(query.page);
  const data = await getAdminReportsPage(filters, page);
  const start = data.total === 0 ? 0 : (page - 1) * data.pageSize + 1;
  const end = Math.min(page * data.pageSize, data.total);
  const previous = filtersToSearchParams(filters, { page: Math.max(1, page - 1) });
  const next = filtersToSearchParams(filters, { page: page + 1 });
  const exportQuery = filtersToSearchParams(filters);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-bold text-brand">資料管理</p><h1 className="mt-1 text-3xl font-black">回報紀錄</h1></div>
        <a href={`/admin/reports/export?${exportQuery}`} className="flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white">匯出目前篩選 CSV</a>
      </header>
      <AdminFilters references={data.references} filters={filters} reportsMode />
      {data.error ? <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{data.error}</p> : null}

      <div className="space-y-3 md:hidden">
        {data.items.map((report) => (
          <Link key={report.id} href={`/admin/reports/${report.id}`} className="block rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">W{report.activityWeek}・{formatAdminDateTime(report.createdAt)}</p><h2 className="mt-1 font-black">{report.teamName}</h2></div><StatusBadge status={report.status} /></div>
            <p className="mt-3 text-sm"><span className="text-muted">回報者：</span>{report.reporterName}</p>
            <p className="mt-1 text-sm"><span className="text-muted">朋友：</span>{report.friendAlias}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-brand-soft px-2 py-1 text-brand">{report.missionName}</span>{report.is3x5 ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">3×5</span> : null}<span className="rounded-full bg-slate-100 px-2 py-1">{report.acceptedScore}/{report.rawScore} 步</span></div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
        <table className="min-w-[1300px] w-full text-left text-sm">
          <thead className="bg-[#edf2ef] text-xs"><tr>{["時間","週次","回報者","團隊／區／小組","朋友稱呼","任務","3×5","任務分","照片","Raw","Accepted","狀態","操作"].map((label) => <th key={label} className="px-3 py-3 font-black">{label}</th>)}</tr></thead>
          <tbody>{data.items.map((report) => <tr key={report.id} className="border-t border-border"><td className="whitespace-nowrap px-3 py-3">{formatAdminDateTime(report.createdAt)}</td><td className="px-3 py-3">W{report.activityWeek}</td><td className="px-3 py-3 font-bold">{report.reporterName}</td><td className="px-3 py-3"><p>{report.teamGroupName}｜{report.zoneName}</p><p className="font-black">{report.teamName}</p></td><td className="px-3 py-3">{report.friendAlias}</td><td className="px-3 py-3">{report.missionName}</td><td className="px-3 py-3">{report.is3x5 ? "是" : "否"}</td><td className="px-3 py-3">{report.missionScore}</td><td className="px-3 py-3">{report.photoPath ? `${report.photoBonus > 0 ? "+3" : "有"}／${report.photoVisibility}` : "無"}</td><td className="px-3 py-3 font-bold">{report.rawScore}</td><td className="px-3 py-3 font-black text-brand">{report.acceptedScore}</td><td className="px-3 py-3"><StatusBadge status={report.status} /></td><td className="px-3 py-3"><Link href={`/admin/reports/${report.id}`} className="font-black text-brand">查看</Link></td></tr>)}</tbody>
        </table>
      </div>
      {data.items.length === 0 && !data.error ? <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center font-bold text-muted">沒有符合篩選條件的回報。</p> : null}
      <footer className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-muted">第 {start}–{end} 筆，共 {data.total} 筆</p>
        <div className="flex gap-2"><Link aria-disabled={page <= 1} href={page <= 1 ? "#" : `/admin/reports?${previous}`} className={`rounded-xl border border-border px-4 py-2 text-sm font-black ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>上一頁</Link><Link aria-disabled={end >= data.total} href={end >= data.total ? "#" : `/admin/reports?${next}`} className={`rounded-xl border border-border px-4 py-2 text-sm font-black ${end >= data.total ? "pointer-events-none opacity-40" : ""}`}>下一頁</Link></div>
      </footer>
    </div>
  );
}

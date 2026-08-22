import type { Metadata } from "next";

/* eslint-disable @next/next/no-img-element -- Private signed URLs are short-lived and cannot use a fixed Next Image host. */

import { AdminFilters } from "@/features/admin/admin-filters";
import { PhotoVisibilityForm } from "@/features/admin/admin-mutation-forms";
import { attachSignedUrls, getAdminReportsPage } from "@/features/admin/data";
import { filtersToSearchParams, parseAdminPage, parseAdminReportFilters, type AdminSearchParams } from "@/features/admin/filters";
import { formatAdminDate } from "@/features/admin/format";

export const metadata: Metadata = { title: "照片管理" };

export default async function AdminPhotosPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const query = await searchParams;
  const parsed = parseAdminReportFilters(query);
  const filters = { ...parsed, hasPhoto: true };
  const page = parseAdminPage(query.page);
  const data = await getAdminReportsPage(filters, page, 24);
  let items = data.items;
  try { items = await attachSignedUrls(items); } catch (error) { console.error("Unable to sign admin photo page", error); }
  const previous = filtersToSearchParams(filters, { page: Math.max(1, page - 1) });
  const next = filtersToSearchParams(filters, { page: page + 1 });
  return (
    <div className="space-y-6">
      <header><p className="text-sm font-bold text-brand">內容管理</p><h1 className="mt-1 text-3xl font-black">照片管理</h1><p className="mt-2 text-sm text-muted">隱藏照片不會改變 report 狀態、Photo Bonus 或 Accepted Steps。</p></header>
      <AdminFilters references={data.references} filters={filters} reportsMode photoOnly />
      {data.error ? <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{data.error}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {items.map((report) => <article key={report.id} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white shadow-sm"><a href={`/admin/reports/${report.id}`} className="block aspect-[4/5] bg-slate-100">{report.signedUrl ? <img src={report.signedUrl} alt={`${report.teamName} ${report.missionName} 照片`} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs font-bold text-muted">照片載入失敗</span>}</a><div className="space-y-2 p-3"><div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-black">{report.teamName}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${report.photoVisibility === "visible" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{report.photoVisibility}</span></div><p className="truncate text-xs font-bold text-brand">{report.teamGroupName}｜{report.zoneName}</p><p className="line-clamp-2 text-xs text-muted">{report.missionName}・{formatAdminDate(report.createdAt)}</p><PhotoVisibilityForm reportId={report.id} visibility={report.photoVisibility} /></div></article>)}
      </div>
      {items.length === 0 && !data.error ? <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center font-bold text-muted">沒有符合條件的照片。</p> : null}
      <div className="flex justify-center gap-2"><a href={`?${previous}`} className={`rounded-xl border border-border bg-white px-4 py-2 text-sm font-black ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>上一頁</a><span className="px-3 py-2 text-sm font-bold">第 {page} 頁</span><a href={`?${next}`} className={`rounded-xl border border-border bg-white px-4 py-2 text-sm font-black ${page*24 >= data.total ? "pointer-events-none opacity-40" : ""}`}>下一頁</a></div>
    </div>
  );
}

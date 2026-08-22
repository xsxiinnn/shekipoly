import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* eslint-disable @next/next/no-img-element -- Private signed URLs are short-lived and cannot use a fixed Next Image host. */

import { PhotoVisibilityForm, VoidReportForm } from "@/features/admin/admin-mutation-forms";
import { getAdminReportDetail } from "@/features/admin/data";
import { formatAdminDateTime } from "@/features/admin/format";

export const metadata: Metadata = { title: "回報明細" };

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminReportDetail(id);
  if (!data.error && !data.report) notFound();
  if (data.error || !data.report) return <p className="rounded-2xl bg-red-50 p-5 font-bold text-red-700">{data.error}</p>;
  const report = data.report;
  return (
    <div className="space-y-6">
      <header><Link href="/admin/reports" className="text-sm font-bold text-brand">← 回報紀錄</Link><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">回報明細</h1><span className={`rounded-full px-3 py-1 text-xs font-black ${report.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{report.status === "active" ? "Active" : "Void"}</span></div></header>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">基本資料</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">{[["回報時間",formatAdminDateTime(report.createdAt)],["活動週次",`W${report.activityWeek}`],["回報者",report.reporterName],["團隊",report.teamGroupName],["區",report.zoneName],["小組",report.teamName],["朋友稱呼",report.friendAlias],["任務",report.missionName],["3×5",report.is3x5?"是":"否"]].map(([label,value]) => <div key={label}><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>)}</dl>{report.story ? <div className="mt-5 border-t border-border pt-5"><p className="text-xs font-bold text-muted">故事</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{report.story}</p></div> : null}</section>
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">計分</h2><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["任務",report.missionScore],["照片 BONUS",report.photoBonus],["Raw",report.rawScore],["Accepted",report.acceptedScore]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f4f6f5] p-3"><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1 text-2xl font-black">{value}</dd></div>)}</dl></section>
          {report.signedUrl ? <section className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">照片</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{report.photoVisibility}</span></div><img src={report.signedUrl} alt="回報照片" className="mt-4 max-h-[700px] w-full rounded-2xl bg-slate-100 object-contain" /><div className="mt-4 max-w-xs"><PhotoVisibilityForm reportId={report.id} visibility={report.photoVisibility} /></div></section> : null}
        </div>
        <aside className="space-y-5">
          {report.status === "active" ? <section className="rounded-2xl border border-red-100 bg-white p-5"><h2 className="font-black text-red-800">作廢回報</h2><p className="mt-2 text-sm leading-6 text-muted">作廢後保留原始紀錄，並重新分配同小組同週所有有效步數。</p><div className="mt-4"><VoidReportForm reportId={report.id} /></div></section> : <section className="rounded-2xl bg-slate-200 p-5"><h2 className="font-black">已作廢</h2><p className="mt-2 text-sm">{report.voidReason}</p>{report.voidedAt ? <p className="mt-2 text-xs text-muted">{formatAdminDateTime(report.voidedAt)}</p> : null}</section>}
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-black">操作紀錄</h2><div className="mt-3 space-y-3">{data.auditLogs.map((log) => <div key={log.id} className="border-l-2 border-brand pl-3 text-sm"><p className="font-bold">{log.action}</p><p className="text-xs text-muted">{formatAdminDateTime(log.createdAt)}</p></div>)}{data.auditLogs.length === 0 ? <p className="text-sm text-muted">尚無管理操作。</p> : null}</div></section>
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { adminLogoutAction } from "@/features/admin/actions";
import { getAdminIdentity } from "@/features/admin/auth";
import { PendingSubmitButton } from "@/components/pending-submit-button";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminIdentity();
  if (!admin) redirect("/admin/login");
  return (
    <div className="min-h-dvh bg-[#f4f6f5] text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-bold text-brand">青年關懷大富翁</p>
            <p className="text-lg font-black">管理後台</p>
          </div>
          <nav className="grid grid-cols-2 gap-2 text-sm font-bold sm:flex sm:flex-wrap" aria-label="管理後台導覽">
            <Link href="/admin" className="rounded-xl border border-border px-3 py-2 text-center">儀表板</Link>
            <Link href="/admin/reports" className="rounded-xl border border-border px-3 py-2 text-center">回報紀錄</Link>
            <Link href="/admin/photos" className="rounded-xl border border-border px-3 py-2 text-center">照片管理</Link>
            <Link href="/report" className="rounded-xl border border-border px-3 py-2 text-center">返回活動網站</Link>
            <form action={adminLogoutAction} className="col-span-2 sm:block">
              <PendingSubmitButton
                pendingLabel="正在登出"
                className="w-full rounded-xl bg-foreground px-3 py-2 text-white disabled:opacity-60"
              >
                登出
              </PendingSubmitButton>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

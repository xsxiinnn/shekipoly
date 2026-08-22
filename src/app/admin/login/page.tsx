import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/features/admin/admin-login-form";
import { getAdminIdentity } from "@/features/admin/auth";

export const metadata: Metadata = { title: "管理員登入" };

export default async function AdminLoginPage() {
  if (await getAdminIdentity()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-[0_18px_60px_rgba(29,39,36,0.12)]">
        <p className="text-xs font-bold tracking-[0.18em] text-brand">青年關懷大富翁</p>
        <h1 className="mt-2 text-2xl font-black">管理後台登入</h1>
        <p className="mt-2 text-sm leading-6 text-muted">請使用已加入 admins table 的正式 Email 帳號登入。</p>
        <AdminLoginForm />
        <a href="/report" className="mt-5 block text-center text-sm font-bold text-brand">返回活動網站</a>
      </section>
    </main>
  );
}

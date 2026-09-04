"use client";

import { useActionState } from "react";

import { PendingOverlay } from "@/components/pending-overlay";

import { adminLoginAction, type AdminActionState } from "./actions";

const initialState: AdminActionState = { status: "idle", message: null };

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLoginAction, initialState);
  return (
    <>
      <PendingOverlay visible={pending} message="請稍等，正在登入…" />
      <form action={action} className="mt-7 space-y-5">
      <label className="block text-sm font-bold">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          disabled={pending}
          className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
      </label>
      <label className="block text-sm font-bold">
        密碼
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={pending}
          className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
      </label>
      {state.message ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-2xl bg-brand font-black text-white disabled:opacity-50"
      >
        {pending ? "登入中…" : "登入管理後台"}
      </button>
      </form>
    </>
  );
}

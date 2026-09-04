"use client";

import { useActionState } from "react";

import { PendingOverlay } from "@/components/pending-overlay";

import {
  setPhotoVisibilityAction,
  voidReportAction,
  type AdminActionState,
} from "./actions";

const initialState: AdminActionState = { status: "idle", message: null };

export function VoidReportForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(voidReportAction, initialState);
  return (
    <>
      <PendingOverlay visible={pending} message="請稍等，正在處理回報…" />
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm("作廢後，這筆回報的有效步數將從小組進度中移除，但原始紀錄會保留。確定繼續嗎？")) {
            event.preventDefault();
          }
        }}
        className="space-y-3"
      >
      <input type="hidden" name="report_id" value={reportId} />
      <label className="block text-sm font-bold">
        作廢原因
        <select
          name="void_reason"
          required
          disabled={pending}
          defaultValue=""
          className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3"
        >
          <option value="" disabled>請選擇原因</option>
          <option value="重複回報">重複回報</option>
          <option value="測試資料">測試資料</option>
          <option value="填寫錯誤">填寫錯誤</option>
          <option value="照片問題">照片問題</option>
          <option value="其他">其他</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-red-700 px-4 text-sm font-black text-white disabled:opacity-50"
      >
        {pending ? "處理中…" : "作廢回報"}
      </button>
      {state.message ? (
        <p className={`text-sm font-bold ${state.status === "success" ? "text-brand" : "text-red-700"}`}>
          {state.message}
        </p>
      ) : null}
      </form>
    </>
  );
}

export function PhotoVisibilityForm({
  reportId,
  visibility,
}: {
  reportId: string;
  visibility: "visible" | "hidden";
}) {
  const [state, action, pending] = useActionState(
    setPhotoVisibilityAction,
    initialState,
  );
  const nextVisibility = visibility === "visible" ? "hidden" : "visible";
  return (
    <>
      <PendingOverlay visible={pending} message="請稍等，正在更新照片…" />
      <form action={action} className="space-y-2">
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="visibility" value={nextVisibility} />
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-black disabled:opacity-50"
      >
        {pending ? "更新中…" : nextVisibility === "hidden" ? "隱藏照片" : "重新顯示"}
      </button>
      {state.message ? (
        <p className={`text-xs font-bold ${state.status === "success" ? "text-brand" : "text-red-700"}`}>
          {state.message}
        </p>
      ) : null}
      </form>
    </>
  );
}

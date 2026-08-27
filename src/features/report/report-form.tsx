"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { createClient } from "@/lib/supabase/client";

import { submitReport } from "./actions";
import { hasHeicFileHint, preparePhoto, type PreparedPhoto } from "./photo";
import { addPhotoFieldsToReportPayload } from "./submission-payload";
import type {
  ReportActionState,
  ReportMission,
  ReportProfile,
  ReportSuccess,
} from "./types";

const initialState: ReportActionState = {
  status: "idle",
  message: null,
};

const fieldClassName =
  "h-12 w-full min-w-0 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

export function ReportSuccessState({ result }: { result: ReportSuccess }) {
  return (
    <section className="mt-7 overflow-hidden rounded-[28px] border border-[#cfe8dd] bg-white shadow-[0_12px_34px_rgba(29,39,36,0.08)]">
      <div className="bg-brand px-5 py-6 text-white">
        <p className="text-3xl" aria-hidden="true">🎉</p>
        <h2 className="mt-2 text-2xl font-black">回報成功！</h2>
        <p className="mt-2 text-base font-bold">{result.missionName}</p>
        <p className="mt-1 text-sm text-white/75">
          {result.is3x5 ? "3×5 禱告名單" : "一般關懷"}・活動 W{result.activityWeek}
        </p>
        {result.isTest ? (
          <p className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-black">
            🧪 已同步到預上線地圖與照片牆；8/31 正式活動將從 0 開始。
          </p>
        ) : null}
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-brand-soft px-4 py-4">
            <p className="text-xs font-bold text-muted">任務</p>
            <p className="mt-1 text-2xl font-black text-brand">
              {result.missionScore}步
            </p>
          </div>
          <div className="rounded-2xl bg-brand-soft px-4 py-4">
            <p className="text-xs font-bold text-muted">照片 BONUS</p>
            <p className="mt-1 text-2xl font-black text-brand">
              +{result.photoBonus}步
            </p>
          </div>
          <div className="rounded-2xl bg-brand-soft px-4 py-4">
            <p className="text-xs font-bold text-muted">本次完成</p>
            <p className="mt-1 text-2xl font-black text-brand">{result.rawScore}步</p>
          </div>
          <div className="rounded-2xl bg-brand-soft px-4 py-4">
            <p className="text-xs font-bold text-muted">本次有效步數</p>
            <p className="mt-1 text-2xl font-black text-brand">
              {result.acceptedScore}步
            </p>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <dt className="text-muted">{result.teamName}本週</dt>
            <dd className="font-black tabular-nums">{result.teamWeeklyScore}步</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <dt className="text-muted">累積有效步數</dt>
            <dd className="font-black tabular-nums">{result.teamTotalScore}步</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <dt className="text-muted">目前位置</dt>
            <dd className="font-black text-brand">第{result.currentSquare}格</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">距離下一格</dt>
            <dd className="font-black">
              {result.currentSquare === 36
                ? "已抵達同行終點"
                : `還差${result.stepsToNextSquare}步`}
            </dd>
          </div>
        </dl>

        <div className="space-y-2 pt-1">
          <a
            href="/report"
            className="flex h-12 items-center justify-center rounded-2xl bg-brand text-base font-black text-white"
          >
            再回報一位
          </a>
          <Link
            href="/map"
            className="flex h-12 items-center justify-center rounded-2xl border border-border text-base font-black text-foreground"
          >
            看大富翁地圖
          </Link>
          {result.hasPhoto ? (
            <Link
              href="/photos"
              className="flex h-12 items-center justify-center rounded-2xl border border-border text-base font-black text-foreground"
            >
              看看照片牆
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ReportForm({
  missions,
  profile,
}: {
  missions: ReportMission[];
  profile: ReportProfile;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [is3x5, setIs3x5] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<(PreparedPhoto & { previewUrl: string }) | null>(
    null,
  );
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isProcessingIphonePhoto, setIsProcessingIphonePhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [state, formAction, isPending] = useActionState(submitReport, initialState);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  useEffect(() => {
    if (!isPending) submittingRef.current = false;
  }, [isPending]);

  const isBusy = isPending || isUploadingPhoto || isProcessingPhoto;

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setIsProcessingPhoto(true);
    setIsProcessingIphonePhoto(hasHeicFileHint(file.type, file.name));
    try {
      const prepared = await preparePhoto(file, {
        onHeicDetected: () => setIsProcessingIphonePhoto(true),
      });
      setPhoto({ ...prepared, previewUrl: URL.createObjectURL(prepared.blob) });
    } catch (error) {
      setPhoto(null);
      setPhotoError(
        error instanceof Error
          ? error.message
          : "這張照片目前無法處理，請換一張照片再試一次。",
      );
    } finally {
      setIsProcessingPhoto(false);
      setIsProcessingIphonePhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || isBusy) return;

    const form = event.currentTarget;
    // Take the complete snapshot before upload state disables form controls.
    // Disabled controls are intentionally omitted by the FormData constructor.
    const payload = new FormData(form);
    submittingRef.current = true;
    setPhotoError(null);
    let uploadedPath: string | null = null;

    try {
      if (photo) {
        setIsUploadingPhoto(true);
        const supabase = createClient();
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) throw new Error("AUTH_REQUIRED");

        uploadedPath = `${data.user.id}/${crypto.randomUUID()}.${photo.extension}`;
        const { error: uploadError } = await supabase.storage
          .from("mission-photos")
          .upload(uploadedPath, photo.blob, {
            cacheControl: "3600",
            contentType: photo.mimeType,
            upsert: false,
          });
        if (uploadError) {
          console.error("Unable to upload mission photo", uploadError);
          throw new Error("UPLOAD_FAILED");
        }
      }

      addPhotoFieldsToReportPayload(payload, uploadedPath);
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          "Submitting report fields",
          Array.from(new Set(payload.keys())),
        );
      }
      setIsUploadingPhoto(false);
      startTransition(() => formAction(payload));
    } catch (error) {
      console.error("Mission photo preparation failed", error);
      submittingRef.current = false;
      setIsUploadingPhoto(false);
      setPhotoError(
        error instanceof Error && error.message === "AUTH_REQUIRED"
          ? "登入狀態已失效，請重新整理後再試。"
          : "照片上傳沒有成功，請重新選擇照片後再試一次。",
      );
    }
  }

  if (state.status === "success" && state.result) {
    return <ReportSuccessState result={state.result} />;
  }

  const selectedMission = missions.find(
    (mission) => mission.id === selectedMissionId,
  );
  const estimatedMissionScore = selectedMission
    ? selectedMission.baseScore * (is3x5 ? 2 : 1)
    : null;
  const estimatedScore =
    estimatedMissionScore === null
      ? null
      : estimatedMissionScore + (photo ? 3 : 0);

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      aria-busy={isBusy}
      className="mt-7 space-y-7"
    >
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <label htmlFor="friend_alias" className="block text-base font-black">
          這次關心誰？
        </label>
        <input
          id="friend_alias"
          name="friend_alias"
          type="text"
          required
          maxLength={80}
          placeholder="小明"
          disabled={isBusy}
          aria-describedby={
            state.fieldErrors?.friendAlias ? "friend-alias-error" : undefined
          }
          className={`${fieldClassName} mt-3`}
        />
        {state.fieldErrors?.friendAlias ? (
          <p id="friend-alias-error" className="mt-2 text-sm font-bold text-red-600">
            {state.fieldErrors.friendAlias}
          </p>
        ) : null}
      </section>

      <fieldset className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <legend className="px-1 text-base font-black">是 3×5 認領禱告名單嗎？</legend>
        <div className="mt-3 grid gap-3">
          {[
            {
              value: true,
              title: "是，我的 3×5 禱告名單",
              description: "任務步數 ×2",
            },
            {
              value: false,
              title: "不是",
              description: "一樣可以一起參與！",
            },
          ].map((option) => {
            const selected = is3x5 === option.value;
            return (
              <label
                key={String(option.value)}
                className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                  selected
                    ? "border-brand bg-brand-soft ring-2 ring-brand/10"
                    : "border-border bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="is_3x5"
                  value={String(option.value)}
                  required
                  disabled={isBusy}
                  checked={selected}
                  onChange={() => setIs3x5(option.value)}
                  className="size-5 shrink-0 accent-brand"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-5">{option.title}</span>
                  <span className="mt-1 block text-xs font-semibold text-muted">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.is3x5 ? (
          <p className="mt-2 text-sm font-bold text-red-600">{state.fieldErrors.is3x5}</p>
        ) : null}
      </fieldset>

      <fieldset className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <legend className="px-1 text-base font-black">選擇本次完成的任務</legend>
        <p className="mt-2 rounded-2xl bg-brand-soft px-3.5 py-3 text-xs font-bold leading-5 text-brand">
          如果同一次關懷完成多個任務，請選擇步數最高的一項回報。
        </p>
        <div className="mt-4 grid gap-3">
          {missions.map((mission) => {
            const selected = selectedMissionId === mission.id;
            return (
              <label
                key={mission.id}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  selected
                    ? "border-brand bg-brand-soft ring-2 ring-brand/10"
                    : "border-border bg-white"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="mission_id"
                    value={mission.id}
                    required
                    disabled={isBusy}
                    checked={selected}
                    onChange={() => setSelectedMissionId(mission.id)}
                    className="mt-0.5 size-5 shrink-0 accent-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-black leading-5">{mission.name}</span>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-brand shadow-sm">
                        {mission.baseScore}步
                      </span>
                    </span>
                    <span className="mt-1.5 block text-xs font-medium leading-5 text-muted">
                      {mission.description}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.missionId ? (
          <p className="mt-2 text-sm font-bold text-red-600">
            {state.fieldErrors.missionId}
          </p>
        ) : null}
      </fieldset>

      <section className="overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-black">📸 留下這次的足跡</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted">
          上傳一張這次關懷的照片，BONUS +3步
        </p>

        {photo ? (
          <div className="mt-4">
            {/* Blob previews are local-only and do not pass through Next Image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt="準備上傳的關懷照片預覽"
              className="aspect-[4/5] w-full rounded-2xl bg-background object-cover"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="h-11 rounded-2xl border border-border text-sm font-black disabled:opacity-50"
              >
                更換照片
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={removePhoto}
                className="h-11 rounded-2xl border border-red-100 text-sm font-black text-red-600 disabled:opacity-50"
              >
                移除照片
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-brand bg-brand-soft text-sm font-black text-brand disabled:opacity-50"
          >
            {isProcessingPhoto
              ? isProcessingIphonePhoto
                ? "正在處理 iPhone 照片…"
                : "正在處理照片…"
              : "拍照 / 選擇照片"}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          disabled={isBusy}
          onChange={(event) => void handlePhotoChange(event.target.files?.[0])}
          className="sr-only"
          aria-label="拍照或選擇照片"
        />
        <p className="mt-3 text-xs font-semibold leading-5 text-muted">
          支援 JPG、PNG、WebP、HEIC、HEIF；系統會先轉換與壓縮再上傳。照片為選填。
        </p>
        <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-900">
          上傳前，請確認照片中的人物知道並同意出現在活動照片牆。
        </p>
        {photoError || state.fieldErrors?.photo ? (
          <p role="alert" className="mt-2 text-sm font-bold leading-6 text-red-600">
            {photoError ?? state.fieldErrors?.photo}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <label htmlFor="story" className="block text-base font-black">
          這次有什麼很神的事？
        </label>
        <p className="mt-1 text-xs font-semibold text-muted">選填</p>
        <textarea
          id="story"
          name="story"
          rows={5}
          maxLength={2000}
          disabled={isBusy}
          placeholder="我們原本只是一起喝飲料，結果他主動聊起最近生活中的需要……"
          className="mt-3 w-full min-w-0 resize-none rounded-2xl border border-border bg-white px-4 py-3 text-base leading-6 text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        {state.fieldErrors?.story ? (
          <p className="mt-2 text-sm font-bold text-red-600">{state.fieldErrors.story}</p>
        ) : null}
      </section>

      <section className="rounded-3xl bg-foreground p-5 text-white shadow-[0_10px_28px_rgba(29,39,36,0.18)]">
        {selectedMission && estimatedScore !== null && estimatedMissionScore !== null ? (
          <>
            <p className="text-xs font-bold text-white/60">即時預估</p>
            <p className="mt-2 text-sm font-bold">任務：{selectedMission.name}</p>
            <p className="mt-1 text-sm text-white/75">
              基本步數：{selectedMission.baseScore}
            </p>
            <p className="mt-1 text-sm text-white/75">
              3×5 加碼：{is3x5 ? "×2" : is3x5 === false ? "無" : "尚未選擇"}
            </p>
            <p className="mt-1 text-sm text-white/75">
              任務小計：{estimatedMissionScore}步
            </p>
            <p className="mt-1 text-sm text-white/75">
              照片 BONUS：{photo ? "+3步" : "無"}
            </p>
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
              <span className="text-sm font-bold text-white/70">預估獲得</span>
              <strong className="text-3xl font-black text-[#9fe3c8]">
                {estimatedScore}步
              </strong>
            </div>
          </>
        ) : (
          <p className="text-sm font-bold leading-6 text-white/70">
            選擇任務後，這裡會顯示預估步數。真正分數由系統送出時重新計算。
          </p>
        )}
      </section>

      {state.message ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isBusy}
        className="flex h-13 w-full items-center justify-center rounded-2xl bg-brand px-5 text-base font-black text-white shadow-[0_8px_20px_rgba(23,124,101,0.22)] disabled:cursor-not-allowed disabled:bg-[#8ba59d] disabled:shadow-none"
      >
        {isUploadingPhoto ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            正在上傳照片…
          </span>
        ) : isPending ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            回報送出中…
          </span>
        ) : (
          "完成回報"
        )}
      </button>

      <p className="px-3 text-center text-xs font-semibold leading-5 text-muted">
        分數、小組與活動週次會由系統安全計算，預估結果不會直接寫入資料庫。
      </p>

      <span className="sr-only" aria-live="polite">
        {isProcessingPhoto
          ? isProcessingIphonePhoto
            ? "正在處理 iPhone 照片"
            : "正在處理照片"
          : isUploadingPhoto
            ? "正在上傳照片"
            : isPending
              ? `正在為 ${profile.name} 送出回報`
              : ""}
      </span>
    </form>
  );
}

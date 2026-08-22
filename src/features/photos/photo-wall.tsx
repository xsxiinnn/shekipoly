"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { PhotoWallData, PhotoWallItem } from "./types";

export function PhotoWall({ data }: { data: PhotoWallData }) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWallItem | null>(null);

  useEffect(() => {
    if (!selectedPhoto) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPhoto(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPhoto]);

  return (
    <>
      <nav aria-label="團隊照片牆" className="mt-5 grid grid-cols-2 gap-2">
        {data.teamGroups.map((teamGroup) => {
          const active = teamGroup.id === data.selectedTeamGroupId;
          return (
            <Link
              key={teamGroup.id}
              href={`/photos?team=${teamGroup.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 min-w-0 items-center justify-center rounded-2xl px-2 text-center text-sm font-black leading-5 ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "border border-border bg-white text-muted"
              }`}
            >
              <span className="break-words">{teamGroup.name}</span>
            </Link>
          );
        })}
      </nav>

      {data.items.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {data.items.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="min-w-0 overflow-hidden rounded-3xl border border-border bg-white text-left shadow-sm"
            >
              {/* Signed private URLs expire; native lazy-loading avoids eager full-wall downloads. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.signedUrl}
                alt={`${photo.teamName}的活動照片`}
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] w-full bg-background object-cover"
              />
              <span className="block min-w-0 p-3">
                <span className="block break-words text-xs font-black leading-5">
                  {photo.teamName}｜{photo.zoneName}
                </span>
                <span className="mt-1 block break-words text-xs font-bold leading-5 text-brand">
                  {photo.missionName}
                </span>
                <span className="mt-1 block text-xs font-semibold text-muted">
                  {photo.dateLabel}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <section className="mt-6 rounded-3xl border border-border bg-white p-6 text-center shadow-sm">
          <p className="text-3xl" aria-hidden="true">📸</p>
          <h2 className="mt-3 text-lg font-black">這個團隊還沒有留下照片</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            完成關懷回報並上傳照片，就會出現在這裡！
          </p>
          <Link
            href="/report"
            className="mt-5 flex h-11 items-center justify-center rounded-2xl bg-brand text-sm font-black text-white"
          >
            去回報
          </Link>
        </section>
      )}

      {data.hasMore ? (
        <Link
          href={`/photos?team=${data.selectedTeamGroupId}&page=${data.page + 1}`}
          className="mt-6 flex h-12 items-center justify-center rounded-2xl border border-brand bg-white text-sm font-black text-brand"
        >
          載入更多
        </Link>
      ) : null}

      {selectedPhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="活動照片預覽"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelectedPhoto(null);
          }}
        >
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex justify-end p-3 pb-0">
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="flex size-11 items-center justify-center rounded-full bg-background text-xl font-black"
                aria-label="關閉照片"
                autoFocus
              >
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.signedUrl}
              alt={`${selectedPhoto.teamName}的活動照片大圖`}
              className="mt-2 max-h-[65dvh] w-full bg-background object-contain"
            />
            <div className="space-y-1 p-5 text-sm leading-6">
              <p className="font-black">{selectedPhoto.teamGroupName}</p>
              <p className="font-bold">
                {selectedPhoto.zoneName}｜{selectedPhoto.teamName}
              </p>
              <p className="font-bold text-brand">{selectedPhoto.missionName}</p>
              <p className="font-semibold text-muted">{selectedPhoto.dateLabel}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getTeamThemeStyle, resolveTeamTheme } from "@/config/team-themes";
import { getPhotoWallData } from "@/features/photos/data";
import { PhotoWall } from "@/features/photos/photo-wall";

export const metadata: Metadata = {
  title: "活動照片牆",
};

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; page?: string }>;
}) {
  const query = await searchParams;
  const data = await getPhotoWallData({
    teamGroupId: query.team,
    page: query.page,
  });

  if (data.errorKind === "session") redirect("/onboarding");

  const selectedTeamGroupName = data.teamGroups.find(
    (teamGroup) => teamGroup.id === data.selectedTeamGroupId,
  )?.name;
  const selectedTheme = resolveTeamTheme(selectedTeamGroupName);

  return (
    <div
      data-team-theme={selectedTheme.slug}
      style={getTeamThemeStyle(selectedTeamGroupName)}
      className="min-w-0 overflow-x-clip pb-4 pt-2"
    >
      <header className="text-team-on-primary">
        <p className="text-xs font-bold tracking-[0.18em]">
          青年關懷大富翁
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">四團隊照片牆</h1>
        <p className="mt-2 text-sm leading-6 text-team-on-primary/75">
          一起看看活動中留下的關懷足跡。
        </p>
      </header>

      {data.isTestMode ? (
        <aside className="mt-5 rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 text-violet-950">
          <p className="text-sm font-black">🧪 預上線完整體驗</p>
          <p className="mt-1 text-xs font-semibold leading-5">
            目前顯示的是即時體驗照片；8/31 正式活動將使用全新的正式資料。
          </p>
        </aside>
      ) : null}

      {data.error ? (
        <section className="mt-6 rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-red-700">照片牆載入失敗</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{data.error}</p>
          <a
            href="/photos"
            className="mt-5 flex h-11 items-center justify-center rounded-2xl bg-foreground text-sm font-black text-white"
          >
            重新整理
          </a>
        </section>
      ) : data.errorKind === "profile" ? (
        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold leading-6 text-amber-900">
            找不到你所屬的團隊，請先更新個人資料。
          </p>
        </section>
      ) : (
        <PhotoWall data={data} />
      )}
    </div>
  );
}

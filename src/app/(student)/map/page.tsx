import type { Metadata } from "next";

import { getMapData } from "@/features/map/data";
import { MapExperience } from "@/features/map/map-experience";

export const metadata: Metadata = {
  title: "遊戲地圖",
};

export default async function MapPage() {
  const mapData = await getMapData();

  return (
    <>
      {mapData.isTestMode ? (
        <aside className="mb-4 rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 text-violet-950">
          <p className="text-sm font-black">🧪 預上線完整體驗</p>
          <p className="mt-1 text-xs font-semibold leading-5">
            目前顯示的是即時體驗進度；8/31 將從 0 開始正式計分。
          </p>
        </aside>
      ) : null}
      <MapExperience {...mapData} />
    </>
  );
}

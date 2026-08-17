import type { Metadata } from "next";

import { getMapData } from "@/features/map/data";
import { MapExperience } from "@/features/map/map-experience";

export const metadata: Metadata = {
  title: "遊戲地圖",
};

export default async function MapPage() {
  const mapData = await getMapData();

  return <MapExperience {...mapData} />;
}

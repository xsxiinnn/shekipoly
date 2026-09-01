import type { TeamThemeSlug } from "@/config/team-themes";

export type MapCellShapeName = "star" | "crown" | "flower" | "heart";

type MapCellArtwork = {
  directory: string;
  shape: MapCellShapeName;
};

export const MAP_CELL_ARTWORK_BY_TEAM = {
  insight: { directory: "insight", shape: "star" },
  glory: { directory: "glory", shape: "crown" },
  river: { directory: "river", shape: "flower" },
  love: { directory: "love", shape: "heart" },
} as const satisfies Record<TeamThemeSlug, MapCellArtwork>;

export function getMapCellShape(teamThemeSlug: TeamThemeSlug) {
  return MAP_CELL_ARTWORK_BY_TEAM[teamThemeSlug].shape;
}

export function getMapCellImage(teamThemeSlug: TeamThemeSlug, square: number) {
  if (!Number.isInteger(square) || square < 1 || square > 36) return null;

  const directory = MAP_CELL_ARTWORK_BY_TEAM[teamThemeSlug].directory;
  return `/map-cells/${directory}/${square}.jpg`;
}

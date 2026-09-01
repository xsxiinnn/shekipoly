import Image from "next/image";

import type { TeamThemeSlug } from "@/config/team-themes";

import { getMapCellImage } from "./map-shapes";

type MapCellArtProps = {
  square: number;
  teamThemeSlug: TeamThemeSlug;
};

export function MapCellArt({ square, teamThemeSlug }: MapCellArtProps) {
  const source = getMapCellImage(teamThemeSlug, square);

  if (!source) return null;

  return (
    <Image
      src={source}
      alt=""
      aria-hidden="true"
      fill
      sizes="(max-width: 640px) 16vw, 70px"
      className="pointer-events-none select-none object-cover"
    />
  );
}

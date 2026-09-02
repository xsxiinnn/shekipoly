import type { CSSProperties } from "react";

export type TeamThemeSlug = "insight" | "glory" | "river" | "love";

export type TeamTheme = {
  slug: TeamThemeSlug;
  teamGroupName: string;
  primary: string;
  secondary: string;
  accent: string;
  softBackground: string;
  surface: string;
  textPrimary: string;
  textOnPrimary: string;
  muted: string;
  border: string;
  selectedRing: string;
};

export const TEAM_THEMES: Record<TeamThemeSlug, TeamTheme> = {
  insight: {
    slug: "insight",
    teamGroupName: "洞見團隊",
    primary: "#010F3B",
    secondary: "#253C79",
    accent: "#8DCAAD",
    softBackground: "#EEF7F2",
    surface: "#FFFFFF",
    textPrimary: "#071747",
    textOnPrimary: "#FFFFFF",
    muted: "#52657D",
    border: "#8AABB3",
    selectedRing: "#8DCAAD",
  },
  glory: {
    slug: "glory",
    teamGroupName: "神榮耀團隊",
    primary: "#C39E62",
    secondary: "#E4C080",
    accent: "#F2D477",
    softBackground: "#FFFBEF",
    surface: "#FFFFFF",
    textPrimary: "#67451E",
    textOnPrimary: "#342109",
    muted: "#79684E",
    border: "#E1B95F",
    selectedRing: "#9B6E2A",
  },
  river: {
    slug: "river",
    teamGroupName: "基河團隊",
    primary: "#6092AE",
    secondary: "#B7D1DF",
    accent: "#F49AB0",
    softBackground: "#EDF7FB",
    surface: "#FFFFFF",
    textPrimary: "#315F7D",
    textOnPrimary: "#08283B",
    muted: "#58748A",
    border: "#91BBCF",
    selectedRing: "#F06F91",
  },
  love: {
    slug: "love",
    teamGroupName: "樂福團隊",
    primary: "#D94F87",
    secondary: "#F1A6BB",
    accent: "#F7C5D4",
    softBackground: "#FFF0F5",
    surface: "#FFFFFF",
    textPrimary: "#8E315D",
    textOnPrimary: "#2E0718",
    muted: "#765564",
    border: "#E994B1",
    selectedRing: "#A83C6B",
  },
};

export const NEUTRAL_TEAM_THEME: TeamTheme = {
  slug: "insight",
  teamGroupName: "",
  primary: "#177C65",
  secondary: "#8EC9B5",
  accent: "#9FE3C8",
  softBackground: "#F7F7F2",
  surface: "#FFFFFF",
  textPrimary: "#1D2724",
  textOnPrimary: "#FFFFFF",
  muted: "#69736F",
  border: "#DDE4E0",
  selectedRing: "#177C65",
};

const THEME_BY_TEAM_GROUP = new Map(
  Object.values(TEAM_THEMES).map((theme) => [theme.teamGroupName, theme] as const),
);

export function getTeamTheme(teamGroupName: string | null | undefined) {
  return teamGroupName ? (THEME_BY_TEAM_GROUP.get(teamGroupName) ?? null) : null;
}

export function resolveTeamTheme(teamGroupName: string | null | undefined) {
  return getTeamTheme(teamGroupName) ?? NEUTRAL_TEAM_THEME;
}

export type TeamThemeStyle = CSSProperties & Record<`--${string}`, string>;

export function getTeamThemeStyle(
  teamGroupName: string | null | undefined,
): TeamThemeStyle {
  const theme = resolveTeamTheme(teamGroupName);
  return {
    "--background": theme.softBackground,
    "--foreground": theme.textPrimary,
    "--surface": theme.surface,
    "--muted": theme.muted,
    // Brand-colored text and focus indicators live on light surfaces, so use
    // the accessible ink color rather than the page background color.
    "--brand": theme.textPrimary,
    "--brand-soft": theme.softBackground,
    "--border": theme.border,
    "--team-secondary": theme.secondary,
    "--team-accent": theme.accent,
    "--team-page-background": theme.primary,
    "--team-text-primary": theme.textPrimary,
    "--team-on-primary": theme.textOnPrimary,
    "--team-control-background": theme.softBackground,
    "--team-control-text": theme.textPrimary,
    "--team-control-border": theme.secondary,
    "--team-selected-ring": theme.selectedRing,
  };
}

export function getMissionImage(
  teamThemeSlug: TeamThemeSlug | null | undefined,
  missionSortOrder: number,
) {
  if (!teamThemeSlug || !Number.isInteger(missionSortOrder)) return null;
  if (missionSortOrder < 1 || missionSortOrder > 6) return null;
  return `/missions/optimized/${teamThemeSlug}/mission-${missionSortOrder}.webp`;
}

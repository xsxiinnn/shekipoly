"use client";

import { useEffect } from "react";

import {
  getTeamThemeStyle,
  resolveTeamTheme,
} from "@/config/team-themes";

export function useStudentShellTheme(teamGroupName: string | null | undefined) {
  useEffect(() => {
    if (!teamGroupName) return;
    const shell = document.querySelector<HTMLElement>("[data-student-shell]");
    if (!shell) return;

    const previousStyle = shell.getAttribute("style");
    const previousTheme = shell.dataset.teamTheme;
    const theme = resolveTeamTheme(teamGroupName);
    const style = getTeamThemeStyle(teamGroupName);

    shell.dataset.teamTheme = theme.slug;
    for (const [property, value] of Object.entries(style)) {
      if (property.startsWith("--")) shell.style.setProperty(property, value);
    }

    return () => {
      if (previousStyle === null) shell.removeAttribute("style");
      else shell.setAttribute("style", previousStyle);
      if (previousTheme) shell.dataset.teamTheme = previousTheme;
      else delete shell.dataset.teamTheme;
    };
  }, [teamGroupName]);
}

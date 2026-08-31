import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  getMissionImage,
  getTeamTheme,
  getTeamThemeStyle,
  TEAM_THEMES,
} from "./team-themes.ts";

const EXPECTED_THEMES = [
  ["洞見團隊", "insight"],
  ["神榮耀團隊", "glory"],
  ["基河團隊", "river"],
  ["樂福團隊", "love"],
] as const;

function relativeLuminance(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  assert.ok(channels && channels.length === 3, `invalid color: ${hex}`);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

test("all four formal team groups resolve through the centralized theme config", () => {
  for (const [name, slug] of EXPECTED_THEMES) {
    assert.equal(getTeamTheme(name)?.slug, slug);
    assert.equal(TEAM_THEMES[slug].teamGroupName, name);
  }
  assert.equal(getTeamTheme("未知團隊"), null);
});

test("mission images map only valid sort orders 1 through 6", () => {
  for (const [, slug] of EXPECTED_THEMES) {
    for (let sortOrder = 1; sortOrder <= 6; sortOrder += 1) {
      const path = getMissionImage(slug, sortOrder);
      assert.equal(path, `/missions/${slug}/mission-${sortOrder}.png`);
      assert.ok(existsSync(`public${path}`), `missing ${path}`);
    }
  }

  assert.equal(getMissionImage("insight", 0), null);
  assert.equal(getMissionImage("insight", 7), null);
  assert.equal(getMissionImage(null, 1), null);
});

test("page background and interactive control colors stay visually separated", () => {
  assert.equal(getTeamThemeStyle("洞見團隊")["--team-page-background"], "#010F3B");
  assert.equal(getTeamThemeStyle("洞見團隊")["--team-control-background"], "#EEF7F2");
  assert.equal(getTeamThemeStyle("基河團隊")["--team-page-background"], "#6092AE");
  assert.equal(getTeamThemeStyle("基河團隊")["--team-control-background"], "#EDF7FB");
});

test("all theme text roles meet WCAG AA contrast on their intended surfaces", () => {
  for (const theme of Object.values(TEAM_THEMES)) {
    assert.ok(
      contrastRatio(theme.primary, theme.textOnPrimary) >= 4.5,
      `${theme.teamGroupName} page text contrast is too low`,
    );
    assert.ok(
      contrastRatio(theme.softBackground, theme.textPrimary) >= 4.5,
      `${theme.teamGroupName} control text contrast is too low`,
    );
    assert.ok(
      contrastRatio(theme.surface, theme.textPrimary) >= 4.5,
      `${theme.teamGroupName} surface text contrast is too low`,
    );
    assert.ok(
      contrastRatio(theme.surface, theme.muted) >= 4.5,
      `${theme.teamGroupName} muted text contrast is too low`,
    );
    assert.equal(getTeamThemeStyle(theme.teamGroupName)["--brand"], theme.textPrimary);
  }
});

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  getMapCellImage,
  getMapCellShape,
  MAP_CELL_ARTWORK_BY_TEAM,
} from "./map-shapes.ts";

test("each team resolves to its own formal map cell shape", () => {
  assert.deepEqual(MAP_CELL_ARTWORK_BY_TEAM, {
    insight: { directory: "insight", shape: "star" },
    glory: { directory: "glory", shape: "crown" },
    river: { directory: "river", shape: "flower" },
    love: { directory: "love", shape: "heart" },
  });
  assert.equal(getMapCellShape("insight"), "star");
  assert.equal(getMapCellShape("glory"), "crown");
  assert.equal(getMapCellShape("river"), "flower");
  assert.equal(getMapCellShape("love"), "heart");
});

test("map cells resolve to the supplied per-team numbered artwork", () => {
  assert.equal(getMapCellImage("insight", 1), "/map-cells/insight/1.jpg");
  assert.equal(getMapCellImage("glory", 27), "/map-cells/glory/27.jpg");
  assert.equal(getMapCellImage("river", 18), "/map-cells/river/18.jpg");
  assert.equal(getMapCellImage("love", 36), "/map-cells/love/36.jpg");
  assert.equal(getMapCellImage("insight", 0), null);
  assert.equal(getMapCellImage("insight", 37), null);
  assert.equal(getMapCellImage("insight", 1.5), null);
});

test("all four teams include every supplied cell image from 1 to 36", () => {
  for (const teamThemeSlug of Object.keys(MAP_CELL_ARTWORK_BY_TEAM)) {
    for (let square = 1; square <= 36; square += 1) {
      const source = getMapCellImage(
        teamThemeSlug as keyof typeof MAP_CELL_ARTWORK_BY_TEAM,
        square,
      );
      assert.ok(source);
      assert.ok(
        existsSync(fileURLToPath(new URL(`../../../public${source}`, import.meta.url))),
        `${teamThemeSlug} square ${square} artwork is missing`,
      );
    }
  }
});

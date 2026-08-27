import assert from "node:assert/strict";
import test from "node:test";

import { isPhotoWallEligible, normalizePhotoWallStory } from "./visibility.ts";

const visiblePhoto = {
  status: "active",
  photoPath: "user/photo.webp",
  photoIsValid: true,
  photoVisibility: "visible",
};

test("visible active verified photo is eligible", () => {
  assert.equal(isPhotoWallEligible(visiblePhoto), true);
});

test("legacy consent value no longer hides an otherwise eligible photo", () => {
  const legacyPhoto = { ...visiblePhoto, photoConsent: false };
  assert.equal(isPhotoWallEligible(legacyPhoto), true);
});

test("hidden photo is excluded", () => {
  assert.equal(isPhotoWallEligible({ ...visiblePhoto, photoVisibility: "hidden" }), false);
});

test("void report photo is excluded", () => {
  assert.equal(isPhotoWallEligible({ ...visiblePhoto, status: "void" }), false);
});

test("photo wall story keeps plain text and line breaks", () => {
  assert.equal(
    normalizePhotoWallStory("  今天聊到一個很深的需要\n一起禱告  "),
    "今天聊到一個很深的需要\n一起禱告",
  );
});

test("empty or null story is omitted", () => {
  assert.equal(normalizePhotoWallStory(null), null);
  assert.equal(normalizePhotoWallStory("   \n "), null);
});

test("HTML-looking story remains literal text data", () => {
  assert.equal(
    normalizePhotoWallStory("<script>alert(1)</script>"),
    "<script>alert(1)</script>",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { detectPhotoMime, photoMimeMatchesPath } from "./photo-signature.ts";

test("detects JPEG, PNG, and WebP magic bytes", () => {
  assert.equal(detectPhotoMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectPhotoMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(
    detectPhotoMime(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])),
    "image/webp",
  );
});

test("rejects SVG, executable, and arbitrary bytes", () => {
  assert.equal(detectPhotoMime(new TextEncoder().encode("<svg><script>")), null);
  assert.equal(detectPhotoMime(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00])), null);
  assert.equal(detectPhotoMime(Uint8Array.from([1, 2, 3, 4])), null);
});

test("requires detected MIME to match the storage extension", () => {
  assert.equal(photoMimeMatchesPath("image/webp", "user/photo.webp"), true);
  assert.equal(photoMimeMatchesPath("image/png", "user/photo.webp"), false);
  assert.equal(photoMimeMatchesPath("image/jpeg", "user/photo.jpg"), true);
});

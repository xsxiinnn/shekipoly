import assert from "node:assert/strict";
import test from "node:test";

import { validatePhotoInput } from "./photo.ts";

test("accepts supported photo MIME types within the source limit", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validatePhotoInput(mimeType, 5 * 1024 * 1024), null);
  }
});

test("rejects SVG, HEIC, executables, and arbitrary MIME types", () => {
  for (const mimeType of [
    "image/svg+xml",
    "image/heic",
    "application/x-msdownload",
    "application/octet-stream",
  ]) {
    assert.match(validatePhotoInput(mimeType, 1000) ?? "", /JPG、PNG 或 WebP/);
  }
});

test("rejects empty and oversized source photos", () => {
  assert.match(validatePhotoInput("image/jpeg", 0) ?? "", /檔案過大/);
  assert.match(
    validatePhotoInput("image/jpeg", 20 * 1024 * 1024 + 1) ?? "",
    /檔案過大/,
  );
});

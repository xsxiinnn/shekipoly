import assert from "node:assert/strict";
import test from "node:test";

import {
  getScaledPhotoDimensions,
  hasHeicContainerSignature,
  hasHeicFileHint,
  normalizePhotoSource,
  validatePhotoInput,
} from "./photo.ts";

function mockFile(contents: Uint8Array, name: string, type = "") {
  const blob = new Blob([new Uint8Array(contents).buffer as ArrayBuffer], { type });
  return Object.assign(blob, { name, lastModified: 0 }) as File;
}

function heicHeader(brand: string) {
  return Uint8Array.from([
    0, 0, 0, 24,
    ...Array.from("ftyp", (character) => character.charCodeAt(0)),
    ...Array.from(brand, (character) => character.charCodeAt(0)),
  ]);
}

test("accepts supported photo MIME types within the source limit", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validatePhotoInput(mimeType, 5 * 1024 * 1024), null);
  }
});

test("accepts HEIC and HEIF MIME variants and filename fallbacks", () => {
  for (const mimeType of [
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ]) {
    assert.equal(validatePhotoInput(mimeType, 5 * 1024 * 1024, "IMG_1234"), null);
  }
  assert.equal(validatePhotoInput("", 5 * 1024 * 1024, "IMG_1234.HEIC"), null);
  assert.equal(validatePhotoInput("", 5 * 1024 * 1024, "IMG_1234.heif"), null);
  assert.equal(hasHeicFileHint("", "IMG_1234.HEIC"), true);
});

test("detects common HEIC and HEIF ISO container brands", () => {
  for (const brand of ["mif1", "msf1", "heic", "heix", "hevc", "hevx"]) {
    assert.equal(hasHeicContainerSignature(heicHeader(brand)), true);
  }
  assert.equal(hasHeicContainerSignature(heicHeader("avif")), false);
});

test("does not load the HEIC converter for JPEG, PNG, or WebP", async () => {
  let converterLoads = 0;
  for (const [type, name] of [
    ["image/jpeg", "photo.jpg"],
    ["image/png", "photo.png"],
    ["image/webp", "photo.webp"],
  ]) {
    const file = mockFile(Uint8Array.from([1, 2, 3]), name, type);
    const normalized = await normalizePhotoSource(file, {
      loadHeicConverter: async () => {
        converterLoads += 1;
        throw new Error("converter should not load");
      },
    });
    assert.equal(normalized.blob, file);
    assert.equal(normalized.wasHeic, false);
  }
  assert.equal(converterLoads, 0);
});

test("converts HEIC and HEIF candidates to JPEG before compression", async () => {
  for (const [type, name, brand] of [
    ["image/heic", "IMG_1234.HEIC", "heic"],
    ["", "IMG_1234.heif", "mif1"],
    ["application/octet-stream", "IMG_1234.bin", "heix"],
  ]) {
    let converterLoads = 0;
    let detected = false;
    const file = mockFile(heicHeader(brand), name, type);
    const normalized = await normalizePhotoSource(file, {
      onHeicDetected: () => { detected = true; },
      loadHeicConverter: async () => {
        converterLoads += 1;
        return {
          isHeic: async () => true,
          heicTo: async () => new Blob([new Uint8Array([255, 216, 255, 217]).buffer], {
            type: "image/jpeg",
          }),
        };
      },
    });
    assert.equal(detected, true);
    assert.equal(converterLoads, 1);
    assert.equal(normalized.wasHeic, true);
    assert.equal(normalized.blob.type, "image/jpeg");
  }
});

test("HEIC conversion failures return a student-friendly message", async () => {
  const file = mockFile(heicHeader("heic"), "IMG_1234.HEIC", "image/heic");
  await assert.rejects(
    normalizePhotoSource(file, {
      loadHeicConverter: async () => ({
        isHeic: async () => true,
        heicTo: async () => { throw new Error("libheif decoder error"); },
      }),
    }),
    /這張照片目前無法處理，請換一張照片或先將照片轉成 JPG 後再試一次。/,
  );
});

test("portrait and landscape dimensions preserve orientation and aspect ratio", () => {
  assert.deepEqual(getScaledPhotoDimensions(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(getScaledPhotoDimensions(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(getScaledPhotoDimensions(800, 600), { width: 800, height: 600 });
});

test("rejects SVG, executables, and arbitrary MIME types", () => {
  for (const mimeType of [
    "image/svg+xml",
    "application/x-msdownload",
    "application/octet-stream",
  ]) {
    assert.match(
      validatePhotoInput(mimeType, 1000, "payload.bin") ?? "",
      /JPG、PNG、WebP、HEIC 或 HEIF/,
    );
  }
});

test("rejects empty and oversized source photos", () => {
  assert.match(validatePhotoInput("image/jpeg", 0) ?? "", /檔案過大/);
  assert.match(
    validatePhotoInput("image/jpeg", 20 * 1024 * 1024 + 1) ?? "",
    /檔案過大/,
  );
});

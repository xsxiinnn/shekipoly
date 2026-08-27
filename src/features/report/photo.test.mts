import assert from "node:assert/strict";
import test from "node:test";

import {
  detectPhotoContainer,
  getScaledPhotoDimensions,
  hasHeicContainerSignature,
  hasHeicFileHint,
  normalizePhotoSource,
  preparePhoto,
  validatePhotoInput,
} from "./photo.ts";

function mockFile(contents: Uint8Array, name: string, type = "") {
  const blob = new Blob([new Uint8Array(contents).buffer as ArrayBuffer], { type });
  return Object.assign(blob, { name, lastModified: 0 }) as File;
}
function ascii(value: string) {
  return Uint8Array.from(Array.from(value, (character) => character.charCodeAt(0)));
}
function ftyp(brand: string, compatibleBrands: string[] = []) {
  return Uint8Array.from([
    0, 0, 0, 24, ...ascii("ftyp"), ...ascii(brand),
    0, 0, 0, 0,
    ...compatibleBrands.flatMap((compatibleBrand) => [...ascii(compatibleBrand)]),
  ]);
}
function jpegBytes() {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe2, 0, 0, 0, 0, 0xff, 0xd9]);
}

test("sniffs common static image containers without trusting MIME or extension", () => {
  assert.equal(detectPhotoContainer(jpegBytes()), "jpeg");
  assert.equal(detectPhotoContainer(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectPhotoContainer(Uint8Array.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")])), "webp");
  assert.equal(detectPhotoContainer(ascii("GIF89a")), "gif");
  assert.equal(detectPhotoContainer(ascii("BM")), "bmp");
  assert.equal(detectPhotoContainer(ftyp("avif")), "avif");
  assert.equal(detectPhotoContainer(ascii("<svg><script>")), "svg");
});

test("accepts empty or unusual MIME for later browser decode", () => {
  assert.equal(validatePhotoInput("", 1000, "IMG_1234.jpeg"), null);
  assert.equal(validatePhotoInput("application/octet-stream", 1000, "photo.bin"), null);
  assert.equal(validatePhotoInput("image/avif", 1000, "photo.avif"), null);
  assert.equal(validatePhotoInput("image/gif", 1000, "photo.gif"), null);
});

test("detects HEIC and HEIF from MIME, extension, and container brand", () => {
  for (const mime of ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]) {
    assert.equal(hasHeicFileHint(mime, "IMG_1234"), true);
  }
  assert.equal(hasHeicFileHint("", "IMG_1234.HEIF"), true);
  assert.equal(hasHeicContainerSignature(ftyp("heic")), true);
  assert.equal(hasHeicContainerSignature(ftyp("avif")), false);
});

test("ordinary JPEG including MPO-style JPEG does not load HEIC converter", async () => {
  let loads = 0;
  for (const file of [
    mockFile(jpegBytes(), "photo.jpeg", "image/jpeg"),
    mockFile(jpegBytes(), "portrait.jpeg", ""),
  ]) {
    const normalized = await normalizePhotoSource(file, {
      loadHeicConverter: async () => { loads += 1; throw new Error("unused"); },
    });
    assert.equal(normalized.blob, file);
    assert.equal(normalized.detection, "jpeg");
  }
  assert.equal(loads, 0);
});

test("AVIF metadata wins over a generic HEIF-family container brand", async () => {
  let loads = 0;
  const file = mockFile(ftyp("mif1"), "photo.avif", "image/avif");
  const normalized = await normalizePhotoSource(file, {
    loadHeicConverter: async () => { loads += 1; throw new Error("unused"); },
  });
  assert.equal(normalized.blob, file);
  assert.equal(loads, 0);
});

test("empty-MIME AVIF compatible brand does not load the HEIC converter", async () => {
  let loads = 0;
  const file = mockFile(ftyp("mif1", ["avif"]), "photo.bin", "");
  const normalized = await normalizePhotoSource(file, {
    loadHeicConverter: async () => { loads += 1; throw new Error("unused"); },
  });
  assert.equal(normalized.detection, "avif");
  assert.equal(normalized.blob, file);
  assert.equal(loads, 0);
});

test("HEIC and HEIF dynamically convert to JPEG before browser normalization", async () => {
  for (const [type, name, brand] of [
    ["image/heic", "IMG.HEIC", "heic"],
    ["", "IMG.heif", "mif1"],
  ]) {
    let loads = 0;
    const normalized = await normalizePhotoSource(mockFile(ftyp(brand), name, type), {
      loadHeicConverter: async () => {
        loads += 1;
        return {
          isHeic: async () => true,
          heicTo: async () => new Blob([jpegBytes()], { type: "image/jpeg" }),
        };
      },
    });
    assert.equal(loads, 1);
    assert.equal(normalized.wasHeic, true);
    assert.equal(normalized.blob.type, "image/jpeg");
  }
});

test("browser-decodable JPEG/MPO, empty MIME, AVIF and GIF normalize to JPEG", async () => {
  for (const [contents, name, type] of [
    [jpegBytes(), "photo.jpeg", "image/jpeg"],
    [jpegBytes(), "photo.jpeg", ""],
    [ftyp("avif"), "photo.avif", "image/avif"],
    [ascii("GIF89a"), "photo.gif", "image/gif"],
  ] as const) {
    let released = false;
    const prepared = await preparePhoto(mockFile(contents, name, type), {
      decodePhoto: async () => ({
        source: {} as CanvasImageSource,
        width: 4032,
        height: 3024,
        decoder: "html-image",
        release: () => { released = true; },
      }),
      renderPhoto: async (_decoded, dimensions) => {
        assert.deepEqual(dimensions, { width: 1600, height: 1200 });
        return new Blob([jpegBytes()], { type: "image/jpeg" });
      },
    });
    assert.equal(prepared.mimeType, "image/jpeg");
    assert.equal(prepared.extension, "jpg");
    assert.equal(prepared.diagnostics.normalizedMime, "image/jpeg");
    assert.equal(prepared.diagnostics.decoder, "html-image");
    assert.equal(released, true);
  }
});

test("HEIC uses converter then the same decode and resize pipeline", async () => {
  const prepared = await preparePhoto(mockFile(ftyp("heic"), "IMG.HEIC", "image/heic"), {
    loadHeicConverter: async () => ({
      isHeic: async () => true,
      heicTo: async () => new Blob([jpegBytes()], { type: "image/jpeg" }),
    }),
    decodePhoto: async () => ({
      source: {} as CanvasImageSource, width: 3024, height: 4032,
      decoder: "createImageBitmap", release: () => undefined,
    }),
    renderPhoto: async (_decoded, dimensions) => {
      assert.deepEqual(dimensions, { width: 1200, height: 1600 });
      return new Blob([jpegBytes()], { type: "image/jpeg" });
    },
  });
  assert.equal(prepared.diagnostics.decoder, "heic-converter+createImageBitmap");
});

test("SVG is rejected even if its name or MIME is misleading", async () => {
  assert.match(validatePhotoInput("image/svg+xml", 1000, "photo.jpg") ?? "", /請選擇照片/);
  await assert.rejects(normalizePhotoSource(mockFile(ascii("<svg>"), "photo.jpg", "image/jpeg")), /請選擇照片/);
  await assert.rejects(
    normalizePhotoSource(
      mockFile(ascii(`${" ".repeat(300)}<svg><script>`), "photo.jpg", "image/jpeg"),
    ),
    /請選擇照片/,
  );
});

test("random renamed files fail with a friendly message when browser decode fails", async () => {
  await assert.rejects(
    preparePhoto(mockFile(ascii("not an image"), "photo.jpg", "image/jpeg"), {
      decodePhoto: async () => { throw new Error("decoder technical detail"); },
    }),
    /這張照片目前無法處理，請換一張照片再試一次。/,
  );
});

test("large image failure and HEIC failure use non-technical messages", async () => {
  assert.match(validatePhotoInput("image/jpeg", 20 * 1024 * 1024 + 1, "large.jpg") ?? "", /照片比較大/);
  await assert.rejects(
    normalizePhotoSource(mockFile(ftyp("heic"), "IMG.HEIC", "image/heic"), {
      loadHeicConverter: async () => ({
        isHeic: async () => true,
        heicTo: async () => { throw new Error("libheif decoder error"); },
      }),
    }),
    /這張照片目前無法處理，請換一張照片再試一次。/,
  );
});

test("portrait and landscape dimensions preserve orientation and never upscale", () => {
  assert.deepEqual(getScaledPhotoDimensions(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(getScaledPhotoDimensions(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(getScaledPhotoDimensions(800, 600), { width: 800, height: 600 });
});

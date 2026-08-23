const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const HEIC_PHOTO_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const STANDARD_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const HEIC_PHOTO_EXTENSIONS = new Set(["heic", "heif"]);
const HEIC_BRANDS = new Set(["mif1", "msf1", "heic", "heix", "hevc", "hevx"]);
const HEIC_PROCESSING_ERROR =
  "這張照片目前無法處理，請換一張照片或先將照片轉成 JPG 後再試一次。";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const TARGET_BYTES = 1.5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type PreparedPhoto = {
  blob: Blob;
  extension: "webp";
  mimeType: "image/webp";
};

type HeicConverter = {
  isHeic(file: File): Promise<boolean>;
  heicTo(options: {
    blob: Blob;
    type: "image/jpeg";
    quality: number;
  }): Promise<Blob>;
};

type PreparePhotoOptions = {
  onHeicDetected?: () => void;
  loadHeicConverter?: () => Promise<HeicConverter>;
};

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function hasHeicFileHint(type: string, name: string) {
  return HEIC_PHOTO_TYPES.has(type.toLowerCase()) || HEIC_PHOTO_EXTENSIONS.has(fileExtension(name));
}

export function hasHeicContainerSignature(bytes: Uint8Array) {
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") {
    return false;
  }
  return HEIC_BRANDS.has(String.fromCharCode(...bytes.slice(8, 12)));
}

function hasStandardPhotoHint(type: string, name: string) {
  return (
    ALLOWED_PHOTO_TYPES.has(type.toLowerCase()) ||
    (!type && STANDARD_PHOTO_EXTENSIONS.has(fileExtension(name)))
  );
}

function validatePhotoSize(size: number) {
  if (size <= 0 || size > MAX_SOURCE_BYTES) {
    return "照片檔案過大，請選擇 20MB 以下的照片。";
  }
  return null;
}

export function validatePhotoInput(type: string, size: number, name = "") {
  const sizeError = validatePhotoSize(size);
  if (sizeError) return sizeError;
  if (!hasStandardPhotoHint(type, name) && !hasHeicFileHint(type, name)) {
    return "目前無法處理這張照片，請改用 JPG、PNG、WebP、HEIC 或 HEIF。";
  }
  return null;
}

async function loadHeicConverter(): Promise<HeicConverter> {
  return import("heic-to/csp");
}

export async function normalizePhotoSource(
  file: File,
  options: PreparePhotoOptions = {},
) {
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isHeicCandidate =
    hasHeicFileHint(file.type, file.name) || hasHeicContainerSignature(signature);

  if (!isHeicCandidate) {
    if (!hasStandardPhotoHint(file.type, file.name)) {
      throw new Error("目前無法處理這張照片，請改用 JPG、PNG、WebP、HEIC 或 HEIF。");
    }
    return { blob: file as Blob, wasHeic: false };
  }

  options.onHeicDetected?.();
  try {
    const converter = await (options.loadHeicConverter ?? loadHeicConverter)();
    if (!(await converter.isHeic(file))) throw new Error("HEIC_INVALID");
    const jpeg = await converter.heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.86,
    });
    if (jpeg.type !== "image/jpeg" || jpeg.size <= 0) throw new Error("HEIC_INVALID");
    return { blob: jpeg, wasHeic: true };
  } catch {
    throw new Error(HEIC_PROCESSING_ERROR);
  }
}

export function getScaledPhotoDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

export async function preparePhoto(
  file: File,
  options: PreparePhotoOptions = {},
): Promise<PreparedPhoto> {
  const sizeError = validatePhotoSize(file.size);
  if (sizeError) throw new Error(sizeError);

  let bitmap: ImageBitmap | null = null;
  let wasHeic = false;
  try {
    const normalized = await normalizePhotoSource(file, options);
    wasHeic = normalized.wasHeic;
    bitmap = await createImageBitmap(normalized.blob, { imageOrientation: "from-image" });
    const { width, height } = getScaledPhotoDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("PHOTO_PROCESSING_FAILED");
    context.drawImage(bitmap, 0, 0, width, height);

    let compressed: Blob | null = null;
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      compressed = await canvasToBlob(canvas, quality);
      if (compressed && compressed.size <= TARGET_BYTES) break;
    }

    if (
      !compressed ||
      compressed.type !== "image/webp" ||
      compressed.size <= 0 ||
      compressed.size > MAX_UPLOAD_BYTES
    ) {
      throw new Error("PHOTO_PROCESSING_FAILED");
    }

    return { blob: compressed, extension: "webp", mimeType: "image/webp" };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("目前") || error.message === HEIC_PROCESSING_ERROR)
    ) throw error;
    if (wasHeic || hasHeicFileHint(file.type, file.name)) {
      throw new Error(HEIC_PROCESSING_ERROR);
    }
    throw new Error("目前無法處理這張照片，請改用 JPG、PNG、WebP、HEIC 或 HEIF。");
  } finally {
    bitmap?.close();
  }
}

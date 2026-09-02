const HEIC_PHOTO_TYPES = new Set([
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
]);
const HEIC_PHOTO_EXTENSIONS = new Set(["heic", "heif"]);
const GENERIC_HEIF_BRANDS = new Set(["mif1", "msf1"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heis", "heim"]);
const AVIF_BRANDS = new Set(["avif", "avis"]);
const SVG_ERROR = "請選擇照片檔案。";
const PHOTO_PROCESSING_ERROR = "這張照片目前無法處理，請換一張照片再試一次。";
const LARGE_PHOTO_ERROR = "這張照片比較大，處理失敗，請換一張照片再試一次。";
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const TARGET_BYTES = 1 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type PhotoDetection =
  | "jpeg" | "png" | "webp" | "gif" | "bmp" | "heic" | "avif" | "svg" | "unknown";
export type PhotoDecoder =
  | "heic-converter+createImageBitmap" | "heic-converter+html-image"
  | "createImageBitmap" | "html-image";

export type PreparedPhoto = {
  blob: Blob;
  extension: "jpg";
  mimeType: "image/jpeg";
  diagnostics: {
    detection: PhotoDetection;
    decoder: PhotoDecoder;
    originalExtension: string;
    originalMime: string;
    originalSize: number;
    normalizedMime: "image/jpeg";
    normalizedSize: number;
  };
};

type HeicConverter = {
  isHeic(file: File): Promise<boolean>;
  heicTo(options: { blob: Blob; type: "image/jpeg"; quality: number }): Promise<Blob>;
};
type DecodedPhoto = {
  source: CanvasImageSource;
  width: number;
  height: number;
  decoder: "createImageBitmap" | "html-image";
  release(): void;
};
type PreparePhotoOptions = {
  onHeicDetected?: () => void;
  loadHeicConverter?: () => Promise<HeicConverter>;
  decodePhoto?: (blob: Blob) => Promise<DecodedPhoto>;
  renderPhoto?: (decoded: DecodedPhoto, dimensions: { width: number; height: number }) => Promise<Blob>;
};

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function hasHeicFileHint(type: string, name: string) {
  return HEIC_PHOTO_TYPES.has(type.toLowerCase()) || HEIC_PHOTO_EXTENSIONS.has(fileExtension(name));
}

export function detectPhotoContainer(bytes: Uint8Array): PhotoDetection {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) return "gif";
  if (bytes.length >= 2 && ascii(bytes, 0, 2) === "BM") return "bmp";
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brands = [ascii(bytes, 8, 12)];
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      brands.push(ascii(bytes, offset, offset + 4));
    }
    if (brands.some((brand) => AVIF_BRANDS.has(brand))) return "avif";
    if (brands.some((brand) => HEIC_BRANDS.has(brand))) return "heic";
    if (brands.some((brand) => GENERIC_HEIF_BRANDS.has(brand))) return "heic";
  }
  const prefix = new TextDecoder().decode(bytes.slice(0, 4096)).trimStart().toLowerCase();
  if (prefix.startsWith("<svg") || (prefix.startsWith("<?xml") && prefix.includes("<svg"))) return "svg";
  return "unknown";
}

export function hasHeicContainerSignature(bytes: Uint8Array) {
  return detectPhotoContainer(bytes) === "heic";
}

function validatePhotoSize(size: number) {
  if (size <= 0) return SVG_ERROR;
  if (size > MAX_SOURCE_BYTES) return LARGE_PHOTO_ERROR;
  return null;
}

/** Basic selection validation only. Actual support is determined by browser decoding. */
export function validatePhotoInput(type: string, size: number, name = "") {
  const sizeError = validatePhotoSize(size);
  if (sizeError) return sizeError;
  if (type.toLowerCase() === "image/svg+xml" || fileExtension(name) === "svg") return SVG_ERROR;
  return null;
}

async function loadHeicConverter(): Promise<HeicConverter> {
  return import("heic-to/csp");
}

export async function normalizePhotoSource(file: File, options: PreparePhotoOptions = {}) {
  const signature = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const detection = detectPhotoContainer(signature);
  if (detection === "svg" || file.type.toLowerCase() === "image/svg+xml" || fileExtension(file.name) === "svg") {
    throw new Error(SVG_ERROR);
  }
  const hasAvifHint = file.type.toLowerCase() === "image/avif" || fileExtension(file.name) === "avif";
  const effectiveDetection = detection === "heic" && hasAvifHint ? "avif" : detection;
  const isHeicCandidate =
    effectiveDetection === "heic" ||
    (effectiveDetection === "unknown" && hasHeicFileHint(file.type, file.name));
  if (!isHeicCandidate) {
    return { blob: file as Blob, wasHeic: false, detection: effectiveDetection };
  }

  options.onHeicDetected?.();
  try {
    const converter = await (options.loadHeicConverter ?? loadHeicConverter)();
    if (!(await converter.isHeic(file))) throw new Error("HEIC_INVALID");
    const jpeg = await converter.heicTo({ blob: file, type: "image/jpeg", quality: 0.86 });
    if (jpeg.type !== "image/jpeg" || jpeg.size <= 0) throw new Error("HEIC_INVALID");
    return { blob: jpeg, wasHeic: true, detection: "heic" as const };
  } catch {
    throw new Error(PHOTO_PROCESSING_ERROR);
  }
}

export function getScaledPhotoDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decodeWithHtmlImage(blob: Blob): Promise<DecodedPhoto> {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
  });
  image.src = objectUrl;
  try {
    if (typeof image.decode === "function") await image.decode().catch(() => loaded);
    else await loaded;
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("IMAGE_DECODE_FAILED");
    return {
      source: image, width: image.naturalWidth, height: image.naturalHeight,
      decoder: "html-image",
      release: () => { image.src = ""; URL.revokeObjectURL(objectUrl); },
    };
  } catch (error) {
    image.src = "";
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function decodeBrowserPhoto(blob: Blob): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      if (!bitmap.width || !bitmap.height) throw new Error("IMAGE_DECODE_FAILED");
      return {
        source: bitmap, width: bitmap.width, height: bitmap.height,
        decoder: "createImageBitmap", release: () => bitmap.close(),
      };
    } catch {
      // Safari and special JPEG/MPO containers may need the HTML image decoder.
    }
  }
  return decodeWithHtmlImage(blob);
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function renderNormalizedJpeg(decoded: DecodedPhoto, dimensions: { width: number; height: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  try {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("PHOTO_PROCESSING_FAILED");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);
    let result: Blob | null = null;
    for (const quality of [0.84, 0.76, 0.68, 0.6]) {
      result = await canvasToJpeg(canvas, quality);
      if (result && result.size <= TARGET_BYTES) break;
    }
    if (!result || result.type !== "image/jpeg" || result.size <= 0 || result.size > MAX_UPLOAD_BYTES) {
      throw new Error("PHOTO_PROCESSING_FAILED");
    }
    return result;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function preparePhoto(file: File, options: PreparePhotoOptions = {}): Promise<PreparedPhoto> {
  const validationError = validatePhotoInput(file.type, file.size, file.name);
  if (validationError) throw new Error(validationError);
  let decoded: DecodedPhoto | null = null;
  try {
    const normalized = await normalizePhotoSource(file, options);
    decoded = await (options.decodePhoto ?? decodeBrowserPhoto)(normalized.blob);
    const dimensions = getScaledPhotoDimensions(decoded.width, decoded.height);
    const result = await (options.renderPhoto ?? renderNormalizedJpeg)(decoded, dimensions);
    if (result.type !== "image/jpeg" || result.size <= 0 || result.size > MAX_UPLOAD_BYTES) throw new Error("PHOTO_PROCESSING_FAILED");

    const decoder = `${normalized.wasHeic ? "heic-converter+" : ""}${decoded.decoder}` as PhotoDecoder;
    const prepared: PreparedPhoto = {
      blob: result, extension: "jpg", mimeType: "image/jpeg",
      diagnostics: {
        detection: normalized.detection, decoder,
        originalExtension: fileExtension(file.name), originalMime: file.type || "(empty)",
        originalSize: file.size, normalizedMime: "image/jpeg", normalizedSize: result.size,
      },
    };
    if (process.env.NODE_ENV !== "production") console.debug("Photo normalization", prepared.diagnostics);
    return prepared;
  } catch (error) {
    if (error instanceof Error && [SVG_ERROR, LARGE_PHOTO_ERROR, PHOTO_PROCESSING_ERROR].includes(error.message)) throw error;
    throw new Error(PHOTO_PROCESSING_ERROR);
  } finally {
    decoded?.release();
  }
}

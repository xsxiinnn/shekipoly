const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const TARGET_BYTES = 1.5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type PreparedPhoto = {
  blob: Blob;
  extension: "webp";
  mimeType: "image/webp";
};

export function validatePhotoInput(type: string, size: number) {
  if (!ALLOWED_PHOTO_TYPES.has(type)) {
    return "目前無法處理這張照片，請改用 JPG、PNG 或 WebP。";
  }
  if (size <= 0 || size > MAX_SOURCE_BYTES) {
    return "照片檔案過大，請選擇 20MB 以下的照片。";
  }
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const inputError = validatePhotoInput(file.type, file.size);
  if (inputError) throw new Error(inputError);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
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
    if (error instanceof Error && error.message.startsWith("目前")) throw error;
    throw new Error("目前無法處理這張照片，請改用 JPG、PNG 或 WebP。");
  } finally {
    bitmap?.close();
  }
}

export type SupportedPhotoMime = "image/jpeg" | "image/png" | "image/webp";

export function detectPhotoMime(bytes: Uint8Array): SupportedPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((value, index) => bytes[index] === value)) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function photoMimeMatchesPath(mimeType: SupportedPhotoMime, path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (mimeType === "image/jpeg") return extension === "jpg" || extension === "jpeg";
  if (mimeType === "image/png") return extension === "png";
  return extension === "webp";
}

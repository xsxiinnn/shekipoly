export function addPhotoFieldsToReportPayload(
  payload: FormData,
  photoPath: string | null,
) {
  payload.set("photo_path", photoPath ?? "");
  return payload;
}

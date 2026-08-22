export function addPhotoFieldsToReportPayload(
  payload: FormData,
  photoPath: string | null,
  photoConsent: boolean,
) {
  payload.set("photo_path", photoPath ?? "");
  payload.set("photo_consent", String(Boolean(photoPath && photoConsent)));
  return payload;
}

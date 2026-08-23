export type PhotoWallEligibility = {
  status: string;
  photoPath: string | null;
  photoIsValid: boolean;
  photoVisibility: string;
  photoConsent: boolean;
};

export function isPhotoWallEligible(photo: PhotoWallEligibility) {
  return (
    photo.status === "active" &&
    photo.photoPath !== null &&
    photo.photoIsValid &&
    photo.photoVisibility === "visible" &&
    photo.photoConsent
  );
}

export function normalizePhotoWallStory(story: unknown) {
  if (typeof story !== "string") return null;
  const normalized = story.trim();
  return normalized || null;
}

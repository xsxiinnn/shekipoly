export type PhotoWallEligibility = {
  status: string;
  photoPath: string | null;
  photoIsValid: boolean;
  photoVisibility: string;
};

export function isPhotoWallEligible(photo: PhotoWallEligibility) {
  return (
    photo.status === "active" &&
    photo.photoPath !== null &&
    photo.photoIsValid &&
    photo.photoVisibility === "visible"
  );
}

export function normalizePhotoWallStory(story: unknown) {
  if (typeof story !== "string") return null;
  const normalized = story.trim();
  return normalized || null;
}

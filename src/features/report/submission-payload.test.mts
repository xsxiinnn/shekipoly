import assert from "node:assert/strict";
import test from "node:test";

import { addPhotoFieldsToReportPayload } from "./submission-payload.ts";

function createCompleteReportPayload(is3x5: "true" | "false") {
  const payload = new FormData();
  payload.set("friend_alias", "小明");
  payload.set("is_3x5", is3x5);
  payload.set("mission_id", is3x5 === "true" ? "5" : "1");
  payload.set("story", "一次很棒的關懷");
  return payload;
}

function assertOriginalFieldsRemain(payload: FormData, is3x5: "true" | "false") {
  assert.equal(payload.get("friend_alias"), "小明");
  assert.equal(payload.get("is_3x5"), is3x5);
  assert.equal(payload.get("mission_id"), is3x5 === "true" ? "5" : "1");
  assert.equal(payload.get("story"), "一次很棒的關懷");
}

test("no-photo submission preserves every report field and explicitly sends no photo", () => {
  const payload = createCompleteReportPayload("false");

  const result = addPhotoFieldsToReportPayload(payload, null, false);

  assert.equal(result, payload);
  assertOriginalFieldsRemain(result, "false");
  assert.equal(result.get("photo_path"), "");
  assert.equal(result.get("photo_consent"), "false");
});

test("photo submission only adds photo fields to the same complete payload", () => {
  const payload = createCompleteReportPayload("true");
  const photoPath =
    "user-id/00000000-0000-4000-8000-000000000001.webp";

  const result = addPhotoFieldsToReportPayload(payload, photoPath, true);

  assert.equal(result, payload);
  assertOriginalFieldsRemain(result, "true");
  assert.equal(result.get("photo_path"), photoPath);
  assert.equal(result.get("photo_consent"), "true");
});

test("missing photo consent never clears the completed report fields", () => {
  const payload = createCompleteReportPayload("true");

  const result = addPhotoFieldsToReportPayload(
    payload,
    "user-id/00000000-0000-4000-8000-000000000002.webp",
    false,
  );

  assertOriginalFieldsRemain(result, "true");
  assert.equal(result.get("photo_consent"), "false");
});

test("report payload never adds trusted scoring or ownership fields", () => {
  const payload = addPhotoFieldsToReportPayload(
    createCompleteReportPayload("false"),
    null,
    false,
  );

  for (const field of [
    "raw_score",
    "accepted_score",
    "mission_score",
    "photo_bonus",
    "team_id",
    "activity_week",
  ]) {
    assert.equal(payload.has(field), false);
  }
});

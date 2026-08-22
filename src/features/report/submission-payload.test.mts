import assert from "node:assert/strict";
import test from "node:test";

import { addPhotoFieldsToReportPayload } from "./submission-payload.ts";

function createPayload(is3x5: "true" | "false") {
  const payload = new FormData();
  payload.set("friend_alias", "小明");
  payload.set("is_3x5", is3x5);
  payload.set("mission_id", is3x5 === "true" ? "5" : "1");
  payload.set("story", "一次很棒的關懷");
  return payload;
}

test("photo path augments the same complete payload without consent", () => {
  const payload = createPayload("true");
  const path = "user-id/00000000-0000-4000-8000-000000000001.webp";
  const result = addPhotoFieldsToReportPayload(payload, path);
  assert.equal(result, payload);
  assert.equal(result.get("friend_alias"), "小明");
  assert.equal(result.get("is_3x5"), "true");
  assert.equal(result.get("mission_id"), "5");
  assert.equal(result.get("story"), "一次很棒的關懷");
  assert.equal(result.get("photo_path"), path);
  assert.equal(result.has("photo_consent"), false);
});

test("no-photo payload keeps explicit false and contains no trusted score fields", () => {
  const payload = addPhotoFieldsToReportPayload(createPayload("false"), null);
  assert.equal(payload.get("is_3x5"), "false");
  assert.equal(payload.get("photo_path"), "");
  for (const field of ["raw_score", "accepted_score", "photo_bonus", "team_id", "activity_week"]) {
    assert.equal(payload.has(field), false);
  }
});

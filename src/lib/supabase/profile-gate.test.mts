import assert from "node:assert/strict";
import test from "node:test";

import { getProfileGateDestination } from "./profile-gate.ts";

test("incomplete profile is redirected to onboarding", () => {
  assert.equal(
    getProfileGateDestination({
      hasUser: true,
      hasProfile: false,
      pathname: "/report",
      isEditingProfile: false,
      method: "GET",
    }),
    "/onboarding",
  );
});

test("completed profile skips onboarding", () => {
  assert.equal(
    getProfileGateDestination({
      hasUser: true,
      hasProfile: true,
      pathname: "/onboarding",
      isEditingProfile: false,
      method: "GET",
    }),
    "/report",
  );
});

test("completed profile can explicitly edit onboarding data", () => {
  assert.equal(
    getProfileGateDestination({
      hasUser: true,
      hasProfile: true,
      pathname: "/onboarding",
      isEditingProfile: true,
      method: "GET",
    }),
    "allow",
  );
});

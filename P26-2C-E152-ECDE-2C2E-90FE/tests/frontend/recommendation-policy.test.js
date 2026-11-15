import assert from "node:assert/strict";
import test from "node:test";
import {
  canRemoveRecommendation,
  canSubmitRecommendation,
  canViewRecommendations,
} from "../../public/assets/js/recommendation-policy.js";

const activeRoom = {
  status: "active",
  isParticipant: false,
  owner: { id: "room-owner" },
};
const recommendation = { author: { id: "author" } };

test("active recommendations remain visible to users who are not participants", () => {
  assert.equal(canViewRecommendations(activeRoom), true);
  assert.equal(canSubmitRecommendation(activeRoom), false);
});

test("author and creator can remove while active even after leaving", () => {
  assert.equal(canRemoveRecommendation({ id: "author" }, activeRoom, recommendation), true);
  assert.equal(canRemoveRecommendation({ id: "room-owner" }, activeRoom, recommendation), true);
});

test("other users and everyone in an ended room cannot remove", () => {
  assert.equal(canRemoveRecommendation({ id: "other" }, activeRoom, recommendation), false);
  assert.equal(canRemoveRecommendation(null, activeRoom, recommendation), false);
  assert.equal(
    canRemoveRecommendation(
      { id: "author" },
      { ...activeRoom, status: "ended" },
      recommendation,
    ),
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createPageState,
  invalidatePageState,
  isCurrentPageRequest,
  isCurrentPageState,
  MAX_PAGE_OFFSET,
  resetPageState,
  uniquePageItems,
  updatePageState,
} from "../../public/assets/js/pagination.js";

test("page state deduplicates results, follows offsets, and stops at the end", () => {
  const page = createPageState();
  resetPageState(page, 1);

  const first = uniquePageItems(page.ids, [{ id: "a" }, { id: "b" }], (item) => item.id);
  assert.deepEqual(first.map((item) => item.id), ["a", "b"]);
  assert.equal(updatePageState(page, { hasMore: true, nextOffset: 2 }, 0, 2), true);
  assert.equal(page.offset, 2);

  const second = uniquePageItems(
    page.ids,
    [{ id: "b" }, { id: "c" }],
    (item) => item.id,
  );
  assert.deepEqual(second.map((item) => item.id), ["c"]);
  assert.equal(updatePageState(page, { hasMore: false, nextOffset: null }, 2, 2), false);
  assert.equal(page.offset, 4);
  assert.deepEqual([...page.ids], ["a", "b", "c"]);
});

test("page state never exposes a next request past the API offset limit", () => {
  const page = createPageState();
  resetPageState(page, 1);

  assert.equal(
    updatePageState(
      page,
      { hasMore: true, nextOffset: MAX_PAGE_OFFSET + 20 },
      MAX_PAGE_OFFSET,
      20,
    ),
    false,
  );
  assert.equal(page.offset, MAX_PAGE_OFFSET + 20);
  assert.equal(page.limitReached, true);
});

test("resetting pagination for another room invalidates stale responses", () => {
  const page = createPageState();
  resetPageState(page, 1);
  page.ids.add("room-a-item");
  page.offset = 20;
  page.hasMore = true;
  page.loading = true;

  resetPageState(page, 2);

  assert.equal(isCurrentPageState(page, 1), false);
  assert.equal(isCurrentPageState(page, 2), true);
  assert.equal(page.offset, 0);
  assert.equal(page.hasMore, false);
  assert.equal(page.limitReached, false);
  assert.equal(page.loading, false);
  assert.equal(page.ids.size, 0);
});

test("invalidating a page prevents in-flight responses from restoring stale data", () => {
  const page = createPageState();
  resetPageState(page, 7);
  page.offset = 20;
  page.hasMore = true;
  page.rankingVersion = "old-ranking";
  page.ids.add("loaded-item");
  const requestId = page.requestId;

  invalidatePageState(page);

  assert.equal(isCurrentPageRequest(page, 7, requestId), false);
  assert.equal(isCurrentPageRequest(page, 7, page.requestId), true);
  assert.equal(page.offset, 0);
  assert.equal(page.hasMore, false);
  assert.equal(page.loading, false);
  assert.equal(page.rankingVersion, null);
  assert.equal(page.ids.size, 0);
});

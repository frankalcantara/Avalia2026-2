export const MAX_PAGE_OFFSET = 10_000;

export function createPageState() {
  return {
    offset: 0,
    hasMore: false,
    limitReached: false,
    loading: false,
    viewToken: 0,
    requestId: 0,
    rankingVersion: null,
    ids: new Set(),
  };
}

export function resetPageState(page, viewToken) {
  page.offset = 0;
  page.hasMore = false;
  page.limitReached = false;
  page.loading = false;
  page.viewToken = viewToken;
  page.rankingVersion = null;
  page.ids = new Set();
}

export function isCurrentPageState(page, viewToken) {
  return page.viewToken === viewToken;
}

export function invalidatePageState(page) {
  page.requestId += 1;
  resetPageState(page, page.viewToken);
}

export function isCurrentPageRequest(page, viewToken, requestId) {
  return isCurrentPageState(page, viewToken) && page.requestId === requestId;
}

export function uniquePageItems(ids, items, getId) {
  const unique = [];
  for (const item of items) {
    const id = getId(item);
    if (id === null || id === undefined || ids.has(id)) continue;
    ids.add(id);
    unique.push(item);
  }
  return unique;
}

export function updatePageState(page, pagination, requestedOffset, receivedCount) {
  const nextOffset = pagination.nextOffset;
  page.offset = Number.isInteger(nextOffset) && nextOffset >= 0
    ? nextOffset
    : requestedOffset + receivedCount;
  page.hasMore = pagination.hasMore === true
    && Number.isInteger(nextOffset)
    && nextOffset <= MAX_PAGE_OFFSET;
  page.limitReached = pagination.hasMore === true
    && Number.isInteger(nextOffset)
    && nextOffset > MAX_PAGE_OFFSET;
  return page.hasMore;
}

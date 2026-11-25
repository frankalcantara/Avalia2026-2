# Shared API contract

**Status:** Implemented in the project source. This document describes the local API contract; it is not evidence that credentials, remote D1 bindings, or a production deployment are configured.

## Identity and common behavior

- Authentication begins at `GET /api/auth/discord` and returns through `GET /api/auth/discord/callback`.
- `GET /api/auth/session` returns the authenticated user or an unauthenticated state.
- `POST /api/auth/logout` ends the current session.
- Server-side identity must come from a validated session. Clients must not send an authoritative `userId`, username, question owner, or answer author.
- JSON errors use `{ "error": { "code": "string", "message": "string" } }`.
- Expected statuses: `200` for successful reads/updates, `201` for creation, `400` for invalid input, `401` for no valid session, `403` for insufficient permission, `404` for a missing resource, `409` for a state conflict, `405` for an unsupported method, and `500` for an unexpected server failure.

## Session

The session cookie is HMAC-signed and expires after 24 hours. OAuth initiation uses a one-time `state` cookie that the callback validates. Local HTTP development omits the `Secure` cookie attribute; HTTPS deployments include it.

### `GET /api/auth/session`

Returns `200` with:

```json
{
  "authenticated": true,
  "user": {
    "userId": "discord-user-id",
    "username": "display-name",
    "avatar": "https://example.invalid/avatar.png"
  }
}
```

For an unauthenticated request, returns `200` with `{ "authenticated": false, "user": null }`.

### `POST /api/auth/logout`

Ends the current session and returns `200`. The response must clear the session cookie.

## Questions

### `GET /api/questions`

Lists questions. An optional `status` query parameter may be `open` or `resolved`. Returns `200` with `{ "items": [...] }`; each list item includes `id`, `title`, `content`, `author`, `status`, `acceptedAnswerId`, `answerCount`, and `createdAt`.

### `GET /api/questions/:questionId`

Returns `200` with the question fields above and an `answers` array. Returns `404` if the question does not exist.

### `POST /api/questions`

Requires a valid session. Accepts `{ "title": "string", "content": "string" }`; the server derives the author from the session. Returns `201` with the created question. Empty or invalid fields return `400`.

## Answers

### `POST /api/questions/:questionId/answers`

Requires a valid session. Accepts `{ "content": "string" }`; the server derives the author from the session. Returns `201` with the created answer. Returns `404` for a missing question and `409` if the question cannot accept answers in its current state.

## Accepted solution

### `PUT /api/questions/:questionId/accepted-answer`

Requires a valid session. Accepts `{ "answerId": "id" }`. The server must verify that the requester owns the question and that the answer belongs to that question. On success, returns `200` with the updated question state. Returns `401` for no valid session, `403` for a requester who does not own the question, `404` for a missing question or answer, and `409` for an incompatible state.

Only the question owner may accept a solution. The accepted answer must belong to that question, and the question state and accepted answer must remain consistent.

## Status

### `GET /api/status`

Returns project metadata, whether the D1 binding is configured, D1 connectivity, OAuth configuration status, and the validated session user. The endpoint does not create tables or write diagnostic records.

## Scope boundary

Editing and deleting questions or answers are not part of this initial contract. Add them only after the user authorizes the scope and the agents update this contract together.

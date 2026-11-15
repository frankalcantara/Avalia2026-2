import { createRouteHandler, getRoomHistory } from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  GET: getRoomHistory,
});

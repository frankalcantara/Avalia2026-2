import { createRouteHandler, getRoom } from "../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  GET: getRoom,
});

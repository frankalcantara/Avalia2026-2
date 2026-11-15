import { createRouteHandler, joinRoom } from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  POST: joinRoom,
});

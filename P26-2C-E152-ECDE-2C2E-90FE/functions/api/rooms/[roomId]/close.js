import { createRouteHandler, closeRoom } from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  POST: closeRoom,
});

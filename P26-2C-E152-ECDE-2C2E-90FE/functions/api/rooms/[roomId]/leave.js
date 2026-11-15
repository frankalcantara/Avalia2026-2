import { createRouteHandler, leaveRoom } from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  POST: leaveRoom,
});

import { createRouteHandler, createRoom, listRooms } from "../_shared/rooms.js";

export const onRequest = createRouteHandler({
  GET: listRooms,
  POST: createRoom,
});

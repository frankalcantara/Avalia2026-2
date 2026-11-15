import { createRouteHandler, updatePresence } from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  POST: updatePresence,
});

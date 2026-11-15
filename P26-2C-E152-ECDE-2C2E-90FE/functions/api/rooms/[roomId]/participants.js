import { createRouteHandler, listParticipants } from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  GET: listParticipants,
});

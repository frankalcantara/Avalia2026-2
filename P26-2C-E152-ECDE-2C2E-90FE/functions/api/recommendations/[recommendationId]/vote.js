import {
  createRouteHandler,
  removeVote,
  setVote,
} from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  POST: setVote,
  DELETE: removeVote,
});

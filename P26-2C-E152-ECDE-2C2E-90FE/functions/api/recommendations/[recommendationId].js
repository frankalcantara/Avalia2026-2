import { createRouteHandler, deleteRecommendation } from "../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  DELETE: deleteRecommendation,
});

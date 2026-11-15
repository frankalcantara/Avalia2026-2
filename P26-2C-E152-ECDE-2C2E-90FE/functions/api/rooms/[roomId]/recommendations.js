import {
  createRecommendation,
  createRouteHandler,
  listRecommendations,
} from "../../../_shared/rooms.js";

export const onRequest = createRouteHandler({
  GET: listRecommendations,
  POST: createRecommendation,
});

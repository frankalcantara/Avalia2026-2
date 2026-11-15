import { createRouteHandler } from "../../_shared/rooms.js";
import { searchMusic } from "../../_shared/music/search.js";

export const onRequest = createRouteHandler({
  GET: searchMusic,
});

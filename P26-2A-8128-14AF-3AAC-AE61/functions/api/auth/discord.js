import { handleApi } from '../../../lib/router.js';

export function onRequest({ request, env }) {
  return handleApi(request, env);
}

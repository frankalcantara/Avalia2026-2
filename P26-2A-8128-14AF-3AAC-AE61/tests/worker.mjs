// Test-only entry point: production deploys functions/, never this file.
import { handleApi } from '../lib/router.js';

export default {
  fetch(request, env) {
    return handleApi(request, env);
  },
};

import {
  clearCookie,
  getSessionCookieName,
  jsonResponse,
  methodNotAllowed
} from '../_utils.js';

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed('POST');
  }
  var response = jsonResponse({ message: 'Sessão encerrada.' }, 200);
  response.headers.append('Set-Cookie', clearCookie(getSessionCookieName()));
  return response;
}

import { handleAuthError, handleLogout } from "../../_shared/auth.js";

export async function onRequest(context) {
  try {
    return await handleLogout(context);
  } catch (error) {
    return handleAuthError(error);
  }
}

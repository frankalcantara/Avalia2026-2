import { handleAuthError, handleCurrentUser } from "../../_shared/auth.js";

export async function onRequest(context) {
  try {
    return await handleCurrentUser(context);
  } catch (error) {
    return handleAuthError(error);
  }
}

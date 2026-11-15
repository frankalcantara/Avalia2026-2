import { handleAuthError, handleDiscordLogin } from "../../_shared/auth.js";

export async function onRequest(context) {
  try {
    return await handleDiscordLogin(context);
  } catch (error) {
    return handleAuthError(error);
  }
}

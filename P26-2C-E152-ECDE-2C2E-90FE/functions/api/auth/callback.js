import {
  handleAuthError,
  handleDiscordCallback,
} from "../../_shared/auth.js";

export async function onRequest(context) {
  try {
    return await handleDiscordCallback(context);
  } catch (error) {
    return handleAuthError(error);
  }
}

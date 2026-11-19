import { handleTts } from "../_lib/tts.js";

/** POST /api/tts {text, lang:"pt"|"en", rate?} -> audio/mpeg (Google Cloud TTS, com cache e cota). */
export const onRequest = (ctx) => handleTts(ctx);

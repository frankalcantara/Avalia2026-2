import { error } from "../_lib.js";

// Qualquer /api/* sem rota própria responde JSON 404 em vez do index.html.
export const onRequest = () => error(404, "Rota não encontrada.");

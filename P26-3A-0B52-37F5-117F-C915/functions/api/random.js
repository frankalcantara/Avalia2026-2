import { json } from '../../lib/auth.js';
import { withSchema } from '../../lib/schema.js';
import { selectQuotes, unavailable } from '../../lib/quotes.js';

export async function onRequestGet({ env }) {
  try {
    const quote = await withSchema(env.DB, () => env.DB.prepare(
      selectQuotes + " WHERE q.visibility = 'public' ORDER BY RANDOM() LIMIT 1"
    ).first());
    return json({ quote });
  } catch {
    return unavailable();
  }
}

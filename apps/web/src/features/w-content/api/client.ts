import { api, qk } from '@/lib/api';
import { searchSuggestSchema } from './schemas';

/** GET /search/suggest?q&limit — ASSUMED autocomplete endpoint for the search field. */
export const fetchSearchSuggestions = (q: string, signal?: AbortSignal) =>
  api.get('/search/suggest', { query: { q, limit: 8 }, schema: searchSuggestSchema, signal });

export const contentKeys = {
  suggest: (q: string) => qk('search', 'suggest', { q }),
};

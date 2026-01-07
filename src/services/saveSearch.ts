import pluginJson from '../plugin.json';
import { narrowSavedSearches } from './narrowing';

export async function saveSearch(query: string, title: string, description: string) {
  saveInLocalStorage(query, title, description);
}

export const SAVED_SEARCHES_KEY = `${pluginJson.id}.savedSearches`;

export interface SavedSearch {
  description: string;
  query: string;
  timestamp: number;
  title: string;
}

function saveInLocalStorage(query: string, title: string, description: string) {
  let stored: SavedSearch[] = [];
  try {
    stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? '[]'));
  } catch (e) {}
  stored.push({
    description,
    query,
    timestamp: new Date().getTime(),
    title,
  });
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(stored));
}

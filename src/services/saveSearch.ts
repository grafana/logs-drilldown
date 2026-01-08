import pluginJson from '../plugin.json';
import { logger } from './logger';
import { narrowSavedSearches } from './narrowing';

export async function saveSearch(query: string, title: string, description: string, dsUid: string) {
  await saveInLocalStorage(query, title, description, dsUid);
}

export async function hasSavedSearches() {
  return (await getSavedSearches()).length > 0;
}

export async function getSavedSearches() {
  let stored: SavedSearch[] = [];
  try {
    stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? '[]'));
  } catch (e) {
    logger.error(e);
  }
  return stored;
}

export const SAVED_SEARCHES_KEY = `${pluginJson.id}.savedSearches`;

export interface SavedSearch {
  description: string;
  dsUid: string;
  query: string;
  timestamp: number;
  title: string;
}

async function saveInLocalStorage(query: string, title: string, description: string, dsUid: string) {
  const stored = await getSavedSearches();

  stored.push({
    dsUid,
    description,
    query,
    timestamp: new Date().getTime(),
    title,
  });

  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(stored));
}

import pluginJson from '../plugin.json';
import { logger } from './logger';
import { narrowSavedSearches } from './narrowing';

export async function saveSearch(query: string, title: string, description: string, dsUid: string) {
  await saveInLocalStorage(query, title, description, dsUid);
}

export async function hasSavedSearches(dsUid: string) {
  return (await getSavedSearches(dsUid)).length > 0;
}

export async function getSavedSearches(dsUid: string) {
  let stored: SavedSearch[] = [];
  try {
    stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? '[]'));
  } catch (e) {
    logger.error(e);
  }
  stored.sort((a, b) => b.timestamp - a.timestamp);
  return stored.filter((search) => search.dsUid === dsUid);
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
  const stored = await getSavedSearches(dsUid);

  stored.push({
    dsUid,
    description,
    query,
    timestamp: new Date().getTime(),
    title,
  });

  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(stored));
}

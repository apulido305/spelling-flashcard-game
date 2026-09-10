import { loadJSON, saveJSON } from './storage';

export interface SavedList {
  id: string;
  name: string;
  words: string[];
}

const KEY = 'savedLists';

export function getSavedLists(): SavedList[] {
  return loadJSON<SavedList[]>(KEY, []);
}

export function saveList(name: string, words: string[]): SavedList[] {
  const list: SavedList = { id: crypto.randomUUID(), name, words };
  const updated = [...getSavedLists(), list];
  saveJSON(KEY, updated);
  return updated;
}

export function deleteList(id: string): SavedList[] {
  const updated = getSavedLists().filter((list) => list.id !== id);
  saveJSON(KEY, updated);
  return updated;
}

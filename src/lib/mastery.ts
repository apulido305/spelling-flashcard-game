import { loadJSON, saveJSON } from './storage';

export interface MasteryRecord {
  streak: number;
  lastPracticedDate: string | null; // YYYY-MM-DD
  masteredAt: string | null; // YYYY-MM-DD
}

type MasteryMap = Record<string, MasteryRecord>;

const KEY = 'mastery';
const MASTERY_STREAK_TARGET = 3;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMasteryMap(): MasteryMap {
  return loadJSON<MasteryMap>(KEY, {});
}

function getRecord(map: MasteryMap, word: string): MasteryRecord {
  return map[word] ?? { streak: 0, lastPracticedDate: null, masteredAt: null };
}

export function getMasteredSet(words: string[]): Set<string> {
  const map = getMasteryMap();
  return new Set(words.filter((word) => !!getRecord(map, word).masteredAt));
}

// Records the outcome of a completed session for each word and returns the
// words that became newly mastered as a result (for the Summary screen).
//
// A word's streak only advances once per calendar day — repeating the same
// list five times in one sitting (e.g. mashing "Play Again") must not
// fast-track mastery, since the whole point of spaced repetition is
// separation across days, not repetition within a single session.
export function recordSessionResults(words: string[], neededHelp: string[]): string[] {
  const map = getMasteryMap();
  const today = todayString();
  const neededHelpSet = new Set(neededHelp);
  const newlyMastered: string[] = [];

  for (const word of words) {
    const record = getRecord(map, word);
    if (record.lastPracticedDate === today) continue;

    const wasAlreadyMastered = !!record.masteredAt;
    const clean = !neededHelpSet.has(word);
    const streak = clean ? record.streak + 1 : 0;

    const updated: MasteryRecord = {
      streak,
      lastPracticedDate: today,
      masteredAt: record.masteredAt,
    };

    if (clean && streak >= MASTERY_STREAK_TARGET && !wasAlreadyMastered) {
      updated.masteredAt = today;
      newlyMastered.push(word);
    }

    map[word] = updated;
  }

  saveJSON(KEY, map);
  return newlyMastered;
}

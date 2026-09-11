import { loadJSON, saveJSON } from './storage';

interface StreakState {
  lastPracticedDate: string | null; // YYYY-MM-DD
  streak: number;
}

const KEY = 'streak';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Call once per completed session (any mode). A day only counts once no
// matter how many sessions happen within it.
export function recordDayPracticed(): void {
  const state = loadJSON<StreakState>(KEY, { lastPracticedDate: null, streak: 0 });
  const today = todayString();
  if (state.lastPracticedDate === today) return;

  const continuesStreak = state.lastPracticedDate === yesterdayString();
  saveJSON(KEY, {
    lastPracticedDate: today,
    streak: continuesStreak ? state.streak + 1 : 1,
  });
}

// The streak is only "live" if the last practiced day was today or
// yesterday - skip a full day and it's broken, even though the stored
// number doesn't change until the next session records that.
export function getCurrentStreak(): number {
  const state = loadJSON<StreakState>(KEY, { lastPracticedDate: null, streak: 0 });
  if (state.lastPracticedDate === todayString() || state.lastPracticedDate === yesterdayString()) {
    return state.streak;
  }
  return 0;
}

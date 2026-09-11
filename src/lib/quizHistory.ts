import { loadJSON, saveJSON } from './storage';

export interface QuizResult {
  date: string; // YYYY-MM-DD
  score: number;
  total: number;
}

const KEY = 'quizHistory';
const MAX_HISTORY = 5;

export function recordQuizResult(score: number, total: number): void {
  const history = loadJSON<QuizResult[]>(KEY, []);
  const today = new Date().toISOString().slice(0, 10);
  const updated = [{ date: today, score, total }, ...history].slice(0, MAX_HISTORY);
  saveJSON(KEY, updated);
}

export function getRecentQuizResults(): QuizResult[] {
  return loadJSON<QuizResult[]>(KEY, []);
}

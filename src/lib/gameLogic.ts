const MIN_REQUEUE_OFFSET = 3;
const MAX_REQUEUE_OFFSET = 5;

export function initQueue(words: string[]): string[] {
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Front-loads not-yet-mastered words and pushes already-mastered ones later
// in the queue, without dropping them entirely — everyone still gets
// practiced, but the words that actually need attention come first.
export function initQueueWithMastery(words: string[], masteredWords: Set<string>): string[] {
  const notMastered = words.filter((word) => !masteredWords.has(word));
  const mastered = words.filter((word) => masteredWords.has(word));
  return [...initQueue(notMastered), ...initQueue(mastered)];
}

export function requeue(remainingQueue: string[], word: string): string[] {
  const offset = Math.floor(
    Math.random() * (MAX_REQUEUE_OFFSET - MIN_REQUEUE_OFFSET + 1)
  ) + MIN_REQUEUE_OFFSET;
  const insertAt = Math.min(offset, remainingQueue.length);

  const next = [...remainingQueue];
  next.splice(insertAt, 0, word);
  return next;
}

export function scoreForAnswer(wasEverMissedThisRound: boolean): number {
  return wasEverMissedThisRound ? 5 : 10;
}

export const HINT_AFTER_MISSES = 2;

export function hintText(word: string): string {
  const firstLetter = word[0].toUpperCase();
  const blanks = Array(word.length - 1).fill('_').join(' ');
  return blanks ? `${firstLetter} ${blanks}` : firstLetter;
}

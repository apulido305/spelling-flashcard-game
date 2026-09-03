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

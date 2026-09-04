export type Screen = 'setup' | 'play' | 'summary';

export interface GameState {
  queue: string[];
  score: number;
  missCounts: Record<string, number>;
  wordsCompleted: number;
}

export type Screen = 'setup' | 'play' | 'summary';

export type GameMode = 'practice' | 'quiz';

export interface GameState {
  mode: GameMode;
  queue: string[];
  score: number;
  missCounts: Record<string, number>;
  usedHelp: Record<string, boolean>;
  wordsCompleted: number;
}

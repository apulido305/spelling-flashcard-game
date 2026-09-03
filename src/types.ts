export type Screen = 'setup' | 'play' | 'summary';

export interface GameState {
  queue: string[];
  score: number;
  missed: Set<string>;
}

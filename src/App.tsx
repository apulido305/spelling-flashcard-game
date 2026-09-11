import { useEffect, useState } from 'react';
import type { Screen, GameState, GameMode } from './types';
import { initQueueWithMastery } from './lib/gameLogic';
import { loadJSON, saveJSON, clearJSON } from './lib/storage';
import { getMasteredSet, recordSessionResults } from './lib/mastery';
import { recordDayPracticed } from './lib/streak';
import { recordQuizResult } from './lib/quizHistory';
import { getAccessibilitySettings, saveAccessibilitySettings } from './lib/accessibility';
import Setup from './screens/Setup';
import Play from './screens/Play';
import Summary from './screens/Summary';

interface SessionState {
  screen: Screen;
  setupText: string;
  words: string[];
  sentences: Record<string, string>;
  game: GameState | null;
  finalScore: number;
  finalMissed: string[];
  finalNewlyMastered: string[];
}

const STORAGE_KEY = 'session';

function defaultSession(): SessionState {
  return {
    screen: 'setup',
    setupText: '',
    words: [],
    sentences: {},
    game: null,
    finalScore: 0,
    finalMissed: [],
    finalNewlyMastered: [],
  };
}

function freshGame(words: string[], mode: GameMode): GameState {
  const mastered = getMasteredSet(words);
  return {
    mode,
    queue: initQueueWithMastery(words, mastered),
    score: 0,
    missCounts: {},
    usedHelp: {},
    wordsCompleted: 0,
  };
}

export default function App() {
  const [session, setSession] = useState<SessionState>(() =>
    loadJSON(STORAGE_KEY, defaultSession())
  );
  const [settings, setSettings] = useState(() => getAccessibilitySettings());

  useEffect(() => {
    saveJSON(STORAGE_KEY, session);
  }, [session]);

  // Applied at the document root, not just the app card, so the large-text
  // toggle's rem-based scaling reaches every element (rem is always relative
  // to the root <html> font-size, regardless of where a class is applied).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('large-text', settings.largeText);
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('dyslexia-font', settings.dyslexiaFont);
  }, [settings]);

  const { screen, setupText, words, sentences, game, finalScore, finalMissed, finalNewlyMastered } = session;

  function handleNewList() {
    clearJSON(STORAGE_KEY);
    setSession(defaultSession());
  }

  function handleSettingsChange(next: typeof settings) {
    setSettings(next);
    saveAccessibilitySettings(next);
  }

  return (
    <div className="app-card">
      {screen === 'setup' && (
        <Setup
          text={setupText}
          onTextChange={(text) => setSession((s) => ({ ...s, setupText: text }))}
          onWordsReady={(list, mode, listSentences) =>
            setSession((s) => ({
              ...s,
              screen: 'play',
              words: list,
              sentences: listSentences,
              game: freshGame(list, mode),
            }))
          }
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {screen === 'play' && game && (
        <Play
          game={game}
          sentences={sentences}
          onGameChange={(g) => setSession((s) => ({ ...s, game: g }))}
          onFinish={(score, missed) => {
            // Quiz mode is a readiness check, not a practice session - it
            // deliberately doesn't feed the mastery streak, so a stressful
            // no-hints test attempt can't be conflated with (or accidentally
            // fast-track) the calmer practice-mode mastery signal.
            const newlyMastered =
              game.mode === 'practice' ? recordSessionResults(words, missed) : [];
            recordDayPracticed();
            if (game.mode === 'quiz') recordQuizResult(score, words.length);
            setSession((s) => ({
              ...s,
              screen: 'summary',
              finalScore: score,
              finalMissed: missed,
              finalNewlyMastered: newlyMastered,
            }));
          }}
          onRestart={() => setSession((s) => ({ ...s, game: freshGame(words, game.mode) }))}
          onNewList={handleNewList}
        />
      )}

      {screen === 'summary' && (
        <Summary
          mode={game?.mode ?? 'practice'}
          score={finalScore}
          totalWords={words.length}
          missed={finalMissed}
          newlyMastered={finalNewlyMastered}
          onPlayAgain={() =>
            setSession((s) => ({ ...s, screen: 'play', game: freshGame(words, game?.mode ?? 'practice') }))
          }
          onNewList={handleNewList}
        />
      )}
    </div>
  );
}

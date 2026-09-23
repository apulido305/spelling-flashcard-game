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

// Older deploys persisted sessions without fields added later (e.g.
// `sentences` and `finalNewlyMastered`, both added 2026-09-10). Loading one of
// those as-is crashed Play/Summary on first render - and since the broken
// session stays in localStorage, every reload white-screened again. Fill in
// anything missing so a session saved by any past version still loads.
function loadSession(): SessionState {
  const saved = loadJSON<Partial<SessionState> | null>(STORAGE_KEY, null);
  if (!saved || typeof saved !== 'object') return defaultSession();
  const session: SessionState = { ...defaultSession(), ...saved };
  const game = session.game as Partial<GameState> | null;
  session.game =
    game && typeof game === 'object' && Array.isArray(game.queue)
      ? {
          mode: game.mode === 'quiz' ? 'quiz' : 'practice',
          queue: game.queue,
          score: game.score ?? 0,
          missCounts: game.missCounts ?? {},
          usedHelp: game.usedHelp ?? {},
          wordsCompleted: game.wordsCompleted ?? 0,
        }
      : null;
  if (!Array.isArray(session.words)) session.words = [];
  if (!Array.isArray(session.finalMissed)) session.finalMissed = [];
  if (!Array.isArray(session.finalNewlyMastered)) session.finalNewlyMastered = [];
  if (!session.sentences || typeof session.sentences !== 'object') session.sentences = {};
  if (typeof session.setupText !== 'string') session.setupText = '';
  return session;
}

export function clearSavedSession() {
  clearJSON(STORAGE_KEY);
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
  const [session, setSession] = useState<SessionState>(loadSession);
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

  // A persistent escape hatch rendered outside every screen's own JSX, so
  // it's reachable even if a screen fails to render anything (e.g. a
  // corrupted/partial persisted session leaves `game` null while
  // screen === 'play') - previously the only way back to Setup in that
  // state was to open a private window and get a fresh, empty localStorage.
  function handleHomeClick() {
    if (screen === 'play' && !window.confirm('Return to the home screen? Your current progress will be lost.')) {
      return;
    }
    handleNewList();
  }

  function handleSettingsChange(next: typeof settings) {
    setSettings(next);
    saveAccessibilitySettings(next);
  }

  return (
    <div className="app-card">
      {screen !== 'setup' && (
        <div className="home-bar">
          <button type="button" className="secondary home-button" onClick={handleHomeClick}>
            🏠 Home
          </button>
        </div>
      )}

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

import { useEffect, useState } from 'react';
import type { Screen, GameState } from './types';
import { initQueue } from './lib/gameLogic';
import { loadJSON, saveJSON, clearJSON } from './lib/storage';
import Setup from './screens/Setup';
import Play from './screens/Play';
import Summary from './screens/Summary';

interface SessionState {
  screen: Screen;
  setupText: string;
  words: string[];
  game: GameState | null;
  finalScore: number;
  finalMissed: string[];
}

const STORAGE_KEY = 'session';

function defaultSession(): SessionState {
  return {
    screen: 'setup',
    setupText: '',
    words: [],
    game: null,
    finalScore: 0,
    finalMissed: [],
  };
}

function freshGame(words: string[]): GameState {
  return { queue: initQueue(words), score: 0, missCounts: {}, usedHelp: {}, wordsCompleted: 0 };
}

export default function App() {
  const [session, setSession] = useState<SessionState>(() =>
    loadJSON(STORAGE_KEY, defaultSession())
  );

  useEffect(() => {
    saveJSON(STORAGE_KEY, session);
  }, [session]);

  const { screen, setupText, words, game, finalScore, finalMissed } = session;

  function handleNewList() {
    clearJSON(STORAGE_KEY);
    setSession(defaultSession());
  }

  return (
    <div className="app-card">
      {screen === 'setup' && (
        <Setup
          text={setupText}
          onTextChange={(text) => setSession((s) => ({ ...s, setupText: text }))}
          onWordsReady={(list) =>
            setSession((s) => ({
              ...s,
              screen: 'play',
              words: list,
              game: freshGame(list),
            }))
          }
        />
      )}

      {screen === 'play' && game && (
        <Play
          game={game}
          onGameChange={(g) => setSession((s) => ({ ...s, game: g }))}
          onFinish={(score, missed) =>
            setSession((s) => ({ ...s, screen: 'summary', finalScore: score, finalMissed: missed }))
          }
          onRestart={() => setSession((s) => ({ ...s, game: freshGame(words) }))}
          onNewList={handleNewList}
        />
      )}

      {screen === 'summary' && (
        <Summary
          score={finalScore}
          missed={finalMissed}
          onPlayAgain={() =>
            setSession((s) => ({ ...s, screen: 'play', game: freshGame(words) }))
          }
          onNewList={handleNewList}
        />
      )}
    </div>
  );
}

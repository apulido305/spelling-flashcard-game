import { useState } from 'react';
import type { Screen } from './types';
import Setup from './screens/Setup';
import Play from './screens/Play';
import Summary from './screens/Summary';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [words, setWords] = useState<string[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [finalMissed, setFinalMissed] = useState<string[]>([]);

  return (
    <div className="app-card">
      {screen === 'setup' && (
        <Setup
          onWordsReady={(list) => {
            setWords(list);
            setScreen('play');
          }}
        />
      )}

      {screen === 'play' && (
        <Play
          words={words}
          onFinish={(score, missed) => {
            setFinalScore(score);
            setFinalMissed(missed);
            setScreen('summary');
          }}
        />
      )}

      {screen === 'summary' && (
        <Summary
          score={finalScore}
          missed={finalMissed}
          onPlayAgain={() => setScreen('play')}
          onNewList={() => {
            setWords([]);
            setFinalScore(0);
            setFinalMissed([]);
            setScreen('setup');
          }}
        />
      )}
    </div>
  );
}

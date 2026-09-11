import type { GameMode } from '../types';

interface SummaryProps {
  mode: GameMode;
  score: number;
  totalWords: number;
  missed: string[];
  newlyMastered: string[];
  onPlayAgain: () => void;
  onNewList: () => void;
}

export default function Summary({
  mode,
  score,
  totalWords,
  missed,
  newlyMastered,
  onPlayAgain,
  onNewList,
}: SummaryProps) {
  const isQuiz = mode === 'quiz';

  return (
    <>
      <h1>{isQuiz ? 'Test Complete!' : 'Session Complete!'}</h1>
      <div className="summary-score">
        {isQuiz ? `${score} / ${totalWords} correct` : `${score} points`}
      </div>

      {newlyMastered.length > 0 && (
        <p className="newly-mastered">
          🌟 {newlyMastered.length === 1 ? 'Word mastered' : `${newlyMastered.length} words mastered`}:{' '}
          {newlyMastered.join(', ')}!
        </p>
      )}

      <h2>{isQuiz ? 'Study These Before Your Real Test' : 'Words to Review'}</h2>
      {missed.length > 0 ? (
        <ul className="missed-list">
          {missed.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
      ) : (
        <p className="no-missed">
          {isQuiz
            ? "Every word correct — you're ready!"
            : 'No misses — every word was correct on the first try!'}
        </p>
      )}

      <div className="button-row">
        <button onClick={onPlayAgain}>{isQuiz ? 'Retake the Test' : 'Play Again'}</button>
        <button className="secondary" onClick={onNewList}>
          New List
        </button>
      </div>
    </>
  );
}

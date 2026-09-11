interface SummaryProps {
  score: number;
  missed: string[];
  newlyMastered: string[];
  onPlayAgain: () => void;
  onNewList: () => void;
}

export default function Summary({
  score,
  missed,
  newlyMastered,
  onPlayAgain,
  onNewList,
}: SummaryProps) {
  return (
    <>
      <h1>Session Complete!</h1>
      <div className="summary-score">{score} points</div>

      {newlyMastered.length > 0 && (
        <p className="newly-mastered">
          🌟 {newlyMastered.length === 1 ? 'Word mastered' : `${newlyMastered.length} words mastered`}:{' '}
          {newlyMastered.join(', ')}!
        </p>
      )}

      <h2>Words to Review</h2>
      {missed.length > 0 ? (
        <ul className="missed-list">
          {missed.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
      ) : (
        <p className="no-missed">No misses — every word was correct on the first try!</p>
      )}

      <div className="button-row">
        <button onClick={onPlayAgain}>Play Again</button>
        <button className="secondary" onClick={onNewList}>
          New List
        </button>
      </div>
    </>
  );
}

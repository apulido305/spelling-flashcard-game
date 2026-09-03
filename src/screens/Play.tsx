import { useEffect, useState } from 'react';
import { initQueue, requeue, scoreForAnswer } from '../lib/gameLogic';
import { isSpeechSupported, speakWord } from '../lib/speech';

interface PlayProps {
  words: string[];
  onFinish: (score: number, missed: string[]) => void;
}

interface Feedback {
  type: 'correct' | 'incorrect';
  text: string;
}

const CORRECT_DELAY_MS = 1200;
const INCORRECT_DELAY_MS = 1800;

export default function Play({ words, onFinish }: PlayProps) {
  const [queue, setQueue] = useState<string[]>(() => initQueue(words));
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);

  const currentWord = queue[0];
  const speechSupported = isSpeechSupported();

  useEffect(() => {
    if (currentWord) speakWord(currentWord);
  }, [currentWord]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !currentWord) return;
    const guess = input.trim();
    if (!guess) return;

    const isCorrect = guess.toLowerCase() === currentWord.toLowerCase();
    setBusy(true);

    if (isCorrect) {
      const wasEverMissed = missed.has(currentWord);
      const points = scoreForAnswer(wasEverMissed);
      const newScore = score + points;
      setScore(newScore);
      setWordsCompleted((c) => c + 1);
      setFeedback({ type: 'correct', text: `Correct! +${points} points` });

      const restQueue = queue.slice(1);
      setTimeout(() => {
        setQueue(restQueue);
        setInput('');
        setFeedback(null);
        setBusy(false);
        if (restQueue.length === 0) {
          onFinish(newScore, Array.from(missed));
        }
      }, CORRECT_DELAY_MS);
    } else {
      const newMissed = new Set(missed);
      newMissed.add(currentWord);
      setMissed(newMissed);
      setFeedback({
        type: 'incorrect',
        text: `Not quite — it's spelled "${currentWord}"`,
      });

      const restQueue = requeue(queue.slice(1), currentWord);
      setTimeout(() => {
        setQueue(restQueue);
        setInput('');
        setFeedback(null);
        setBusy(false);
      }, INCORRECT_DELAY_MS);
    }
  }

  if (!currentWord) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <div className="play-progress">
        <span>Word {wordsCompleted + 1}</span>
        <span>Score: {score}</span>
        <span>{queue.length - 1} left in queue</span>
      </div>

      <div className="play-definition">
        <div className="play-listen">
          <button
            type="button"
            className="speak-button"
            onClick={() => speakWord(currentWord)}
            disabled={!speechSupported}
          >
            🔊 Hear it again
          </button>
          {!speechSupported && (
            <p className="error-text">
              Audio isn't supported in this browser — try Chrome, Edge, or Safari.
            </p>
          )}
        </div>
      </div>

      <form className="play-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type the word…"
          disabled={busy}
          autoFocus
        />
        <button type="submit" disabled={busy || input.trim().length === 0}>
          Submit
        </button>
      </form>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>{feedback.text}</div>
      )}
    </>
  );
}

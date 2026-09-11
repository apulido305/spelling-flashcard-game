import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import { HINT_AFTER_MISSES, hintText, requeue, scoreForAnswer } from '../lib/gameLogic';
import {
  getLastSpeechDebugInfo,
  isSpeechSupported,
  soundOutWord,
  speakWord,
  spellOutWord,
  type SpeechDebugInfo,
} from '../lib/speech';

const DEBUG_VOICE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugvoice');

interface PlayProps {
  game: GameState;
  onGameChange: (game: GameState) => void;
  onFinish: (score: number, missed: string[]) => void;
  onRestart: () => void;
  onNewList: () => void;
}

interface Feedback {
  type: 'correct' | 'incorrect';
  text: string;
}

const CORRECT_DELAY_MS = 1200;
const INCORRECT_DELAY_MS = 1800;

function reviewWords(missCounts: Record<string, number>, usedHelp: Record<string, boolean>): string[] {
  const fromMisses = Object.keys(missCounts).filter((w) => missCounts[w] > 0);
  const fromHelp = Object.keys(usedHelp).filter((w) => usedHelp[w]);
  return Array.from(new Set([...fromMisses, ...fromHelp]));
}

export default function Play({ game, onGameChange, onFinish, onRestart, onNewList }: PlayProps) {
  const { mode, queue, score, missCounts, usedHelp = {}, wordsCompleted } = game;
  const isQuiz = mode === 'quiz';
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);

  const [debugInfo, setDebugInfo] = useState<SpeechDebugInfo | null>(null);

  const currentWord = queue[0];
  const speechSupported = isSpeechSupported();
  const missCount = currentWord ? missCounts[currentWord] ?? 0 : 0;
  const showHint = !isQuiz && missCount >= HINT_AFTER_MISSES;
  const gotHelpThisWord = currentWord ? !!usedHelp[currentWord] || missCount > 0 : false;

  useEffect(() => {
    if (currentWord) speakWord(currentWord);
  }, [currentWord]);

  useEffect(() => {
    if (!DEBUG_VOICE) return;
    const interval = setInterval(() => setDebugInfo(getLastSpeechDebugInfo()), 300);
    return () => clearInterval(interval);
  }, []);

  function markHelpUsed() {
    if (!currentWord || usedHelp[currentWord]) return;
    onGameChange({ ...game, usedHelp: { ...usedHelp, [currentWord]: true } });
  }

  function handleSpellIt() {
    if (!currentWord) return;
    spellOutWord(currentWord);
    markHelpUsed();
  }

  function handleSoundOutPhonetically() {
    if (!currentWord) return;
    // Unlike Spell it (which names every letter outright), sounding a word
    // out phonetically is a spelling strategy we want to encourage, not a
    // hint that gives the answer away — no score/review-list penalty.
    soundOutWord(currentWord);
  }

  function handleRestartClick() {
    const message = isQuiz
      ? 'Restart this test? Your current progress will be lost.'
      : 'Restart this word list? Your current score and progress will be lost.';
    if (window.confirm(message)) onRestart();
  }

  function handleNewListClick() {
    if (window.confirm('Start a new list? Your current progress will be lost.')) {
      onNewList();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !currentWord) return;
    const guess = input.trim();
    if (!guess) return;

    const isCorrect = guess.toLowerCase() === currentWord.toLowerCase();
    setBusy(true);

    if (isQuiz) {
      // Quiz mode: one attempt per word, no requeue on a miss — the word is
      // done either way, since this is a readiness check, not practice.
      const restQueue = queue.slice(1);
      const newWordsCompleted = wordsCompleted + 1;

      if (isCorrect) {
        const newScore = score + 1;
        setFeedback({ type: 'correct', text: 'Correct!' });
        setTimeout(() => {
          setInput('');
          setFeedback(null);
          setBusy(false);
          if (restQueue.length === 0) {
            onFinish(newScore, reviewWords(missCounts, usedHelp));
          } else {
            onGameChange({ ...game, queue: restQueue, score: newScore, wordsCompleted: newWordsCompleted });
          }
        }, CORRECT_DELAY_MS);
      } else {
        const newMissCounts = { ...missCounts, [currentWord]: (missCounts[currentWord] ?? 0) + 1 };
        setFeedback({ type: 'incorrect', text: `Not quite — it's spelled "${currentWord}"` });
        setTimeout(() => {
          setInput('');
          setFeedback(null);
          setBusy(false);
          if (restQueue.length === 0) {
            onFinish(score, reviewWords(newMissCounts, usedHelp));
          } else {
            onGameChange({
              ...game,
              queue: restQueue,
              missCounts: newMissCounts,
              wordsCompleted: newWordsCompleted,
            });
          }
        }, INCORRECT_DELAY_MS);
      }
      return;
    }

    if (isCorrect) {
      const points = scoreForAnswer(gotHelpThisWord);
      const newScore = score + points;
      const newWordsCompleted = wordsCompleted + 1;
      setFeedback({ type: 'correct', text: `Correct! +${points} points` });

      const restQueue = queue.slice(1);
      setTimeout(() => {
        setInput('');
        setFeedback(null);
        setBusy(false);
        if (restQueue.length === 0) {
          onFinish(newScore, reviewWords(missCounts, usedHelp));
        } else {
          onGameChange({
            ...game,
            queue: restQueue,
            score: newScore,
            wordsCompleted: newWordsCompleted,
          });
        }
      }, CORRECT_DELAY_MS);
    } else {
      const newMissCounts = {
        ...missCounts,
        [currentWord]: (missCounts[currentWord] ?? 0) + 1,
      };
      setFeedback({
        type: 'incorrect',
        text: `Not quite — it's spelled "${currentWord}"`,
      });

      const restQueue = requeue(queue.slice(1), currentWord);
      setTimeout(() => {
        setInput('');
        setFeedback(null);
        setBusy(false);
        onGameChange({
          ...game,
          queue: restQueue,
          missCounts: newMissCounts,
        });
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
        <span>{isQuiz ? `Correct: ${score}` : `Score: ${score}`}</span>
        <span>{queue.length - 1} left in queue</span>
      </div>

      <div className="play-definition">
        <div className="play-listen">
          <div className="play-listen-buttons">
            <button
              type="button"
              className="speak-button"
              onClick={() => speakWord(currentWord)}
              disabled={!speechSupported}
            >
              🔊 Hear it again
            </button>
            {!isQuiz && (
              <>
                <button
                  type="button"
                  className="speak-button secondary-speak"
                  onClick={handleSpellIt}
                  disabled={!speechSupported}
                >
                  🔤 Spell it
                </button>
                <button
                  type="button"
                  className="speak-button secondary-speak"
                  onClick={handleSoundOutPhonetically}
                  disabled={!speechSupported}
                >
                  🗣️ Sound it out
                </button>
              </>
            )}
          </div>
          {!speechSupported && (
            <p className="error-text">
              Audio isn't supported in this browser — try Chrome, Edge, or Safari.
            </p>
          )}
          {showHint && <p className="hint-text">Hint: {hintText(currentWord)}</p>}
          {!isQuiz && usedHelp[currentWord] && (
            <p className="help-used-note">
              Spell it used — this word is worth 5 points and goes on the review list.
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

      <div className="button-row">
        <button type="button" className="secondary" onClick={handleRestartClick}>
          🔄 Restart
        </button>
        <button type="button" className="secondary" onClick={handleNewListClick}>
          🏠 New List
        </button>
      </div>

      {DEBUG_VOICE && (
        <pre
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#1a1a1a',
            color: '#5CFF9D',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            borderRadius: '8px',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {debugInfo
            ? [
                `text: "${debugInfo.text}"`,
                `voiceName: ${debugInfo.voiceName ?? '(none — using browser default)'}`,
                `voiceURI: ${debugInfo.voiceURI ?? '-'}`,
                `isHighQuality: ${debugInfo.isHighQuality}`,
                `rate: ${debugInfo.rate}`,
                `voiceCount: ${debugInfo.voiceCount}`,
                `calledAt: ${debugInfo.calledAt}`,
              ].join('\n')
            : 'No speech triggered yet.'}
        </pre>
      )}
    </>
  );
}

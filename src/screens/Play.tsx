import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import { HINT_AFTER_MISSES, hintText, requeue, scoreForAnswer } from '../lib/gameLogic';
import {
  getAvailableVoices,
  getLastSpeechDebugInfo,
  getPreferredVoiceURI,
  isSpeechSupported,
  setPreferredVoiceURI,
  speakWord,
  spellOutWord,
  type SpeechDebugInfo,
} from '../lib/speech';

const DEBUG_VOICE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugvoice');

interface PlayProps {
  game: GameState;
  onGameChange: (game: GameState) => void;
  onFinish: (score: number, missed: string[]) => void;
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

export default function Play({ game, onGameChange, onFinish }: PlayProps) {
  const { queue, score, missCounts, usedHelp = {}, wordsCompleted } = game;
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);

  const [debugInfo, setDebugInfo] = useState<SpeechDebugInfo | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);

  const currentWord = queue[0];
  const speechSupported = isSpeechSupported();
  const missCount = currentWord ? missCounts[currentWord] ?? 0 : 0;
  const showHint = missCount >= HINT_AFTER_MISSES;
  const gotHelpThisWord = currentWord ? !!usedHelp[currentWord] || missCount > 0 : false;

  useEffect(() => {
    if (currentWord) speakWord(currentWord);
  }, [currentWord]);

  useEffect(() => {
    if (!DEBUG_VOICE) return;
    const interval = setInterval(() => setDebugInfo(getLastSpeechDebugInfo()), 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!speechSupported) return;
    setSelectedVoiceURI(getPreferredVoiceURI());
    const refresh = () => setVoices(getAvailableVoices());
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, []);

  function handleVoiceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const uri = e.target.value || null;
    setSelectedVoiceURI(uri);
    setPreferredVoiceURI(uri);
    if (currentWord) speakWord(currentWord);
  }

  function handleSoundItOut() {
    if (!currentWord) return;
    spellOutWord(currentWord);
    if (!usedHelp[currentWord]) {
      onGameChange({ ...game, usedHelp: { ...usedHelp, [currentWord]: true } });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !currentWord) return;
    const guess = input.trim();
    if (!guess) return;

    const isCorrect = guess.toLowerCase() === currentWord.toLowerCase();
    setBusy(true);

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
            queue: restQueue,
            score: newScore,
            missCounts,
            usedHelp,
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
          queue: restQueue,
          score,
          missCounts: newMissCounts,
          usedHelp,
          wordsCompleted,
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
        <span>Score: {score}</span>
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
            <button
              type="button"
              className="speak-button secondary-speak"
              onClick={handleSoundItOut}
              disabled={!speechSupported}
            >
              🔤 Sound it out
            </button>
          </div>
          {speechSupported && voices.length > 0 && (
            <label className="voice-picker">
              Voice:
              <select value={selectedVoiceURI ?? ''} onChange={handleVoiceChange}>
                <option value="">Auto (recommended)</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!speechSupported && (
            <p className="error-text">
              Audio isn't supported in this browser — try Chrome, Edge, or Safari.
            </p>
          )}
          {showHint && <p className="hint-text">Hint: {hintText(currentWord)}</p>}
          {usedHelp[currentWord] && (
            <p className="help-used-note">
              Sound it out used — this word is worth 5 points and goes on the review list.
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

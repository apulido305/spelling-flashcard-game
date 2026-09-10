import { DEFAULT_WORDS } from '../lib/defaultWords';

interface SetupProps {
  text: string;
  onTextChange: (text: string) => void;
  onWordsReady: (words: string[]) => void;
}

export default function Setup({ text, onTextChange, onWordsReady }: SetupProps) {
  const words = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <>
      <h1>Spelling Practice</h1>

      <div className="quick-start">
        <p className="subtitle">Ready to practice this week's words?</p>
        <button
          className="play-now-button"
          onClick={() => onWordsReady(DEFAULT_WORDS)}
        >
          ▶ Play
        </button>
      </div>

      <p className="subtitle">Or paste a new list of words, one per line:</p>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={'example\nnecessary\nrhythm\n...'}
      />
      <div className="button-row">
        <button onClick={() => onWordsReady(words)} disabled={words.length === 0}>
          Start Game
        </button>
        {text.length > 0 && (
          <button type="button" className="secondary" onClick={() => onTextChange('')}>
            Clear
          </button>
        )}
      </div>
    </>
  );
}

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
      <p className="subtitle">Paste this week's spelling words, one per line.</p>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={'example\nnecessary\nrhythm\n...'}
      />
      <div className="button-row">
        <button onClick={() => onWordsReady(words)} disabled={words.length === 0}>
          Start Game
        </button>
      </div>
    </>
  );
}

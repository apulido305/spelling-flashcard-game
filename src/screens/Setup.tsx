import { useState } from 'react';
import { DEFAULT_WORDS } from '../lib/defaultWords';
import { deleteList, getSavedLists, saveList, type SavedList } from '../lib/savedLists';

interface SetupProps {
  text: string;
  onTextChange: (text: string) => void;
  onWordsReady: (words: string[]) => void;
}

export default function Setup({ text, onTextChange, onWordsReady }: SetupProps) {
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => getSavedLists());

  const words = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  function handleSaveList() {
    const name = window.prompt('Name this list (e.g. "Week 3 words"):');
    if (!name || !name.trim()) return;
    setSavedLists(saveList(name.trim(), words));
  }

  function handleLoadList(list: SavedList) {
    onTextChange(list.words.join('\n'));
  }

  function handleDeleteList(list: SavedList) {
    if (window.confirm(`Delete the saved list "${list.name}"?`)) {
      setSavedLists(deleteList(list.id));
    }
  }

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

      {savedLists.length > 0 && (
        <div className="saved-lists">
          <p className="subtitle">Your saved lists:</p>
          <ul className="saved-lists-list">
            {savedLists.map((list) => (
              <li key={list.id} className="saved-list-row">
                <span className="saved-list-name">
                  {list.name} <span className="saved-list-count">({list.words.length} words)</span>
                </span>
                <div className="saved-list-actions">
                  <button type="button" className="secondary" onClick={() => handleLoadList(list)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="secondary saved-list-delete"
                    onClick={() => handleDeleteList(list)}
                    aria-label={`Delete ${list.name}`}
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <button
          type="button"
          className="secondary"
          onClick={handleSaveList}
          disabled={words.length === 0}
        >
          💾 Save List
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

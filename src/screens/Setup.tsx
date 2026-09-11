import { useState } from 'react';
import type { GameMode } from '../types';
import { DEFAULT_WORDS } from '../lib/defaultWords';
import { deleteList, getSavedLists, saveList, type SavedList } from '../lib/savedLists';
import { getMasteredSet } from '../lib/mastery';
import { getCurrentStreak } from '../lib/streak';
import { getRecentQuizResults } from '../lib/quizHistory';

interface SetupProps {
  text: string;
  onTextChange: (text: string) => void;
  onWordsReady: (words: string[], mode: GameMode) => void;
}

export default function Setup({ text, onTextChange, onWordsReady }: SetupProps) {
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => getSavedLists());

  const words = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const streak = getCurrentStreak();
  const recentQuizzes = getRecentQuizResults();
  const masteredCount = words.length > 0 ? getMasteredSet(words).size : 0;
  const hasDashboardContent = streak > 0 || recentQuizzes.length > 0 || words.length > 0;

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

      {hasDashboardContent && (
        <div className="dashboard">
          <p className="subtitle">📊 Your progress:</p>
          <div className="dashboard-stats">
            {streak > 0 && (
              <span className="dashboard-chip">
                🔥 {streak} day{streak === 1 ? '' : 's'} in a row
              </span>
            )}
            {words.length > 0 && (
              <span className="dashboard-chip">
                🌟 {masteredCount} / {words.length} words mastered
              </span>
            )}
          </div>
          {recentQuizzes.length > 0 && (
            <p className="dashboard-quizzes">
              📝 Recent tests: {recentQuizzes.map((q) => `${q.score}/${q.total}`).join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="quick-start">
        <p className="subtitle">Ready to practice this week's words?</p>
        <button
          className="play-now-button"
          onClick={() => onWordsReady(DEFAULT_WORDS, 'practice')}
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
        <button onClick={() => onWordsReady(words, 'practice')} disabled={words.length === 0}>
          Start Game
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => onWordsReady(words, 'quiz')}
          disabled={words.length === 0}
        >
          📝 Take the Test
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

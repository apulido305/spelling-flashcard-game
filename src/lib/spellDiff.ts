// Turns a wrong guess into a short, specific explanation instead of just
// revealing the correct spelling — "you're missing a letter after 'hou'"
// teaches something "not quite" doesn't. Only handles the common single-edit
// mistake shapes (one substitution, one adjacent transposition, one missing
// or one extra letter); anything messier falls back to null so the caller
// can use its existing generic message rather than force a confusing
// explanation onto a guess that isn't close.

function locationPhrase(word: string, index: number): string {
  return index === 0 ? 'at the start' : `after "${word.slice(0, index)}"`;
}

interface EqualLengthDiff {
  type: 'substitution' | 'transposition';
  index: number;
}

function diffEqualLength(guess: string, word: string): EqualLengthDiff | null {
  const diffIndexes: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (guess[i] !== word[i]) diffIndexes.push(i);
  }

  if (diffIndexes.length === 1) {
    return { type: 'substitution', index: diffIndexes[0] };
  }

  if (diffIndexes.length === 2) {
    const [a, b] = diffIndexes;
    if (b === a + 1 && guess[a] === word[b] && guess[b] === word[a]) {
      return { type: 'transposition', index: a };
    }
  }

  return null;
}

// Finds the single index in `longer` that must be removed to walk it down
// to `shorter`, or null if they differ by more than one such edit. Standard
// single-edit-distance check, kept to a simple two-pointer walk since this
// only ever needs to confirm a length-1 gap (not a general edit distance).
function findSingleExtraIndex(shorter: string, longer: string): number | null {
  let i = 0;
  let j = 0;
  let extraIndex: number | null = null;

  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
      continue;
    }
    if (extraIndex !== null) return null;
    extraIndex = j;
    j++;
  }

  if (extraIndex === null) extraIndex = longer.length - 1;
  return extraIndex;
}

export function classifyMistake(rawGuess: string, rawWord: string): string | null {
  const guess = rawGuess.trim().toLowerCase();
  const word = rawWord.toLowerCase();
  if (!guess || guess === word) return null;

  if (guess.length === word.length) {
    const diff = diffEqualLength(guess, word);
    if (!diff) return null;
    const where = locationPhrase(word, diff.index);
    if (diff.type === 'substitution') {
      return `Check the letter ${where} — it should be "${word[diff.index]}", not "${guess[diff.index]}".`;
    }
    const a = word[diff.index];
    const b = word[diff.index + 1];
    return `Two letters are swapped ${where} — it's "${a}${b}", not "${b}${a}".`;
  }

  if (guess.length === word.length - 1) {
    const missingIndex = findSingleExtraIndex(guess, word);
    if (missingIndex === null) return null;
    const where = locationPhrase(word, missingIndex);
    return `You're missing a letter ${where} — there's a "${word[missingIndex]}".`;
  }

  if (guess.length === word.length + 1) {
    const extraIndex = findSingleExtraIndex(word, guess);
    if (extraIndex === null) return null;
    const where = locationPhrase(word, extraIndex);
    return `You have an extra letter ${where} — take out the "${guess[extraIndex]}".`;
  }

  return null;
}

import { hyphenateSync } from 'hyphen/en';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

function isVowel(ch: string): boolean {
  return VOWELS.has(ch);
}

// Fallback for words hyphenation declines to split — real hyphenation
// algorithms deliberately avoid inserting breaks in short/monosyllabic
// words (hyphenation is for line-breaking long words, not exhaustive
// syllable-marking), so "cat" comes back unsplit. Without this, "Sound it
// out" would sound identical to "Hear it again" for every short word.
function splitOnsetRime(word: string): string[] {
  const firstVowel = [...word].findIndex((ch) => isVowel(ch));
  if (firstVowel <= 0) return [word];
  return [word.slice(0, firstVowel), word.slice(firstVowel)];
}

const SOFT_HYPHEN = '­';

// Uses Frank Liang's hyphenation algorithm (the same one TeX and word
// processors use for line-break hyphenation, trained on real
// hand-hyphenated English dictionaries) rather than a hand-rolled
// letter-pattern heuristic — dramatically more linguistically accurate
// (the old heuristic split consonant digraphs apart, e.g. "father" ->
// fat-her instead of fa-ther, since it had no notion that "th" is one
// sound). Still works on arbitrary words (typos, proper nouns, made-up
// practice words) since it's a pattern-matching algorithm, not a
// dictionary lookup, so it degrades the same way the old heuristic did.
//
// Must stay synchronous (hyphenateSync, not hyphenate): speakText() in
// speech.ts requires speak() to stay in the same call stack as the
// triggering user gesture, or iOS Safari degrades playback quality for
// higher-tier voices.
export function syllabify(word: string): string[] {
  const hyphenated = hyphenateSync(word);
  const parts = hyphenated.split(SOFT_HYPHEN);
  if (parts.length > 1) return parts;
  return splitOnsetRime(word.toLowerCase());
}

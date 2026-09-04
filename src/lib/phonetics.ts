const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

function isVowel(ch: string): boolean {
  return VOWELS.has(ch);
}

function splitOnsetRime(word: string): string[] {
  const firstVowel = [...word].findIndex((ch) => isVowel(ch));
  if (firstVowel <= 0) return [word];
  return [word.slice(0, firstVowel), word.slice(firstVowel)];
}

// Rough, dependency-free syllable splitter. Not linguistically precise (true
// English syllabification has plenty of exceptions no simple rule captures),
// but gives a reasonable "sound it out" chunking for arbitrary words —
// including typos or proper nouns — without needing a bundled pronunciation
// dictionary that would fail ungracefully on anything outside it.
export function syllabify(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return [word];

  let nuclei: Array<[number, number]> = [];
  let i = 0;
  while (i < w.length) {
    if (isVowel(w[i])) {
      const start = i;
      while (i < w.length && isVowel(w[i])) i++;
      nuclei.push([start, i]);
    } else {
      i++;
    }
  }

  // Fold a silent trailing "e" (cake, house, envelope) into the previous
  // syllable instead of giving it its own chunk.
  if (nuclei.length > 1 && w.endsWith('e') && nuclei[nuclei.length - 1][0] === w.length - 1) {
    nuclei = nuclei.slice(0, -1);
  }

  if (nuclei.length <= 1) return splitOnsetRime(w);

  const boundaries = [0];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const gapStart = nuclei[n][1];
    const gapEnd = nuclei[n + 1][0];
    const gapLen = gapEnd - gapStart;
    boundaries.push(gapLen <= 1 ? gapStart : gapStart + Math.ceil(gapLen / 2));
  }
  boundaries.push(w.length);

  return boundaries.slice(0, -1).map((start, idx) => w.slice(start, boundaries[idx + 1]));
}

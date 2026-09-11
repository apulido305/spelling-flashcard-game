export interface ParsedWordList {
  words: string[];
  sentences: Record<string, string>;
}

// Parses the Setup textarea's plain-text format: one entry per line, each
// either just a word ("cat") or a word plus an optional example sentence
// ("their | They went to their house.") - the classic spelling-test format,
// most valuable for homophones where the word alone is ambiguous. Kept as
// inline pipe-delimited text rather than a separate per-word editing screen
// so the single-textarea paste workflow stays exactly as simple as before
// for the common case of no sentences at all.
export function parseWordListText(text: string): ParsedWordList {
  const words: string[] = [];
  const sentences: Record<string, string> = {};

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const [wordPart, ...rest] = line.split('|');
    const word = wordPart.trim();
    if (!word) continue;

    const sentence = rest.join('|').trim();
    words.push(word);
    if (sentence) sentences[word] = sentence;
  }

  return { words, sentences };
}

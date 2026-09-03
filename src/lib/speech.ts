export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

if (isSpeechSupported()) {
  const refreshVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  // Voice quality tier isn't always in .name (e.g. iOS keeps "Samantha" for every
  // tier) — the tier usually only shows up in .voiceURI, so check both.
  const haystack = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;
  if (/premium/.test(haystack)) score += 12;
  if (/enhanced|natural|neural/.test(haystack)) score += 10;
  if (/compact/.test(haystack)) score -= 5; // iOS's lowest-quality tier
  if (/eloquence/.test(haystack)) score -= 10; // notably robotic legacy engine
  if (voice.lang === 'en-US') score += 3;
  else if (voice.lang.startsWith('en')) score += 1;
  if (!voice.localService) score += 1; // cloud voices (e.g. Edge's neural voices) tend to sound better
  return score;
}

function pickBestVoice(): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;

  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;

  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

export function speakWord(word: string) {
  if (!isSpeechSupported()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.85;

  const voice = pickBestVoice();
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

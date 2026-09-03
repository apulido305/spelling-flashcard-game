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

function voiceHaystack(voice: SpeechSynthesisVoice): string {
  // Voice quality tier isn't always in .name (e.g. iOS keeps "Samantha" for every
  // tier) — the tier usually only shows up in .voiceURI, so check both.
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

// iOS Premium/Enhanced voices distort badly ("croaking") when spoken at anything
// other than their native rate — only the older standard/compact voices tolerate
// being slowed down cleanly.
function isHighQualityVoice(voice: SpeechSynthesisVoice): boolean {
  return /premium|enhanced|natural|neural/.test(voiceHaystack(voice));
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const haystack = voiceHaystack(voice);
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

  const voice = pickBestVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.rate = isHighQualityVoice(voice) ? 1 : 0.85;
  } else {
    utterance.rate = 0.85;
  }

  window.speechSynthesis.speak(utterance);
}

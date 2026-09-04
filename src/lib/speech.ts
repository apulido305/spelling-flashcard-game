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
  if (/enhanced/.test(haystack)) score += 12;
  if (/premium|natural|neural/.test(haystack)) score += 10;
  if (/compact/.test(haystack)) score -= 5; // iOS's lowest-quality tier
  if (/eloquence/.test(haystack)) score -= 10; // notably robotic legacy engine
  if (voice.lang === 'en-US') score += 3;
  else if (voice.lang.startsWith('en')) score += 1;
  if (!voice.localService) score += 1; // cloud voices (e.g. Edge's neural voices) tend to sound better
  return score;
}

function pickBestVoice(): SpeechSynthesisVoice | undefined {
  // Synchronous by design: speak() must stay in the same call stack as the
  // triggering user gesture (button tap) or iOS Safari can degrade playback
  // quality for higher-tier voices. Never await anything before speaking.
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;

  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;

  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

export interface SpeechDebugInfo {
  text: string;
  voiceName: string | null;
  voiceURI: string | null;
  isHighQuality: boolean | null;
  rate: number;
  voiceCount: number;
  calledAt: string;
}

let lastDebugInfo: SpeechDebugInfo | null = null;

export function getLastSpeechDebugInfo(): SpeechDebugInfo | null {
  return lastDebugInfo;
}

function speakText(text: string, standardVoiceRate: number) {
  const synth = window.speechSynthesis;

  function doSpeak() {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;

    const voice = pickBestVoice();
    const rate = voice ? (isHighQualityVoice(voice) ? 1 : standardVoiceRate) : standardVoiceRate;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;

    lastDebugInfo = {
      text,
      voiceName: voice?.name ?? null,
      voiceURI: voice?.voiceURI ?? null,
      isHighQuality: voice ? isHighQualityVoice(voice) : null,
      rate,
      voiceCount: (cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()).length,
      calledAt: new Date().toLocaleTimeString(),
    };

    synth.speak(utterance);
  }

  // Calling speak() right after cancel() can corrupt playback on iOS Safari
  // (audio comes out distorted/garbled) — give the engine a beat to reset.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(doSpeak, 50);
  } else {
    doSpeak();
  }
}

export function speakWord(word: string) {
  if (!isSpeechSupported()) return;
  speakText(word, 0.85);
}

export function spellOutWord(word: string) {
  if (!isSpeechSupported()) return;
  const letters = word.split('').join(', ');
  speakText(letters, 0.7);
}

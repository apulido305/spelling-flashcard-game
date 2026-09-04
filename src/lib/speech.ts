export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;

if (isSpeechSupported()) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

// getVoices() is frequently empty on the very first call after a fresh page
// load (notably iOS Safari) — the list only populates once 'voiceschanged'
// fires. Speaking before that resolves means pickBestVoice() can't identify
// the voice, so the code can't tell whether it's safe to slow the rate down,
// which is exactly what caused the iOS distortion bug previously. Wait for a
// real voice list (bounded by a timeout so we never hang forever) before the
// very first utterance.
function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([]);
  if (cachedVoices.length > 0) return Promise.resolve(cachedVoices);

  if (!voicesReadyPromise) {
    voicesReadyPromise = new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const immediate = synth.getVoices();
      if (immediate.length > 0) {
        cachedVoices = immediate;
        resolve(immediate);
        return;
      }

      const onVoicesChanged = () => {
        const voices = synth.getVoices();
        if (voices.length > 0) {
          cachedVoices = voices;
          synth.removeEventListener('voiceschanged', onVoicesChanged);
          clearTimeout(timeoutId);
          resolve(voices);
        }
      };
      synth.addEventListener('voiceschanged', onVoicesChanged);

      const timeoutId = setTimeout(() => {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(synth.getVoices());
      }, 1000);
    });
  }
  return voicesReadyPromise;
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
  // "Enhanced" is the more mature, better-supported tier through the Web Speech
  // API bridge on iOS/Safari — "Premium" (newer, on-device neural) has known
  // playback-corruption bugs through that same bridge for some voices/devices,
  // so it's ranked below Enhanced rather than above it.
  if (/enhanced/.test(haystack)) score += 12;
  if (/premium|natural|neural/.test(haystack)) score += 10;
  if (/compact/.test(haystack)) score -= 5; // iOS's lowest-quality tier
  if (/eloquence/.test(haystack)) score -= 10; // notably robotic legacy engine
  if (voice.lang === 'en-US') score += 3;
  else if (voice.lang.startsWith('en')) score += 1;
  if (!voice.localService) score += 1; // cloud voices (e.g. Edge's neural voices) tend to sound better
  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;

  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;

  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

async function speakText(text: string, standardVoiceRate: number) {
  const synth = window.speechSynthesis;
  const voices = await waitForVoices();

  function doSpeak() {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;

    const voice = pickBestVoice(voices);
    if (voice) {
      utterance.voice = voice;
      // High-quality voices distort at non-native rates (see isHighQualityVoice) —
      // only slow down the older standard/compact voices, which tolerate it fine.
      utterance.rate = isHighQualityVoice(voice) ? 1 : standardVoiceRate;
    } else {
      utterance.rate = standardVoiceRate;
    }

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
  void speakText(word, 0.85);
}

export function spellOutWord(word: string) {
  if (!isSpeechSupported()) return;
  const letters = word.split('').join(', ');
  void speakText(letters, 0.7);
}

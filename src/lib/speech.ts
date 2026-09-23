import { syllabify } from './phonetics';
import { getAccessibilitySettings } from './accessibility';

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

// Apple's built-in "novelty" voices (Settings > Accessibility > Spoken Content
// > Voices > Novelty) are deliberately distorted for comedic effect (a goat
// bleat, a robot, an organ...). On devices with a large voice list installed,
// our scoring could tie with or lose to one of these — exclude them outright
// so a spelling app never accidentally reads words in a bleating goat voice.
const NOVELTY_VOICE_NAMES = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
  'wobble', 'deranged', 'good news', 'hysterical', 'pipe organ', 'trinoids',
  'whisper', 'zarvox', 'jester', 'organ', 'superstar', 'kathy', 'ralph',
  'fred', 'junior', 'princess',
];

function isNoveltyVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  return NOVELTY_VOICE_NAMES.some((novelty) => name === novelty || name.startsWith(`${novelty} `));
}

// Apple's Eloquence voices (Eddy, Flo, Grandma, Grandpa, Reed, Rocko,
// Sandy, Shelley) are a robotic legacy engine that mangles many words.
// Some iOS versions don't put "eloquence" in the voiceURI, so match by name
// too - names are either bare ("Eddy") or localized ("Eddy (English (US))").
const ELOQUENCE_VOICE_NAMES = ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'];

function isEloquenceVoice(voice: SpeechSynthesisVoice): boolean {
  if (/eloquence/.test(voiceHaystack(voice))) return true;
  const name = voice.name.toLowerCase();
  return ELOQUENCE_VOICE_NAMES.some((eloquence) => name === eloquence || name.startsWith(`${eloquence} `));
}

// iOS Premium/Enhanced voices distort badly ("croaking") when spoken at anything
// other than their native rate — only the older standard/compact voices tolerate
// being slowed down cleanly.
function isHighQualityVoice(voice: SpeechSynthesisVoice): boolean {
  return /premium|enhanced|natural|neural/.test(voiceHaystack(voice));
}

// Normalizes "en_US" (Android) and "en-us" to "en-US".
function voiceLang(voice: SpeechSynthesisVoice): string {
  const [language = '', region = ''] = voice.lang.replace('_', '-').split('-');
  return region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase();
}

// Accent comes first: these are American spelling lists, and an Enhanced
// British/Indian/Australian voice was outranking the standard US voice
// whenever no US Enhanced voice was installed (e.g. after an iPadOS update
// drops downloaded voices) - words came out in an accent the kids couldn't
// always make out.
function localeRank(voice: SpeechSynthesisVoice): number {
  const lang = voiceLang(voice);
  if (lang === 'en-US') return 2;
  if (lang.startsWith('en')) return 1;
  return 0;
}

// Apple's tiers, best to worst: Premium (neural) > Enhanced > default >
// Compact. Edge/Chrome "Natural"/"Neural" voices rank with Premium.
function qualityTier(voice: SpeechSynthesisVoice): number {
  const haystack = voiceHaystack(voice);
  if (/premium|natural|neural/.test(haystack)) return 3;
  if (/enhanced/.test(haystack)) return 2;
  if (/compact/.test(haystack)) return 0;
  return 1;
}

// Within a tier, Apple's clearest US voices, best first. Anything else
// ranks after these.
const PREFERRED_VOICE_NAMES = ['ava', 'samantha', 'zoe', 'evan', 'nathan', 'allison', 'susan', 'tom', 'joelle', 'noelle', 'alex'];

function preferredNameRank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const index = PREFERRED_VOICE_NAMES.findIndex((preferred) => name === preferred || name.startsWith(`${preferred} `));
  return index === -1 ? PREFERRED_VOICE_NAMES.length : index;
}

function compareVoices(a: SpeechSynthesisVoice, b: SpeechSynthesisVoice): number {
  return (
    localeRank(b) - localeRank(a) ||
    qualityTier(b) - qualityTier(a) ||
    preferredNameRank(a) - preferredNameRank(b) ||
    // On-device before cloud: a cloud voice needs network to synthesize
    // speech, which risks a session going silent on flaky school Wi-Fi.
    Number(b.localService) - Number(a.localService)
  );
}

function rankVoices(): SpeechSynthesisVoice[] {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  const usable = voices.filter((v) => !isNoveltyVoice(v) && !isEloquenceVoice(v));
  return [...(usable.length ? usable : voices)].sort(compareVoices);
}

// No manual voice override: letting a user pick a specific non-default voice
// was confirmed to cause the same distortion the novelty-voice fix solved —
// on the one real device this was tested on, *every* explicitly-selected
// voice other than whatever the auto-pick lands on came out garbled. Rather
// than chase that further blind, auto-pick is now the only path.
function pickBestVoice(): SpeechSynthesisVoice | undefined {
  return rankVoices()[0];
}

export interface SpeechDebugInfo {
  text: string;
  voiceName: string | null;
  voiceURI: string | null;
  isHighQuality: boolean | null;
  rate: number;
  voiceCount: number;
  topCandidates: string[];
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
    // The user-adjustable rate control only ever applies to standard/compact
    // voices. High-quality voices stay hardcoded to their native rate (1) no
    // matter what the slider says — overriding that is exactly what caused
    // the iOS distortion bug fixed earlier, and this preference control must
    // never be allowed to reintroduce it.
    const { rateMultiplier } = getAccessibilitySettings();
    const rate = voice
      ? isHighQualityVoice(voice)
        ? 1
        : standardVoiceRate * rateMultiplier
      : standardVoiceRate * rateMultiplier;
    if (voice) {
      utterance.voice = voice;
      // iOS Safari can ignore .voice (and read with the system default)
      // unless .lang matches it.
      utterance.lang = voice.lang;
    }
    utterance.rate = rate;

    lastDebugInfo = {
      text,
      voiceName: voice?.name ?? null,
      voiceURI: voice?.voiceURI ?? null,
      isHighQuality: voice ? isHighQualityVoice(voice) : null,
      rate,
      voiceCount: (cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()).length,
      topCandidates: rankVoices()
        .slice(0, 5)
        .map((v) => `${v.name} [${v.lang}] ${v.voiceURI}`),
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

// The classic spelling-test format ("word. sentence. word.") - particularly
// valuable for homophones (their/there/they're) where the word alone is
// ambiguous. sentence is optional; falls back to just the word.
export function speakWord(word: string, sentence?: string) {
  if (!isSpeechSupported()) return;
  const text = sentence ? `${word}. ${sentence} ${word}.` : word;
  speakText(text, 0.85);
}

export function spellOutWord(word: string) {
  if (!isSpeechSupported()) return;
  const letters = word.split('').join(', ');
  speakText(letters, 0.7);
}

export function soundOutWord(word: string) {
  if (!isSpeechSupported()) return;
  const chunks = syllabify(word).join(', ');
  speakText(chunks, 0.75);
}

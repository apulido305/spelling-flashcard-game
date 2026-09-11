import { loadJSON, saveJSON } from './storage';

export interface AccessibilitySettings {
  rateMultiplier: number; // 0.5 - 1.5, applied to standard-tier voices only
  largeText: boolean;
  highContrast: boolean;
  dyslexiaFont: boolean;
}

const KEY = 'accessibilitySettings';

const DEFAULTS: AccessibilitySettings = {
  rateMultiplier: 1,
  largeText: false,
  highContrast: false,
  dyslexiaFont: false,
};

// Deliberately its own storage key, separate from the session blob - these
// are device/user preferences that should survive "New List" resets, not
// get wiped along with the current word list and game progress.
export function getAccessibilitySettings(): AccessibilitySettings {
  return { ...DEFAULTS, ...loadJSON<Partial<AccessibilitySettings>>(KEY, {}) };
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  saveJSON(KEY, settings);
}

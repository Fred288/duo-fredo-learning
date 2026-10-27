// Sprachausgabe hinter einem Interface: Web Speech heute, Aufnahmen oder Fakes austauschbar.

/**
 * loading: Stimmen werden noch geladen (asynchron, iOS ohne zuverlässiges Ereignis).
 * no-voice: keine türkische Stimme installiert. offline-only-remote: nur Netzstimmen, gerade offline.
 * unsupported: Browser ohne speechSynthesis.
 */
export type VoiceStatus = 'loading' | 'ready' | 'no-voice' | 'offline-only-remote' | 'unsupported';

export type Rate = 'normal' | 'slow';

/** Sprechtempo für speechSynthesis; 1 ist für Lernende zu schnell. */
export const SPEECH_RATE: Record<Rate, number> = { normal: 0.9, slow: 0.6 };

/** Wiedergabetempo von Aufnahmen; stärker verlangsamt klingt verzerrt. */
export const PLAYBACK_RATE: Record<Rate, number> = { normal: 1, slow: 0.75 };

/** Unabhängig von SpeechSynthesisVoice, damit Auswahl und Tests ohne Browser laufen. */
export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface Speaker {
  status(): VoiceStatus;
  /** Türkische Stimmen, beste zuerst. */
  voices(): VoiceInfo[];
  /** Gewählte Stimme oder undefined für automatisch. */
  current(): VoiceInfo | undefined;
  setPreferred(voiceURI: string): void;
  /** Spricht türkischen Text; löst nach dem Ende auf, ohne bereite Stimme sofort. Bricht Laufendes ab. */
  speak(text: string, rate?: Rate): Promise<void>;
  cancel(): void;
  /** Meldet Änderungen an Status oder Stimmen. */
  subscribe(listener: () => void): () => void;
}

export const canSpeak = (status: VoiceStatus): boolean => status === 'ready';

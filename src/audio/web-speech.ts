import { SPEECH_RATE, type Rate, type Speaker, type VoiceInfo, type VoiceStatus } from './types';
import { pickVoice, turkishVoices } from './voice';

/** Teil von speechSynthesis, den der Speaker braucht (im Test gefälscht). */
export interface SynthLike {
  getVoices(): SpeechSynthesisVoice[];
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener?(type: 'voiceschanged', fn: () => void): void;
}

export interface WebSpeechDeps {
  synth?: SynthLike;
  Utterance?: typeof SpeechSynthesisUtterance;
  online?: () => boolean;
  /** Meldet online/offline-Wechsel; Rückgabe meldet ab. */
  onConnectivity?: (fn: () => void) => void;
  /** iOS feuert voiceschanged nicht zuverlässig: so lange nachfragen, dann gilt das Ergebnis. */
  pollMs?: number;
  pollFor?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

const info = (v: SpeechSynthesisVoice): VoiceInfo => ({
  voiceURI: v.voiceURI,
  name: v.name,
  lang: v.lang,
  localService: v.localService,
  default: v.default,
});

// Chrome verwirft Utterances ohne Referenz vor onend (GC); die laufende bleibt hier.
let speaking: SpeechSynthesisUtterance | undefined;

/** Speaker über die Web Speech API, Sprache tr-TR. Ohne speechSynthesis: Status unsupported. */
export function createWebSpeechSpeaker(deps: WebSpeechDeps = defaultDeps()): Speaker {
  const {
    synth,
    Utterance,
    online = () => true,
    pollMs = 250,
    pollFor = 3000,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  } = deps;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  let native: SpeechSynthesisVoice[] = [];
  let settled = false;
  let preferredURI = '';

  const voices = () => turkishVoices(native.map(info));
  const choice = () => pickVoice(native.map(info), { preferredURI, online: online() });
  const status = (): VoiceStatus => {
    if (!synth || !Utterance) return 'unsupported';
    const c = choice();
    // Bis die Stimmen da sind oder die Wartezeit um ist, nicht vorschnell „keine Stimme“ melden.
    return c.status === 'no-voice' && !settled ? 'loading' : c.status;
  };

  const refresh = () => {
    if (!synth) return;
    native = synth.getVoices();
    if (voices().length) settled = true;
    emit();
  };

  if (synth && Utterance) {
    synth.addEventListener?.('voiceschanged', refresh);
    deps.onConnectivity?.(emit);
    refresh();
    let waited = 0;
    const poll = () => {
      if (settled) return;
      waited += pollMs;
      refresh();
      if (waited >= pollFor) {
        settled = true;
        emit();
      } else {
        setTimer(poll, pollMs);
      }
    };
    if (!settled) setTimer(poll, pollMs);
  }

  return {
    status,
    voices,
    current: () => choice().voice,
    setPreferred(uri) {
      preferredURI = uri;
      emit();
    },
    speak(text, rate: Rate = 'normal') {
      const voice = choice().voice;
      if (!synth || !Utterance || status() !== 'ready' || !voice) return Promise.resolve();
      synth.cancel();
      const u = new Utterance(text);
      u.lang = 'tr-TR';
      u.voice = native.find((v) => v.voiceURI === voice.voiceURI) ?? null;
      u.rate = SPEECH_RATE[rate];
      speaking = u;
      return new Promise<void>((resolve) => {
        // Manche Engines melden nie onend: spätestens nach großzügiger Schätzung auflösen.
        const timer = setTimer(done, 2000 + (text.length * 150) / u.rate);
        function done() {
          clearTimer(timer);
          if (speaking === u) speaking = undefined;
          resolve();
        }
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
      });
    },
    cancel() {
      synth?.cancel();
      speaking = undefined;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function defaultDeps(): WebSpeechDeps {
  if (typeof window === 'undefined') return {};
  return {
    synth: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
    online: () => navigator.onLine,
    onConnectivity: (fn) => {
      window.addEventListener('online', fn);
      window.addEventListener('offline', fn);
    },
  };
}

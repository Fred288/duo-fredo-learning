import type { Rate, Speaker, VoiceInfo, VoiceStatus } from './types';

export const FAKE_VOICE: VoiceInfo = {
  voiceURI: 'fake-tr',
  name: 'Test Türkçe',
  lang: 'tr-TR',
  localService: true,
  default: true,
};

/** Speaker für Tests: zeichnet Gesprochenes auf, Status ist steuerbar. */
export class FakeSpeaker implements Speaker {
  spoken: { text: string; rate: Rate }[] = [];
  cancelled = 0;
  private state: VoiceStatus;
  private listeners = new Set<() => void>();
  private preferred = '';

  constructor(status: VoiceStatus = 'ready') {
    this.state = status;
  }

  setStatus(status: VoiceStatus) {
    this.state = status;
    this.listeners.forEach((fn) => fn());
  }

  status = () => this.state;
  voices = () => (this.state === 'ready' ? [FAKE_VOICE] : []);
  current = () => (this.state === 'ready' ? FAKE_VOICE : undefined);
  setPreferred = (uri: string) => {
    this.preferred = uri;
  };
  preferredURI = () => this.preferred;

  speak = (text: string, rate: Rate = 'normal') => {
    if (this.state === 'ready') this.spoken.push({ text, rate });
    return Promise.resolve();
  };

  cancel = () => {
    this.cancelled++;
  };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
}

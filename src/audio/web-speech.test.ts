import { describe, expect, it, vi } from 'vitest';
import type { SynthLike } from './web-speech';
import { createWebSpeechSpeaker } from './web-speech';

class FakeUtterance {
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
const Utterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;

const nativeVoice = (name: string, lang: string, localService = true) =>
  ({ voiceURI: name, name, lang, localService, default: false }) as SpeechSynthesisVoice;

function fakeSynth(initial: SpeechSynthesisVoice[] = []) {
  let voices = initial;
  let onChange: (() => void) | undefined;
  const spoken: FakeUtterance[] = [];
  const synth = {
    getVoices: () => voices,
    speak: (u: SpeechSynthesisUtterance) => spoken.push(u as unknown as FakeUtterance),
    cancel: vi.fn(),
    addEventListener: (_type: 'voiceschanged', fn: () => void) => {
      onChange = fn;
    },
    setVoices(v: SpeechSynthesisVoice[], fire = true) {
      voices = v;
      if (fire) onChange?.();
    },
  } satisfies SynthLike & Record<string, unknown>;
  return { synth, spoken };
}

/** Manuelle Timer, damit Nachfragen (iOS) und Sicherheits-Timeout deterministisch laufen. */
function timers() {
  const queue: (() => void)[] = [];
  return {
    setTimer: (fn: () => void) => queue.push(fn),
    clearTimer: () => {},
    tick: () => queue.splice(0).forEach((fn) => fn()),
  };
}

describe('Web-Speech-Speaker', () => {
  it('ohne speechSynthesis: unsupported, speak löst sofort auf', async () => {
    const speaker = createWebSpeechSpeaker({});
    expect(speaker.status()).toBe('unsupported');
    await expect(speaker.speak('merhaba')).resolves.toBeUndefined();
  });

  it('Stimmen kommen asynchron über voiceschanged', () => {
    const { synth } = fakeSynth();
    const speaker = createWebSpeechSpeaker({ synth, Utterance, ...timers() });
    const seen = vi.fn();
    speaker.subscribe(seen);
    expect(speaker.status()).toBe('loading');
    synth.setVoices([nativeVoice('Yelda', 'tr-TR')]);
    expect(speaker.status()).toBe('ready');
    expect(seen).toHaveBeenCalled();
  });

  it('ohne Ereignis (iOS) findet das Nachfragen die Stimmen', () => {
    const { synth } = fakeSynth();
    const t = timers();
    const speaker = createWebSpeechSpeaker({ synth, Utterance, pollMs: 100, pollFor: 300, ...t });
    synth.setVoices([nativeVoice('Yelda', 'tr-TR')], false);
    t.tick();
    expect(speaker.status()).toBe('ready');
  });

  it('nach der Wartezeit ohne türkische Stimme: no-voice', () => {
    const { synth } = fakeSynth([nativeVoice('Anna', 'de-DE')]);
    const t = timers();
    const speaker = createWebSpeechSpeaker({ synth, Utterance, pollMs: 100, pollFor: 300, ...t });
    t.tick();
    t.tick();
    expect(speaker.status()).toBe('loading');
    t.tick();
    expect(speaker.status()).toBe('no-voice');
  });

  it('spricht tr-TR mit Stimme und Tempo, bricht vorher ab', async () => {
    const { synth, spoken } = fakeSynth([nativeVoice('Yelda', 'tr-TR')]);
    const speaker = createWebSpeechSpeaker({ synth, Utterance, ...timers() });
    const done = speaker.speak('Bir çay lütfen.', 'slow');
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
    const u = spoken[0]!;
    expect([u.text, u.lang, u.voice?.name, u.rate]).toEqual([
      'Bir çay lütfen.',
      'tr-TR',
      'Yelda',
      0.6,
    ]);
    u.onend?.();
    await expect(done).resolves.toBeUndefined();
  });

  it('löst auch bei Fehler oder ohne onend auf', async () => {
    const { synth, spoken } = fakeSynth([nativeVoice('Yelda', 'tr-TR')]);
    const t = timers();
    const speaker = createWebSpeechSpeaker({ synth, Utterance, ...t });
    const failed = speaker.speak('a');
    spoken[0]!.onerror?.();
    await expect(failed).resolves.toBeUndefined();
    const silent = speaker.speak('b');
    t.tick();
    await expect(silent).resolves.toBeUndefined();
  });

  it('offline mit nur Netzstimme: offline-only-remote, kein Sprechen', async () => {
    const { synth, spoken } = fakeSynth([nativeVoice('Google Türkçe', 'tr-TR', false)]);
    let online = false;
    let notify = () => {};
    const speaker = createWebSpeechSpeaker({
      synth,
      Utterance,
      online: () => online,
      onConnectivity: (fn) => (notify = fn),
      ...timers(),
    });
    expect(speaker.status()).toBe('offline-only-remote');
    await speaker.speak('merhaba');
    expect(spoken).toHaveLength(0);
    online = true;
    notify();
    expect(speaker.status()).toBe('ready');
  });

  it('gewählte Stimme gilt beim Sprechen', () => {
    const { synth, spoken } = fakeSynth([
      nativeVoice('Cem', 'tr-TR'),
      nativeVoice('Yelda', 'tr_TR'),
    ]);
    const speaker = createWebSpeechSpeaker({ synth, Utterance, ...timers() });
    expect(speaker.voices().map((v) => v.name)).toEqual(['Cem', 'Yelda']);
    speaker.setPreferred('Yelda');
    void speaker.speak('merhaba');
    expect(spoken[0]!.voice?.name).toBe('Yelda');
    expect(speaker.current()?.name).toBe('Yelda');
  });
});

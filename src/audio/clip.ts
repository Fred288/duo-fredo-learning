import type { Vocab } from '../content/schema';
import { trLower } from '../lib/turkish';
import { PLAYBACK_RATE, type Rate, type Speaker } from './types';

/**
 * Was abgespielt wird. Heute immer TTS; sobald eine Vokabel eine Aufnahme (`audio`) hat,
 * spielt die Datei. Synthetisch ist TTS immer, eine Datei laut `audio_synthetic`.
 */
export type Clip =
  | { kind: 'file'; url: string; text: string; synthetic: boolean }
  | { kind: 'tts'; text: string; synthetic: true };

/** Aufnahmen nach türkischem Text (klein, NFC). */
export function audioIndex(vocab: readonly Vocab[]): Map<string, Vocab> {
  return new Map(vocab.filter((v) => v.audio).map((v) => [trLower(v.tr), v]));
}

/** `base` ist die Basis der Audiodateien, z. B. `${BASE_URL}audio/`. */
export function resolveClip(
  text: string,
  recordings: ReadonlyMap<string, Vocab> = new Map(),
  base = 'audio/',
): Clip {
  const v = recordings.get(trLower(text));
  if (v?.audio) return { kind: 'file', url: base + v.audio, text, synthetic: !!v.audio_synthetic };
  return { kind: 'tts', text, synthetic: true };
}

export interface PlayDeps {
  speaker: Speaker;
  playFile?: (url: string, playbackRate: number) => Promise<void>;
}

let playing: { audio: HTMLAudioElement; done: () => void } | undefined;

/** Bricht eine laufende Aufnahme ab (TTS bricht der Speaker selbst ab). */
export function stopClips(): void {
  playing?.audio.pause();
  playing?.done();
}

const playWithAudioElement = (url: string, playbackRate: number) =>
  new Promise<void>((resolve, reject) => {
    stopClips();
    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    const done = () => {
      if (playing?.audio === audio) playing = undefined;
      resolve();
    };
    playing = { audio, done };
    audio.onended = done;
    audio.onerror = () => {
      if (playing?.audio === audio) playing = undefined;
      reject(new Error(`Audio ${url}`));
    };
    audio.play().catch(reject);
  });

/** Spielt einen Clip; eine fehlende oder kaputte Datei fällt auf TTS zurück. */
export async function playClip(
  clip: Clip,
  rate: Rate,
  { speaker, playFile = playWithAudioElement }: PlayDeps,
): Promise<void> {
  speaker.cancel();
  stopClips();
  if (clip.kind === 'file') {
    try {
      return await playFile(clip.url, PLAYBACK_RATE[rate]);
    } catch {
      // weiter mit TTS
    }
  }
  return speaker.speak(clip.text, rate);
}

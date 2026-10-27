import { describe, expect, it, vi } from 'vitest';
import type { Vocab } from '../content/schema';
import { audioIndex, playClip, resolveClip } from './clip';
import { FakeSpeaker } from './fake';

const ev: Vocab = { tr: 'ev', de: ['Haus'], pos: 'noun', audio: 'ev.mp3' };
const kedi: Vocab = {
  tr: 'kedi',
  de: ['Katze'],
  pos: 'noun',
  audio: 'kedi.mp3',
  audio_synthetic: true,
};

describe('Audio-Quelle', () => {
  it('ohne Aufnahme: TTS, immer synthetisch', () => {
    expect(resolveClip('merhaba')).toEqual({ kind: 'tts', text: 'merhaba', synthetic: true });
  });

  it('mit Aufnahme: Datei, synthetisch laut Vokabel', () => {
    const index = audioIndex([ev, kedi, { tr: 'su', de: ['Wasser'], pos: 'noun' }]);
    expect([...index.keys()]).toEqual(['ev', 'kedi']);
    expect(resolveClip('Ev', index, '/audio/')).toEqual({
      kind: 'file',
      url: '/audio/ev.mp3',
      text: 'Ev',
      synthetic: false,
    });
    expect(resolveClip('kedi', index)).toMatchObject({ kind: 'file', synthetic: true });
  });

  it('spielt TTS über den Speaker', async () => {
    const speaker = new FakeSpeaker();
    await playClip(resolveClip('merhaba'), 'slow', { speaker });
    expect(speaker.spoken).toEqual([{ text: 'merhaba', rate: 'slow' }]);
  });

  it('spielt Dateien langsamer und fällt bei Fehler auf TTS zurück', async () => {
    const speaker = new FakeSpeaker();
    const clip = resolveClip('ev', audioIndex([ev]));
    const playFile = vi.fn().mockResolvedValue(undefined);
    await playClip(clip, 'slow', { speaker, playFile });
    expect(playFile).toHaveBeenCalledWith('audio/ev.mp3', 0.75);
    expect(speaker.spoken).toEqual([]);

    await playClip(clip, 'normal', { speaker, playFile: vi.fn().mockRejectedValue(new Error()) });
    expect(speaker.spoken).toEqual([{ text: 'ev', rate: 'normal' }]);
  });
});

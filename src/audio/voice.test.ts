import { describe, expect, it } from 'vitest';
import type { VoiceInfo } from './types';
import { isTurkishVoice, pickVoice, turkishVoices } from './voice';

const voice = (over: Partial<VoiceInfo>): VoiceInfo => ({
  voiceURI: over.name ?? 'v',
  name: 'v',
  lang: 'tr-TR',
  localService: true,
  default: false,
  ...over,
});

describe('Stimmenwahl', () => {
  it('erkennt tr-TR, tr_TR und tr, aber nicht tk oder de', () => {
    expect(['tr-TR', 'tr_TR', 'tr', 'TR-tr'].every((lang) => isTurkishVoice({ lang }))).toBe(true);
    expect(['tk-TM', 'de-DE', 'tru'].some((lang) => isTurkishVoice({ lang }))).toBe(false);
  });

  it('ordnet lokale vor Netzstimmen, dann Standard, dann Name', () => {
    const list = turkishVoices([
      voice({ name: 'Google Türkçe', localService: false }),
      voice({ name: 'Yelda' }),
      voice({ name: 'Anna', lang: 'de-DE' }),
      voice({ name: 'Cem', default: true }),
    ]);
    expect(list.map((v) => v.name)).toEqual(['Cem', 'Yelda', 'Google Türkçe']);
  });

  it('nimmt die gewünschte Stimme, sonst die beste', () => {
    const voices = [voice({ name: 'Yelda' }), voice({ name: 'Cem' })];
    expect(pickVoice(voices, { preferredURI: 'Yelda' }).voice?.name).toBe('Yelda');
    expect(pickVoice(voices, { preferredURI: 'weg' }).voice?.name).toBe('Cem');
    expect(pickVoice(voices).status).toBe('ready');
  });

  it('ohne türkische Stimme: no-voice', () => {
    expect(pickVoice([voice({ lang: 'de-DE' })])).toEqual({ status: 'no-voice' });
  });

  it('offline nur lokale Stimmen; gibt es nur Netzstimmen, offline-only-remote', () => {
    const remote = voice({ name: 'Google Türkçe', localService: false });
    const local = voice({ name: 'Yelda' });
    expect(pickVoice([remote], { online: false })).toEqual({ status: 'offline-only-remote' });
    expect(pickVoice([remote, local], { online: false, preferredURI: remote.voiceURI }).voice).toBe(
      local,
    );
    expect(pickVoice([remote], { online: true }).voice).toBe(remote);
  });
});

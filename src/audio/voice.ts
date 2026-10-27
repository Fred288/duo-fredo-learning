import type { VoiceInfo, VoiceStatus } from './types';

/** tr-TR, tr_TR (ältere Android-Versionen) und tr. */
export const isTurkishVoice = (v: Pick<VoiceInfo, 'lang'>): boolean =>
  /^tr(?:[-_]|$)/i.test(v.lang);

/** Türkische Stimmen: lokale zuerst (laufen offline), dann Standardstimme, dann nach Name. */
export function turkishVoices(voices: readonly VoiceInfo[]): VoiceInfo[] {
  return voices
    .filter(isTurkishVoice)
    .sort(
      (a, b) =>
        Number(b.localService) - Number(a.localService) ||
        Number(b.default) - Number(a.default) ||
        a.name.localeCompare(b.name),
    );
}

export interface VoiceChoice {
  voice?: VoiceInfo;
  status: Exclude<VoiceStatus, 'loading' | 'unsupported'>;
}

/**
 * Wählt die Stimme: gewünschte, sonst die beste. Offline kommen nur lokale Stimmen in Frage
 * (Netzstimmen wie „Google Türkçe“ im Desktop-Chrome schweigen dann).
 */
export function pickVoice(
  voices: readonly VoiceInfo[],
  { preferredURI = '', online = true }: { preferredURI?: string; online?: boolean } = {},
): VoiceChoice {
  const all = turkishVoices(voices);
  if (!all.length) return { status: 'no-voice' };
  const usable = online ? all : all.filter((v) => v.localService);
  if (!usable.length) return { status: 'offline-only-remote' };
  const preferred = usable.find((v) => v.voiceURI === preferredURI);
  return { voice: preferred ?? usable[0], status: 'ready' };
}

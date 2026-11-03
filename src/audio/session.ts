/**
 * Audio-Sitzung von Safari (`navigator.audioSession`, ab iOS 16.4). „playback“ spielt auch im
 * Stummmodus, schaltet aber laufende Musik anderer Apps leise; „auto“ überlässt iOS die Wahl
 * (nötig fürs Mikrofon). Andere Browser kennen sie nicht: dann passiert nichts.
 */
type SessionType = 'auto' | 'playback';

interface AudioSessionLike {
  type: string;
}

const session = (): AudioSessionLike | undefined =>
  typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;

export function setAudioSession(type: SessionType): void {
  const s = session();
  if (!s || s.type === type) return;
  try {
    s.type = type;
  } catch {
    // Unbekannter Typ oder gesperrt: Standardverhalten bleibt.
  }
}

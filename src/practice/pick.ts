import type { Manifest } from '../content/load';

// Übungstext nach der Lektion wählen (rein, Zufall hineingereicht). Kandidaten sind die Texte
// der aktuellen Unit und der Units davor im selben Niveau; zuletzt gelesene kommen erst dran,
// wenn sonst nichts übrig ist, dann der am längsten nicht gelesene.

/** Aktuelle Unit und so viele davor (im selben Niveau). */
export const PICK_UNITS = 3;
/** So viele zuletzt gelesene Texte merkt sich `practiceRecent`. */
export const RECENT_MAX = 5;

export interface TextRef {
  unitId: string;
  id: string;
  title: string;
}

type Units = Manifest['units'];

/** Texte der aktuellen Unit und der `PICK_UNITS - 1` Units davor im selben Niveau. */
export function textCandidates(units: Units, unitId: string): TextRef[] {
  const at = units.findIndex((u) => u.id === unitId);
  if (at < 0) return [];
  const level = units[at]!.level;
  const out: TextRef[] = [];
  for (let i = at; i >= 0 && i > at - PICK_UNITS; i--) {
    const u = units[i]!;
    if (u.level !== level) break;
    for (const t of u.texts ?? []) out.push({ unitId: u.id, id: t.id, title: t.title });
  }
  return out;
}

/** Zufälliger ungelesener Text, sonst der am längsten nicht gelesene; undefined = keiner. */
export function pickText(
  units: Units,
  unitId: string,
  recent: readonly string[],
  rand: () => number = Math.random,
): TextRef | undefined {
  const candidates = textCandidates(units, unitId);
  const fresh = candidates.filter((t) => !recent.includes(t.id));
  if (fresh.length) return fresh[Math.floor(rand() * fresh.length)];
  // Alle zuletzt gelesen: der, der in `recent` am weitesten hinten steht.
  return candidates.reduce<TextRef | undefined>(
    (a, b) => (!a || recent.indexOf(b.id) > recent.indexOf(a.id) ? b : a),
    undefined,
  );
}

/** `recent` nach dem Lesen von `id`: vorn, ohne Dublette, höchstens `RECENT_MAX`. */
export function rememberText(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_MAX);
}

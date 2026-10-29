import type { Verdict } from '../lib/answer';
import type { PlacementItem, PlacementPlan, PlacementUnit } from './select';

// Ablauf des Einstufungstests als reine Zustandsmaschine: Niveau für Niveau, je Unit eine
// Probe; nur nach einem Fehler eine Bestätigung. Keine Punkte, nur ein Stand je Unit.

/** sicher = Probe richtig; wackelig = Probe falsch, Bestätigung richtig; unsicher = beide falsch. */
export type UnitStatus = 'secure' | 'shaky' | 'unsure';

/** Antwort einer Aufgabe; `unknown` = „Weiß ich nicht“. */
export type Outcome = Verdict | 'unknown';

/** Anteil der Units, die sicher oder wackelig sein müssen, damit das nächste Niveau folgt. */
export const MASTERY = 0.8;

export interface PlacementState {
  level: number;
  unit: number;
  /** 0 = Probe, 1 = Bestätigung. */
  step: 0 | 1;
  /** Stand der geprüften Units; ungeprüfte fehlen. */
  statuses: Readonly<Record<string, UnitStatus>>;
  done: boolean;
}

export interface CurrentItem {
  level: PlacementPlan['levels'][number]['level'];
  unit: PlacementUnit;
  item: PlacementItem;
  /** Position der Unit im Niveau (ab 1) und Zahl der Units des Niveaus, für die Anzeige. */
  position: number;
  total: number;
}

/** Erlaubte unsichere Units je Niveau, bevor das Niveau nicht mehr beherrscht sein kann. */
export const allowedMisses = (units: number): number => units - Math.ceil(units * MASTERY);

export function startPlacement(plan: PlacementPlan): PlacementState {
  const empty = !plan.levels.some((l) => l.units.length > 0);
  return { level: firstLevel(plan, 0), unit: 0, step: 0, statuses: {}, done: empty };
}

/** Nächstes Niveau ab `from` mit mindestens einer Unit (Index hinter dem Ende = keins mehr). */
function firstLevel(plan: PlacementPlan, from: number): number {
  let i = from;
  while (i < plan.levels.length && plan.levels[i]!.units.length === 0) i++;
  return i;
}

export function currentItem(plan: PlacementPlan, s: PlacementState): CurrentItem | undefined {
  if (s.done) return undefined;
  const level = plan.levels[s.level];
  const unit = level?.units[s.unit];
  const item = unit?.items[s.step];
  if (!level || !unit || !item) return undefined;
  return { level: level.level, unit, item, position: s.unit + 1, total: level.units.length };
}

const right = (o: Outcome) => o === 'correct' || o === 'almost';

/** Wertet die Antwort auf die aktuelle Aufgabe aus und geht weiter. */
export function answer(plan: PlacementPlan, s: PlacementState, outcome: Outcome): PlacementState {
  const cur = currentItem(plan, s);
  if (!cur) return s;
  const { unitId, items } = cur.unit;
  if (s.step === 0 && !right(outcome) && items.length > 1) return { ...s, step: 1 };
  const status: UnitStatus = right(outcome) ? (s.step === 0 ? 'secure' : 'shaky') : 'unsure';
  const statuses = { ...s.statuses, [unitId]: status };

  const units = plan.levels[s.level]!.units;
  const misses = units.filter((u) => statuses[u.unitId] === 'unsure').length;
  // Ist das Niveau nicht mehr zu schaffen, endet der Test hier; Restliches bleibt ungeprüft.
  if (misses > allowedMisses(units.length)) return { ...s, statuses, done: true };
  if (s.unit + 1 < units.length) return { ...s, unit: s.unit + 1, step: 0, statuses };
  const level = firstLevel(plan, s.level + 1);
  return { level, unit: 0, step: 0, statuses, done: level >= plan.levels.length };
}

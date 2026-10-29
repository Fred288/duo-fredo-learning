import { allowedMisses, type UnitStatus } from './flow';
import type { PlacementPlan } from './select';

export interface UnitResult {
  unitId: string;
  title: string;
  /** Thema der Probe-Aufgabe (Lektionstitel). */
  topic: string;
  /** Fehlt bei ungeprüften Units. */
  status?: UnitStatus;
}

export interface Recommendation {
  /** Empfohlene Start-Unit; null = alles Geprüfte sitzt, kein weiterer Stoff. */
  startUnit: string | null;
  /** Sichere und wackelige Units vor dem Start: gelten als bekannt. */
  skipped: string[];
  /** Davon wackelig (Probe falsch, Bestätigung richtig). */
  shaky: string[];
  /** Unsichere Units vor dem Start, in beherrschten Niveaus: nicht übersprungen, zum Nachholen. */
  catchUp: string[];
  /** Alle Units in Kursreihenfolge mit Stand, für die Begründung. */
  units: UnitResult[];
}

/**
 * Empfehlung aus dem Teststand (rein). Endete der Test in einem Niveau, das nicht mehr zu
 * schaffen war, beginnt man dort bei der ersten unsicheren Unit; sonst bei der ersten
 * ungeprüften. Übersprungen wird nur, was vor dem Start liegt und sicher oder wackelig ist.
 */
export function recommend(
  plan: PlacementPlan,
  statuses: Readonly<Record<string, UnitStatus>>,
): Recommendation {
  const units: UnitResult[] = plan.levels.flatMap((l) =>
    l.units.map((u) => ({
      unitId: u.unitId,
      title: u.title,
      topic: u.items[0]?.topic ?? '',
      status: statuses[u.unitId],
    })),
  );
  const failed = plan.levels.find(
    (l) =>
      l.units.filter((u) => statuses[u.unitId] === 'unsure').length > allowedMisses(l.units.length),
  );
  const startUnit = failed
    ? (failed.units.find((u) => statuses[u.unitId] === 'unsure')?.unitId ?? null)
    : (units.find((u) => !u.status)?.unitId ?? null);
  const startAt = startUnit ? units.findIndex((u) => u.unitId === startUnit) : units.length;
  const before = units.slice(0, startAt);
  const known = before.filter((u) => u.status === 'secure' || u.status === 'shaky');
  return {
    startUnit,
    skipped: known.map((u) => u.unitId),
    shaky: known.filter((u) => u.status === 'shaky').map((u) => u.unitId),
    catchUp: before.filter((u) => u.status === 'unsure').map((u) => u.unitId),
    units,
  };
}

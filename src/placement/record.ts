// Gespeicherte Einstufung: angenommene Empfehlungen als Protokoll (Dexie `placements`, nur
// anhängen). Gültig ist die jüngste Zeile; „Zurücknehmen“ hängt eine leere an.

export interface Placement {
  at: number;
  /** Empfohlene Start-Unit; null = keine (alles sicher oder zurückgenommen). */
  startUnit: string | null;
  /** Units, die laut Einstufung bekannt sind. */
  skipped: string[];
  /** Davon wackelig. */
  shaky: string[];
}

/** Leere Einstufung („Zurücknehmen“). */
export const clearedPlacement = (at: number): Placement => ({
  at,
  startUnit: null,
  skipped: [],
  shaky: [],
});

/**
 * Jüngste Einstufung, undefined ohne Einstufung oder nach dem Zurücknehmen. Eine Rücknahme
 * erkennt man an `startUnit: null` ohne `skipped`; `recommend` liefert das nie (ohne Start ist
 * alles Geprüfte bekannt, ohne Übersprungenes gibt es einen Start), siehe Test dort.
 */
export function currentPlacement(rows: readonly Placement[]): Placement | undefined {
  let latest: Placement | undefined;
  for (const r of rows) if (!latest || r.at >= latest.at) latest = r;
  return latest && (latest.startUnit || latest.skipped.length) ? latest : undefined;
}

export type PlacementMark = 'skipped' | 'start';

/** Markierung einer Unit auf der Startseite und in der Statistik. */
export function placementMark(
  placement: Placement | undefined,
  unitId: string,
): PlacementMark | undefined {
  if (!placement) return undefined;
  if (placement.startUnit === unitId) return 'start';
  return placement.skipped.includes(unitId) ? 'skipped' : undefined;
}

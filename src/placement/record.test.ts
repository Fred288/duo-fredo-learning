import { describe, expect, it } from 'vitest';
import { clearedPlacement, currentPlacement, placementMark, type Placement } from './record';

const p = (at: number, startUnit: string | null, skipped: string[] = []): Placement => ({
  at,
  startUnit,
  skipped,
  shaky: [],
});

describe('currentPlacement', () => {
  it('nimmt die jüngste Zeile, unabhängig von der Reihenfolge', () => {
    const rows = [p(3, 'a2-u01', ['a1-u01']), p(1, 'a1-u05'), p(2, 'b1-u01')];
    expect(currentPlacement(rows)?.startUnit).toBe('a2-u01');
  });

  it('gilt nach dem Zurücknehmen als keine Einstufung', () => {
    expect(currentPlacement([p(1, 'a1-u05'), clearedPlacement(2)])).toBeUndefined();
    expect(currentPlacement([])).toBeUndefined();
  });

  it('„alles sicher“ (kein Start, aber Übersprungenes) bleibt gültig', () => {
    expect(currentPlacement([p(1, null, ['a1-u01'])])?.skipped).toEqual(['a1-u01']);
  });
});

describe('placementMark', () => {
  it('markiert Start und Übersprungenes, sonst nichts', () => {
    const cur = p(1, 'a1-u03', ['a1-u01', 'a1-u02']);
    expect(placementMark(cur, 'a1-u03')).toBe('start');
    expect(placementMark(cur, 'a1-u01')).toBe('skipped');
    expect(placementMark(cur, 'a1-u04')).toBeUndefined();
    expect(placementMark(undefined, 'a1-u01')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import type { Manifest } from '../content/load';
import { pickText, RECENT_MAX, rememberText, textCandidates } from './pick';

const u = (id: string, texts: string[] = []): Manifest['units'][number] => ({
  id,
  level: id.startsWith('a1') ? 'A1' : 'A2',
  title: id,
  unreviewed: 0,
  lessons: [],
  vocab: [],
  ...(texts.length && { texts: texts.map((t) => ({ id: `${id}-${t}`, title: t })) }),
});
const units = [
  u('a1-u01', ['t1']),
  u('a1-u02', ['t1', 't2']),
  u('a1-u03'),
  u('a1-u04', ['t1']),
  u('a2-u01', ['t1']),
];
const ids = (refs: { id: string }[]) => refs.map((r) => r.id);

describe('textCandidates', () => {
  it('aktuelle Unit und zwei davor, nicht über die Niveaugrenze', () => {
    expect(ids(textCandidates(units, 'a1-u04'))).toEqual([
      'a1-u04-t1',
      'a1-u02-t1',
      'a1-u02-t2',
    ]);
    expect(ids(textCandidates(units, 'a2-u01'))).toEqual(['a2-u01-t1']);
    expect(textCandidates(units, 'x')).toEqual([]);
  });
});

describe('pickText', () => {
  it('zufällig aus den ungelesenen', () => {
    expect(pickText(units, 'a1-u04', [], () => 0)?.id).toBe('a1-u04-t1');
    expect(pickText(units, 'a1-u04', ['a1-u04-t1'], () => 0.99)?.id).toBe('a1-u02-t2');
    expect(pickText(units, 'a1-u03', [], () => 0)?.unitId).toBe('a1-u02');
  });

  it('alles gelesen: der am längsten nicht gelesene; ohne Texte keiner', () => {
    expect(pickText(units, 'a1-u02', ['a1-u02-t2', 'a1-u01-t1', 'a1-u02-t1'])?.id).toBe(
      'a1-u02-t1',
    );
    expect(pickText([u('a1-u01')], 'a1-u01', [])).toBeUndefined();
  });

  it('rememberText: vorn, ohne Dublette, begrenzt', () => {
    expect(rememberText(['a', 'b'], 'b')).toEqual(['b', 'a']);
    const many = Array.from({ length: RECENT_MAX }, (_, i) => `x${i}`);
    expect(rememberText(many, 'y')).toHaveLength(RECENT_MAX);
    expect(rememberText(many, 'y')[0]).toBe('y');
  });
});

describe('Einstellung practiceRecent', () => {
  it('pickKnown nimmt nur Listen aus Text-IDs, höchstens RECENT_MAX', async () => {
    const { pickKnown } = await import('../store/settings');
    const many = Array.from({ length: RECENT_MAX + 3 }, (_, i) => `a1-u01-t${i}`);
    expect(pickKnown({ practiceRecent: many }).practiceRecent).toHaveLength(RECENT_MAX);
    expect(pickKnown({ practiceRecent: [1] as unknown as string[] })).toEqual({});
    expect(pickKnown({ practiceRecent: 'x' as unknown as string[] })).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';
import { conjugate, inflect, nonfinite, predicate } from '../morphology';
import { explainSteps } from './explain';

describe('explainSteps', () => {
  it('begründet Harmonie und Assimilation', () => {
    expect(explainSteps(inflect('ev', ['LOC']).steps)).toEqual([
      'Nach „v“ bleibt es d → Lokativ',
      'Letzter Vokal „e“ ist hell → Lokativ mit „e“',
    ]);
  });

  it('begründet Erweichung und Pufferlaut', () => {
    const lines = explainSteps(inflect({ form: 'kitap', softens: true }, ['ACC']).steps);
    expect(lines).toContain('Auslaut „p“ wird vor einem Vokal zu „b“ (Akkusativ)');
    expect(explainSteps(inflect('araba', ['DAT']).steps)).toContain(
      'Pufferlaut „y“ trennt zwei Vokale → Dativ',
    );
  });

  it('begründet zusammengesetzte Zeiten, Konditional und Optativ ohne offene Platzhalter', () => {
    const forms = [
      conjugate('gelmek', { tense: 'present', compound: 'past', person: '1sg' }),
      conjugate('gelmek', { tense: 'past', compound: 'conditional', person: '1sg' }),
      conjugate('okumak', { tense: 'optative', person: '1sg' }),
      conjugate('yemek', { tense: 'optative', person: '1pl' }),
      conjugate('gelmek', { tense: 'conditional', person: '3pl', negative: true }),
      predicate('hasta', { person: '1sg', tense: 'conditional' }),
    ];
    for (const f of forms) {
      const lines = explainSteps(f.steps);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line).not.toMatch(/\{|tag\./);
    }
    expect(explainSteps(forms[3]!.steps)).toContain(
      'Vor dem Pufferlaut y wird „e“ zu „i“ (yiyecek, diyeyim) → Optativ -e',
    );
    expect(explainSteps(forms[1]!.steps)).toContain(
      'Pufferlaut „y“ trennt zwei Vokale → Bedingung -(y)se',
    );
  });

  it('begründet infinite Formen (Erweichung des Partizips, Hebung, Stammerweichung)', () => {
    const lines = explainSteps(nonfinite('okumak', { form: 'PART_DIK', tags: ['POSS_1SG'] }).steps);
    expect(lines).toContain('Auslaut „k“ wird vor einem Vokal zu „ğ“ (mein)');
    expect(explainSteps(nonfinite('yemek', { form: 'CV_IP' }).steps)).toContain(
      'Vor dem Pufferlaut y wird „e“ zu „i“ (yiyecek, diyeyim) → und dann (-ip)',
    );
    const git = explainSteps(
      nonfinite({ form: 'gitmek', softens: true }, { form: 'CV_INCA' }).steps,
    );
    expect(git).toContain('Auslaut „t“ wird vor einem Vokal zu „d“ (als, sobald (-ince))');
    for (const line of [...lines, ...git]) expect(line).not.toMatch(/\{|tag\./);
  });

  it('begründet vierfache Harmonie', () => {
    expect(explainSteps(inflect('göz', ['ACC']).steps)).toContain(
      'Letzter Vokal „ö“ ist hell und gerundet → Akkusativ mit „ü“',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { inflect } from '../morphology';
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

  it('begründet vierfache Harmonie', () => {
    expect(explainSteps(inflect('göz', ['ACC']).steps)).toContain(
      'Letzter Vokal „ö“ ist hell und gerundet → Akkusativ mit „ü“',
    );
  });
});

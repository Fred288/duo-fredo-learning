import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { tenseLabels } from './ConjugationInput';

describe('tenseLabels', () => {
  it('Kopula mit -dir nennt die Endung', () => {
    expect(tenseLabels(true, { dir: true })).toEqual([t('tag.DIR')]);
  });

  it('Präsens mit -dir nennt die Zeit', () => {
    const present = [t('tense.present'), t('tag.DIR')];
    expect(tenseLabels(false, { tense: 'present', dir: true })).toEqual(present);
    expect(tenseLabels(false, { dir: true })).toEqual(present);
  });

  it('Präsens ohne -dir und Kopula bleibt ungenannt', () => {
    expect(tenseLabels(false, { tense: 'present' })).toEqual([]);
  });

  it('Reziprok steht vor der Zeit', () => {
    expect(tenseLabels(false, { tense: 'past', reciprocal: true })).toEqual([
      t('tag.RECIP'),
      t('tense.past'),
    ]);
  });
});

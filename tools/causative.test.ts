// Kausativ-Flags über den echten Wortschatz: neue Verben fallen hier auf, statt still der Regel
// zu folgen (yaptır-, okut-). Lexikalisierte Kausative sind eigene Vokabeln.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conjugate, MorphError } from '../src/morphology';
import { isUnitFile, parseUnitFile } from './content-checks';

const verbs = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
  .flatMap((f) => parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit?.vocab ?? [])
  .filter((v) => v.pos === 'verb');

const causative = (tr: string) => {
  const v = verbs.find((x) => x.tr === tr);
  expect(v, tr).toBeDefined();
  return conjugate(
    { form: v!.tr, softens: v!.softens, aorist: v!.aorist, causative: v!.causative },
    { tense: 'present', person: '3sg', causative: true },
  ).form;
};

describe('Kausativ der Kurs-Verben', () => {
  it.each([
    ['içmek', 'içiriyor'],
    ['düşmek', 'düşürüyor'],
    ['kaçmak', 'kaçırıyor'],
    ['doğmak', 'doğuruyor'],
    ['uçmak', 'uçuruyor'],
    ['yatmak', 'yatırıyor'],
    ['geçmek', 'geçiriyor'],
    ['vazgeçmek', 'vazgeçiriyor'],
    ['duymak', 'duyuruyor'],
    ['çıkmak', 'çıkarıyor'],
    ['korkmak', 'korkutuyor'],
    ['yapmak', 'yaptırıyor'],
    ['okumak', 'okutuyor'],
    ['oturmak', 'oturtuyor'],
  ])('%s → %s', (tr, form) => {
    expect(causative(tr)).toBe(form);
  });

  it.each(['kaybolmak', 'ayrılmak', 'bozulmak', 'yorulmak', 'katılmak', 'kalkmak'])(
    '%s hat keinen eigenen Kausativ',
    (tr) => {
      expect(() => causative(tr)).toThrow(MorphError);
    },
  );

  it('Verben auf -Il und -ol tragen ein Flag', () => {
    // Mehrsilbig auf -Il/-ol: meist Passiv oder Reflexiv ohne regelhaften Kausativ.
    const risky = verbs.filter(
      (v) => !v.tr.includes(' ') && /[aeıioöuü].*[ıiuüo]lm[ae]k$/.test(v.tr),
    );
    expect(risky.filter((v) => !v.causative).map((v) => v.tr)).toEqual([]);
  });
});

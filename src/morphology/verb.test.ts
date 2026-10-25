import { describe, expect, it } from 'vitest';
import { conjugate, predicate, PERSONS, type Person } from './verb';

const all = (verb: Parameters<typeof conjugate>[0], opts: { negative?: boolean } = {}) =>
  PERSONS.map((person) => conjugate(verb, { tense: 'present', person, ...opts }).form);

describe('Präsens -Iyor', () => {
  it.each([
    ['gelmek', ['geliyorum', 'geliyorsun', 'geliyor', 'geliyoruz', 'geliyorsunuz', 'geliyorlar']],
    ['okumak', ['okuyorum', 'okuyorsun', 'okuyor', 'okuyoruz', 'okuyorsunuz', 'okuyorlar']],
    [
      'beklemek',
      ['bekliyorum', 'bekliyorsun', 'bekliyor', 'bekliyoruz', 'bekliyorsunuz', 'bekliyorlar'],
    ],
    ['aramak', ['arıyorum', 'arıyorsun', 'arıyor', 'arıyoruz', 'arıyorsunuz', 'arıyorlar']],
    ['görmek', ['görüyorum', 'görüyorsun', 'görüyor', 'görüyoruz', 'görüyorsunuz', 'görüyorlar']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb)).toEqual(forms);
  });

  it.each([
    ['anlamak', 'anlıyorum'],
    ['yürümek', 'yürüyorum'],
    ['konuşmak', 'konuşuyorum'],
    ['istemek', 'istiyorum'],
    ['yapmak', 'yapıyorum'],
    ['oturmak', 'oturuyorum'],
  ])('%s → %s', (verb, form) => {
    expect(conjugate(verb, { tense: 'present', person: '1sg' }).form).toBe(form);
  });

  it('erweicht lexikalisch markierte Verbstämme (git-, et-)', () => {
    expect(
      conjugate({ form: 'gitmek', softens: true }, { tense: 'present', person: '1sg' }).form,
    ).toBe('gidiyorum');
    expect(
      conjugate({ form: 'etmek', softens: true }, { tense: 'present', person: '3sg' }).form,
    ).toBe('ediyor');
    // ohne Flag keine Erweichung
    expect(conjugate('satmak', { tense: 'present', person: '1sg' }).form).toBe('satıyorum');
  });

  it('kennt die unregelmäßigen Stämme de- und ye-', () => {
    expect(conjugate('demek', { tense: 'present', person: '1sg' }).form).toBe('diyorum');
    expect(conjugate('yemek', { tense: 'present', person: '3pl' }).form).toBe('yiyorlar');
    expect(conjugate('yemek', { tense: 'present', person: '1sg', negative: true }).form).toBe(
      'yemiyorum',
    );
  });

  it('akzeptiert Stamm oder Infinitiv', () => {
    expect(conjugate('gel', { tense: 'present', person: '1sg' }).form).toBe('geliyorum');
  });
});

describe('Verneinung', () => {
  it('verengt -mA vor -yor zu -mI', () => {
    expect(all('gelmek', { negative: true })).toEqual([
      'gelmiyorum',
      'gelmiyorsun',
      'gelmiyor',
      'gelmiyoruz',
      'gelmiyorsunuz',
      'gelmiyorlar',
    ]);
  });

  it.each([
    ['okumak', '2sg', 'okumuyorsun'],
    ['beklemek', '3sg', 'beklemiyor'],
    ['aramak', '1pl', 'aramıyoruz'],
    ['görmek', '3pl', 'görmüyorlar'],
  ] as [string, Person, string][])('%s %s → %s', (verb, person, form) => {
    expect(conjugate(verb, { tense: 'present', person, negative: true }).form).toBe(form);
  });

  it('erweicht vor -mA nicht (gitmiyorum)', () => {
    const git = { form: 'gitmek', softens: true };
    expect(conjugate(git, { tense: 'present', person: '1sg', negative: true }).form).toBe(
      'gitmiyorum',
    );
  });
});

describe('Frage mit mI', () => {
  it.each([
    ['1sg', 'geliyor muyum'],
    ['2sg', 'geliyor musun'],
    ['3sg', 'geliyor mu'],
    ['1pl', 'geliyor muyuz'],
    ['2pl', 'geliyor musunuz'],
    ['3pl', 'geliyorlar mı'],
  ] as [Person, string][])('%s → %s', (person, form) => {
    expect(conjugate('gelmek', { tense: 'present', person, question: true }).form).toBe(form);
  });

  it('verneinte Frage', () => {
    expect(
      conjugate('gelmek', { tense: 'present', person: '2sg', negative: true, question: true }).form,
    ).toBe('gelmiyor musun');
  });
});

describe('Kopula (Nominalsatz)', () => {
  it.each([
    ['1sg', 'Almanım'],
    ['2sg', 'Almansın'],
    ['3sg', 'Alman'],
    ['1pl', 'Almanız'],
    ['2pl', 'Almansınız'],
    ['3pl', 'Almanlar'],
  ] as [Person, string][])('Alman %s → %s', (person, form) => {
    expect(predicate({ form: 'Alman', capitalized: true }, { person }).form).toBe(form);
  });

  it.each([
    ['öğrenci', '1sg', {}, 'öğrenciyim'],
    ['öğrenci', '1pl', {}, 'öğrenciyiz'],
    ['mutlu', '1sg', {}, 'mutluyum'],
    ['yorgun', '2sg', {}, 'yorgunsun'],
    [{ form: 'Türk', capitalized: true }, '2sg', { question: true }, 'Türk müsün'],
    [{ form: 'Ayşe', proper: true }, '1sg', {}, "Ayşe'yim"],
    ['hasta', '3sg', { question: true }, 'hasta mı'],
    ['hasta', '1sg', { question: true }, 'hasta mıyım'],
    ['öğretmen', '1sg', { negative: true }, 'öğretmen değilim'],
    ['öğretmen', '2sg', { negative: true, question: true }, 'öğretmen değil misin'],
    ['evli', '3pl', { question: true }, 'evliler mi'],
  ] as [
    Parameters<typeof predicate>[0],
    Person,
    { negative?: boolean; question?: boolean },
    string,
  ][])('%s %s %o → %s', (word, person, opts, form) => {
    expect(predicate(word, { person, ...opts }).form).toBe(form);
  });

  it('setzt -DIr auf Wunsch (3. Person)', () => {
    expect(predicate('öğretmen', { person: '3sg', dir: true }).form).toBe('öğretmendir');
    expect(predicate('kitap', { person: '3sg', dir: true }).form).toBe('kitaptır');
    expect(predicate('doktor', { person: '3sg', dir: true }).form).toBe('doktordur');
  });
});

describe('Segmente und Begründung', () => {
  it('zerlegt bekliyorum in Stamm, -iyor und Personalendung', () => {
    const r = conjugate('beklemek', { tense: 'present', person: '1sg' });
    expect(r.segments.map((s) => s.text)).toEqual(['bekl', 'iyor', 'um']);
    expect(r.steps).toContainEqual(
      expect.objectContaining({ rule: 'stem_vowel_drop', vowel: 'e' }),
    );
  });

  it('begründet die Verengung bei der Verneinung', () => {
    const r = conjugate('gelmek', { tense: 'present', person: '1sg', negative: true });
    expect(r.segments.map((s) => s.text)).toEqual(['gel', 'mi', 'yor', 'um']);
    expect(r.steps).toContainEqual(expect.objectContaining({ tag: 'NEG', rule: 'narrowing' }));
  });

  it('führt die Fragepartikel als eigenes Segment', () => {
    const r = conjugate('gelmek', { tense: 'present', person: '2sg', question: true });
    expect(r.segments.map((s) => s.text)).toEqual(['gel', 'iyor', 'musun']);
  });
});

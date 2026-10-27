import { speechText } from '../audio/speech-text';
import { fnv1a } from '../lib/hash';
import { trLower } from '../lib/turkish';
import type { Card } from '../srs/card';
import { glossDistractors, glossOf, stableShuffle } from '../srs/vocab-exercise';
import { vocabId, type Exercise, type Lesson, type Unit, type Vocab } from './schema';

// Hörlektion je Unit, im Build aus vorhandenen Inhalten erzeugt: kein neuer türkischer Text.
// Die Auswahl hängt je Eintrag nur an seinem eigenen Hash: neue Übungen verdrängen höchstens
// einzelne, verschieben aber nicht die ganze Lektion (IDs und SRS-Karten bleiben).

type WordBank = Extract<Exercise, { type: 'word_bank' }>;
type Listen = Extract<Exercise, { type: 'listen' }>;

export const LISTEN_SENTENCES = 8;
export const LISTEN_WORDS = 6;
/** Diktat nur für kurze Sätze; längere werden aus Bausteinen gebaut. */
export const DICTATION_MAX_WORDS = 4;

export const listeningLessonId = (unitId: string): string => `${unitId}-h1`;

/** Karte einer Übung aus einer Hörlektion (a1-u05-h1-…); ohne Stimme nicht spielbar. */
export const isListeningCard = (card: Card): boolean =>
  card.ref.kind === 'exercise' && /^[ab][12]-u\d{2}-h\d+-/.test(card.ref.exerciseId);

/** Die n Einträge mit dem kleinsten Hash, in ursprünglicher Reihenfolge. */
function sample<T>(items: readonly T[], key: (t: T) => string, n: number): T[] {
  const chosen = new Set(
    [...items]
      .sort((a, b) => fnv1a(key(a)) - fnv1a(key(b)) || key(a).localeCompare(key(b)))
      .slice(0, n),
  );
  return items.filter((t) => chosen.has(t));
}

/** Herkunft und Prüfstand der Quelle, nur wo dort gesetzt (sonst gilt die Unit). */
function inherited(src: Exercise | Vocab) {
  const keys = ['reviewed', 'register', 'source', 'license', 'attribution', 'author', 'tatoeba_id'];
  return Object.fromEntries(
    keys.flatMap((k) =>
      src[k as keyof typeof src] === undefined ? [] : [[k, src[k as keyof typeof src]]],
    ),
  ) as Partial<Listen>;
}

function sentenceExercise(
  lessonId: string,
  unitId: string,
  src: WordBank,
  all: WordBank[],
): Listen {
  const text = src.answers[0]!;
  const base = {
    id: `${lessonId}-${src.id.slice(unitId.length + 1)}`,
    type: 'listen' as const,
    text,
    from: src.id,
    gloss_de: src.prompt,
    ...inherited(src),
  };
  const words = text.split(/\s+/).length;
  const pick = fnv1a(`${src.id}:mode`) % 3;
  if (pick === 2) {
    // Andere Sätze der Unit als Ablenker, keiner mit demselben türkischen Satz als Lösung.
    // Ähnlich gebaute zuerst (Ziffern ja/nein, Wortzahl), damit keine Option auffällt.
    const same = new Set(src.answers.map(trLower));
    const shape = (p: string) => [/\d/.test(p), p.split(/\s+/).length] as const;
    const [digits, length] = shape(src.prompt);
    const distance = (p: string) => {
      const [d, n] = shape(p);
      return (d === digits ? 0 : 100) + Math.abs(n - length);
    };
    const others = [
      ...new Set(
        all
          .filter((o) => o.prompt !== src.prompt && !o.answers.some((a) => same.has(trLower(a))))
          .map((o) => o.prompt),
      ),
    ];
    const distractors = stableShuffle(others, (o) => o, src.id)
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, 3);
    if (distractors.length) {
      const options = stableShuffle([src.prompt, ...distractors], (o) => o, `${src.id}:options`);
      return { ...base, mode: 'meaning', options, answer: src.prompt };
    }
  }
  if (pick === 1 && words <= DICTATION_MAX_WORDS) return { ...base, mode: 'dictation' };
  return { ...base, mode: 'tiles', ...(src.distractors && { distractors: src.distractors }) };
}

function vocabExercise(
  lessonId: string,
  v: Vocab,
  text: string,
  pool: Vocab[],
): Listen | undefined {
  const answer = glossOf(v);
  const distractors = glossDistractors(v, pool);
  if (!distractors.length) return undefined;
  return {
    id: `${lessonId}-v-${vocabId(v)}`,
    type: 'listen',
    mode: 'meaning',
    text,
    from: vocabId(v),
    options: stableShuffle([answer, ...distractors], (o) => o, `${vocabId(v)}:options`),
    answer,
    gloss_de: answer,
    ...inherited(v),
  };
}

/** Hörlektion einer Unit: einige Vokabeln (Bedeutung wählen), dann Sätze aus der Wortbank. */
export function listeningLesson(unit: Unit, title: string): Lesson | undefined {
  const id = listeningLessonId(unit.id);
  const pool = unit.vocab ?? [];
  const spoken = pool.flatMap((v) => {
    const text = speechText(v.tr);
    return text ? [{ v, text }] : [];
  });
  const words = sample(spoken, ({ v }) => vocabId(v), LISTEN_WORDS).flatMap(
    ({ v, text }) => vocabExercise(id, v, text, pool) ?? [],
  );

  const banks = unit.lessons
    .flatMap((l) => l.exercises)
    .filter((e): e is WordBank => e.type === 'word_bank');
  const seen = new Set<string>();
  const distinct = banks.filter((e) => {
    const key = trLower(e.answers[0]!);
    if (seen.has(key) || !speechText(e.answers[0]!)) return false;
    seen.add(key);
    return true;
  });
  const sentences = sample(distinct, (e) => e.id, LISTEN_SENTENCES).map((e) =>
    sentenceExercise(id, unit.id, e, banks),
  );

  const exercises = [...words, ...sentences];
  return exercises.length ? { id, type: 'listening', title, exercises } : undefined;
}

/** Fügt die Hörlektion vor der Wiederholung ein (sonst am Ende); eine handgeschriebene bleibt. */
export function withListening(unit: Unit, title: string): Unit {
  const id = listeningLessonId(unit.id);
  if (unit.lessons.some((l) => l.id === id)) return unit;
  const lesson = listeningLesson(unit, title);
  if (!lesson) return unit;
  const at = unit.lessons.findIndex((l) => l.type === 'review');
  const lessons = [...unit.lessons];
  lessons.splice(at < 0 ? lessons.length : at, 0, lesson);
  return { ...unit, lessons };
}

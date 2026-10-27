import { fnv1a } from '../lib/hash';
import type { Exercise, Lesson, Unit, Vocab } from './schema';

// Gemeinsame Bausteine der im Build erzeugten Lektionen (Hören, Zerlegen, Satzbau): kein neuer
// türkischer Text, Auswahl je Eintrag per Hash, Prüfstand und Herkunft von der Quelle.

/** Die n Einträge mit dem kleinsten Hash, in ursprünglicher Reihenfolge. */
export function sample<T>(items: readonly T[], key: (t: T) => string, n: number): T[] {
  const chosen = new Set(
    [...items]
      .sort((a, b) => fnv1a(key(a)) - fnv1a(key(b)) || key(a).localeCompare(key(b)))
      .slice(0, n),
  );
  return items.filter((t) => chosen.has(t));
}

const INHERITED = [
  'reviewed',
  'register',
  'source',
  'license',
  'attribution',
  'author',
  'tatoeba_id',
] as const;

/** Herkunft und Prüfstand der Quelle, nur wo dort gesetzt (sonst gilt die Unit). */
export function inherited(
  src: Exercise | Vocab,
): Partial<Pick<Exercise, (typeof INHERITED)[number]>> {
  return Object.fromEntries(INHERITED.flatMap((k) => (src[k] === undefined ? [] : [[k, src[k]]])));
}

/** Übungs-ID der Quelle ohne Unit-Präfix (a1-u05-l2-e3 → l2-e3), Grundlage stabiler IDs. */
export const localId = (unitId: string, id: string): string => id.slice(unitId.length + 1);

/** Fügt eine erzeugte Lektion vor der Wiederholung ein (sonst am Ende); eine gleichnamige bleibt. */
export function insertLesson(unit: Unit, lesson: Lesson | undefined): Unit {
  if (!lesson || unit.lessons.some((l) => l.id === lesson.id)) return unit;
  const at = unit.lessons.findIndex((l) => l.type === 'review');
  const lessons = [...unit.lessons];
  lessons.splice(at < 0 ? lessons.length : at, 0, lesson);
  return { ...unit, lessons };
}

import type { Manifest } from '../../content/load';
import type { Placement } from '../../placement';
import { progressLessons, type Completion } from '../../progress/stats';

type ManifestUnit = Manifest['units'][number];
export interface NextLesson {
  unit: ManifestUnit;
  lesson: ManifestUnit['lessons'][number];
}

/**
 * Die Lektion für „Weiterlernen“. Ausgangspunkt ist der jüngste Abschluss nach der gültigen
 * Einstufung: dort die nächste offene Lektion der Unit, sonst die nächste Unit mit offener
 * Lektion. Ohne solchen Abschluss gilt die empfohlene Start-Unit, sonst der Kurs von vorn.
 * Laut Einstufung bekannte Units kommen zuletzt: Eine Auffrischung dort führt nach ihrem Ende zur
 * Start-Unit zurück, Nachzuholendes geht vor. Hörlektionen (hängen an der Stimme) und Wiederholen
 * (`srs`) zählen nicht; ist alles geschafft, gibt es nichts.
 */
export function nextLesson(
  units: readonly ManifestUnit[],
  completions: readonly Completion[],
  placement?: Placement,
): NextLesson | undefined {
  const done = new Set(completions.map((c) => c.lessonId));
  const open = (unit: ManifestUnit) => progressLessons(unit.lessons).find((l) => !done.has(l.id));
  const skipped = new Set(placement?.skipped);
  /** Erste offene Lektion ab `index`, dann von vorn; Bekanntes nur, wenn sonst nichts offen ist. */
  const from = (index: number): NextLesson | undefined => {
    const order = [...units.slice(index), ...units.slice(0, index)];
    const pick = order.find((u) => !skipped.has(u.id) && open(u)) ?? order.find(open);
    return pick && { unit: pick, lesson: open(pick)! };
  };
  const start = Math.max(
    units.findIndex((u) => u.id === placement?.startUnit),
    0,
  );

  // Jüngster Abschluss einer Lektion des Kurses, nach der Einstufung.
  const known = new Set(units.flatMap((u) => progressLessons(u.lessons).map((l) => l.id)));
  let latest: Completion | undefined;
  for (const c of completions) {
    if (!known.has(c.lessonId)) continue;
    if (placement && c.at <= placement.at) continue;
    if (!latest || c.at > latest.at) latest = c;
  }
  if (!latest) return from(start);
  const { lessonId } = latest;
  const index = units.findIndex((u) => u.lessons.some((l) => l.id === lessonId));
  const unit = units[index]!;
  const lesson = open(unit);
  if (lesson) return { unit, lesson };
  return from(skipped.has(unit.id) ? start : index + 1);
}

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
 * Hörlektionen (hängen an der Stimme) und Wiederholen (`srs`) zählen nicht; ist alles geschafft,
 * gibt es nichts.
 */
export function nextLesson(
  units: readonly ManifestUnit[],
  completions: readonly Completion[],
  placement?: Placement,
): NextLesson | undefined {
  const done = new Set(completions.map((c) => c.lessonId));
  const open = (unit: ManifestUnit) => progressLessons(unit.lessons).find((l) => !done.has(l.id));
  const at = (index: number): NextLesson | undefined => {
    for (let i = index; i < units.length; i++) {
      const unit = units[i]!;
      const lesson = open(unit);
      if (lesson) return { unit, lesson };
    }
    return undefined;
  };

  // Jüngster Abschluss einer Lektion des Kurses, nach der Einstufung.
  const known = new Set(units.flatMap((u) => progressLessons(u.lessons).map((l) => l.id)));
  let latest: Completion | undefined;
  for (const c of completions) {
    if (!known.has(c.lessonId)) continue;
    if (placement && c.at <= placement.at) continue;
    if (!latest || c.at > latest.at) latest = c;
  }
  if (latest) {
    const index = units.findIndex((u) => u.id === latest.unitId);
    if (index >= 0) {
      const lesson = open(units[index]!);
      if (lesson) return { unit: units[index]!, lesson };
      return at(index + 1) ?? at(0);
    }
  }

  const start = placement?.startUnit ? units.findIndex((u) => u.id === placement.startUnit) : -1;
  return at(start >= 0 ? start : 0);
}

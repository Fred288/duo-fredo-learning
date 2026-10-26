import { useEffect, useRef, useState } from 'react';
import { sectionFor } from '../content/explainer-section';
import { fetchExplainer, fetchManifest, fetchUnit } from '../content/load';
import { vocabId, type Exercise, type Lesson, type Unit, type Vocab } from '../content/schema';
import { t } from '../i18n';
import { dayKey } from '../progress/day';
import { cardId, planRepeat, vocabExercise, type QueueEntry } from '../srs';
import { useApp } from '../store/app';
import { REVIEW_ID, useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { LessonRunner } from './LessonRunner';

interface Run {
  lesson: Lesson;
  vocab: Vocab[];
  /** Karte je Übungs-ID des Durchgangs. */
  entryOf: Map<string, QueueEntry>;
  /** Erklärkarte und Lektionstitel je Übung, für den Grammatik-Hinweis. */
  grammar: Map<string, { markdown: string; lessonTitle: string }>;
}

// Fehlende Erklärkarte stört den Durchgang nicht.
const explainerOf = (u: Unit) =>
  u.explainer ? fetchExplainer(u.explainer).catch(() => '') : Promise.resolve('');

const lessonOfExercise = (exerciseId: string) => exerciseId.replace(/-e\d+$/, '');

async function buildRun(): Promise<Run | null> {
  const { completions, cards, removeCards, putCards } = useProgress.getState();
  const { newWordsPerDay } = useSettings.getState();
  const manifest = await fetchManifest();
  // Momentaufnahme beim Öffnen; neue Antworten ändern den laufenden Durchgang nicht.
  const plan = planRepeat(manifest.units, completions, cards, dayKey(), newWordsPerDay);
  // Karten zu entfernten Units/Vokabeln aufräumen, verschobene Vokabeln behalten ihren Stand.
  removeCards(plan.gone);
  putCards(plan.moved);
  const { queue } = plan;
  const unitIds = [...new Set(queue.map((e) => e.unitId))];
  // Eine nicht ladbare Unit (z. B. offline nicht im Cache) nimmt nur ihre Karten mit.
  const loaded = await Promise.allSettled(unitIds.map(fetchUnit));
  const units = loaded.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const loadedIds = new Set(units.map((u) => u.id));
  const mds = await Promise.all(units.map(explainerOf));

  const exercises = new Map<string, Exercise>();
  const grammar: Run['grammar'] = new Map();
  const vocabById = new Map<string, Vocab>();
  units.forEach((u, i) => {
    for (const v of u.vocab ?? []) vocabById.set(vocabId(v), v);
    for (const l of u.lessons)
      for (const e of l.exercises) {
        exercises.set(e.id, e);
        grammar.set(e.id, { markdown: mds[i]!, lessonTitle: l.title });
      }
  });
  const unitVocab = new Map(units.map((u) => [u.id, u.vocab ?? []]));
  const everyVocab = [...vocabById.values()];

  const entryOf = new Map<string, QueueEntry>();
  const run: Exercise[] = [];
  const gone: string[] = [];
  for (const entry of queue) {
    const { ref } = entry;
    if (!loadedIds.has(entry.unitId)) continue;
    if (ref.kind === 'exercise') {
      const ex = exercises.get(ref.exerciseId);
      if (!ex) gone.push(cardId(ref));
      else {
        run.push(ex);
        entryOf.set(ex.id, entry);
      }
      continue;
    }
    const v = vocabById.get(ref.vocabId);
    if (!v) {
      gone.push(cardId(ref));
      continue;
    }
    const own = unitVocab.get(entry.unitId) ?? [];
    // Zu kleiner Wortschatz der Unit: Ablenker auch aus anderen geladenen Units.
    const ex = vocabExercise(ref, v, own.length >= 4 ? own : everyVocab);
    run.push(ex);
    entryOf.set(ex.id, entry);
  }
  // Entfernte Übungen und Vokabeln kommen nicht zurück: Karten aufräumen.
  removeCards(gone);
  if (!run.length) return null;
  return {
    lesson: { id: REVIEW_ID, type: 'review', title: t('repeat.title'), exercises: run },
    vocab: units.flatMap((u) => [...(u.vocab ?? []), ...(u.lexicon ?? [])]),
    entryOf,
    grammar,
  };
}

export function RepeatScreen() {
  const goHome = useApp((s) => s.goHome);
  const { recordAttempt, recordVocab, recordCompletion } = useProgress.getState();
  const [run, setRun] = useState<Run | null>();
  const [failed, setFailed] = useState(false);
  // „Nochmal“ im Runner spielt den Durchgang erneut, zählt fürs Tagesziel aber nur einmal.
  const completed = useRef(false);

  useEffect(() => {
    buildRun().then(setRun, () => setFailed(true));
  }, []);

  if (failed) return <p className="text-rose-700 dark:text-rose-400">{t('home.error')}</p>;
  if (run === undefined) return <p className="text-stone-500">{t('repeat.loading')}</p>;
  if (run === null) {
    return (
      <section className="space-y-4 text-center">
        <p>{t('repeat.empty')}</p>
        <button
          type="button"
          autoFocus
          onClick={goHome}
          className="min-h-12 w-full rounded-xl bg-teal-700 px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        >
          {t('done.home')}
        </button>
      </section>
    );
  }
  return (
    <LessonRunner
      lesson={run.lesson}
      vocab={run.vocab}
      onExit={goHome}
      doneTitle={t('repeat.done')}
      grammarFor={(ex) => {
        const g = run.grammar.get(ex.id);
        return g?.markdown ? sectionFor(g.markdown, ex, g.lessonTitle) : undefined;
      }}
      onAttempt={(ex, verdict) => {
        const entry = run.entryOf.get(ex.id);
        if (!entry) return;
        if (entry.ref.kind === 'vocab') recordVocab(entry.ref, entry.unitId, verdict);
        // Übungen zählen auch als Versuch, damit „Fehler wiederholen“ den Stand kennt.
        else recordAttempt(ex.id, lessonOfExercise(ex.id), verdict, ex.type);
      }}
      onComplete={(correct, total) => {
        if (completed.current) return;
        completed.current = true;
        recordCompletion(REVIEW_ID, REVIEW_ID, correct, total);
      }}
    />
  );
}

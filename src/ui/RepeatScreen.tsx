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
import { canSpeak } from '../audio/types';
import { getSpeaker, useAudio } from '../store/audio';
import { isListeningCard } from '../content/listening';
import { LessonRunner } from './LessonRunner';

interface Run {
  lesson: Lesson;
  vocab: Vocab[];
  /** Karte je Übungs-ID des Durchgangs. */
  entryOf: Map<string, QueueEntry>;
  /** Lektions-ID je Übung (Hörlektionen haben eigene IDs). */
  lessonOf: Map<string, string>;
  /** Erklärkarte und Lektionstitel je Übung, für den Grammatik-Hinweis. */
  grammar: Map<string, { markdown: string; lessonTitle: string }>;
  /** Meldeziel für „Fehler melden“ je Übung: Unit und Prüfstand. */
  reportOf: Map<string, { unitId: string; unreviewed: boolean }>;
}

// Fehlende Erklärkarte stört den Durchgang nicht.
const explainerOf = (u: Unit) =>
  u.explainer ? fetchExplainer(u.explainer).catch(() => '') : Promise.resolve('');

async function buildRun(): Promise<Run | null> {
  const { completions, cards, removeCards, putCards } = useProgress.getState();
  const { newWordsPerDay } = useSettings.getState();
  const manifest = await fetchManifest();
  // Momentaufnahme beim Öffnen; neue Antworten ändern den laufenden Durchgang nicht.
  const canListen = useSettings.getState().audioEnabled && canSpeak(getSpeaker().status());
  const day = dayKey();
  const plan = planRepeat(manifest.units, completions, cards, day, newWordsPerDay, {
    skip: canListen ? undefined : isListeningCard,
  });
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
  const lessonOf = new Map<string, string>();
  const grammar: Run['grammar'] = new Map();
  const vocabById = new Map<string, Vocab>();
  units.forEach((u, i) => {
    for (const v of u.vocab ?? []) vocabById.set(vocabId(v), v);
    for (const l of u.lessons)
      for (const e of l.exercises) {
        exercises.set(e.id, e);
        lessonOf.set(e.id, l.id);
        grammar.set(e.id, { markdown: mds[i]!, lessonTitle: l.title });
      }
  });
  const unitVocab = new Map(units.map((u) => [u.id, u.vocab ?? []]));
  const everyVocab = [...vocabById.values()];

  const entryOf = new Map<string, QueueEntry>();
  const reportOf: Run['reportOf'] = new Map();
  const unitById = new Map(units.map((u) => [u.id, u]));
  const run: Exercise[] = [];
  const gone: string[] = [];
  for (const entry of queue) {
    const { ref } = entry;
    if (!loadedIds.has(entry.unitId)) continue;
    if (ref.kind === 'exercise') {
      const ex = exercises.get(ref.exerciseId);
      if (!ex) gone.push(cardId(ref));
      // Hörübungen ohne Stimme bleiben fällig, kommen aber erst mit Stimme wieder dran.
      else if (ex.type === 'listen' && !canListen) continue;
      else {
        run.push(ex);
        entryOf.set(ex.id, entry);
        reportOf.set(ex.id, {
          unitId: entry.unitId,
          unreviewed: !(ex.reviewed ?? unitById.get(entry.unitId)?.reviewed),
        });
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
    const ex = vocabExercise(ref, v, own.length >= 4 ? own : everyVocab, day);
    run.push(ex);
    entryOf.set(ex.id, entry);
    reportOf.set(ex.id, {
      unitId: entry.unitId,
      unreviewed: !(v.reviewed ?? unitById.get(entry.unitId)?.reviewed),
    });
  }
  // Entfernte Übungen und Vokabeln kommen nicht zurück: Karten aufräumen.
  removeCards(gone);
  // Nur weil Units nicht ladbar waren (offline): Fehler zeigen statt „nichts zu wiederholen“.
  if (!run.length && loadedIds.size < unitIds.length) throw new Error('units unavailable');
  if (!run.length) return null;
  return {
    lesson: { id: REVIEW_ID, type: 'review', title: t('repeat.title'), exercises: run },
    vocab: units.flatMap((u) => [...(u.vocab ?? []), ...(u.lexicon ?? [])]),
    entryOf,
    lessonOf,
    grammar,
    reportOf,
  };
}

export function RepeatScreen() {
  const goHome = useApp((s) => s.goHome);
  const { recordAttempt, recordVocab, recordCompletion } = useProgress.getState();
  const [run, setRun] = useState<Run | null>();
  const [failed, setFailed] = useState(false);
  // „Nochmal“ im Runner spielt den Durchgang erneut, zählt fürs Tagesziel aber nur einmal.
  const completed = useRef(false);

  // Erst bauen, wenn feststeht, ob es eine Stimme gibt; sonst fehlen fällige Hörkarten.
  const audioEnabled = useSettings((s) => s.audioEnabled);
  const voicesLoading = useAudio((s) => s.status === 'loading');
  const waitForVoices = audioEnabled && voicesLoading;
  const started = useRef(false);
  useEffect(() => {
    getSpeaker(); // legt den Speaker an, falls noch nicht geschehen; der Status folgt im Store
    if (waitForVoices || started.current) return;
    started.current = true;
    buildRun().then(setRun, () => setFailed(true));
  }, [waitForVoices]);

  if (failed) return <p className="text-danger">{t('home.error')}</p>;
  if (run === undefined) {
    return (
      <p className="text-ink-subtle">
        {t(waitForVoices ? 'audio.status.loading' : 'repeat.loading')}
      </p>
    );
  }
  if (run === null) {
    return (
      <section className="space-y-4 text-center">
        <p>{t('repeat.empty')}</p>
        <button
          type="button"
          autoFocus
          onClick={goHome}
          className="min-h-12 w-full rounded-xl bg-brand px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
      attemptOnce
      reportFor={(ex) => run.reportOf.get(ex.id)}
      grammarFor={(ex) => {
        const g = run.grammar.get(ex.id);
        return g?.markdown ? sectionFor(g.markdown, ex, g.lessonTitle) : undefined;
      }}
      onAttempt={(ex, verdict) => {
        const entry = run.entryOf.get(ex.id);
        if (!entry) return;
        if (entry.ref.kind === 'vocab') recordVocab(entry.ref, entry.unitId, verdict);
        // Übungen zählen auch als Versuch, damit „Fehler wiederholen“ den Stand kennt.
        else recordAttempt(ex.id, run.lessonOf.get(ex.id) ?? '', verdict, ex.type);
      }}
      onComplete={(correct, total) => {
        if (completed.current) return;
        completed.current = true;
        recordCompletion(REVIEW_ID, REVIEW_ID, correct, total);
      }}
    />
  );
}

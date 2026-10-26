import { useEffect, useState } from 'react';
import { sectionFor } from '../content/explainer-section';
import { fetchExplainer, fetchUnit } from '../content/load';
import type { Lesson, Vocab } from '../content/schema';
import { t } from '../i18n';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { LessonRunner } from './LessonRunner';

export function LessonScreen({ unitId, lessonId }: { unitId: string; lessonId: string }) {
  const goHome = useApp((s) => s.goHome);
  const recordAttempt = useProgress((s) => s.recordAttempt);
  const recordCompletion = useProgress((s) => s.recordCompletion);
  const [lesson, setLesson] = useState<Lesson>();
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [unitReviewed, setUnitReviewed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [explainer, setExplainer] = useState<string>();

  useEffect(() => {
    fetchUnit(unitId)
      .then((unit) => {
        const found = unit.lessons.find((l) => l.id === lessonId);
        if (found) {
          setVocab([...(unit.vocab ?? []), ...(unit.lexicon ?? [])]);
          setUnitReviewed(unit.reviewed);
          setLesson(found);
          // Ohne Erklärkarte (oder offline nicht geladen) läuft die Lektion ohne Grammatik-Hinweis.
          if (unit.explainer) fetchExplainer(unit.explainer).then(setExplainer, () => {});
        } else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [unitId, lessonId]);

  if (failed) return <p className="text-rose-700 dark:text-rose-400">{t('home.error')}</p>;
  if (!lesson) return <p className="text-stone-500">{t('runner.loading')}</p>;
  return (
    <LessonRunner
      lesson={lesson}
      vocab={vocab}
      unitId={unitId}
      unitReviewed={unitReviewed}
      onExit={goHome}
      onAttempt={(exerciseId, verdict) => recordAttempt(exerciseId, lessonId, verdict)}
      onComplete={(correct, total) => recordCompletion(unitId, lessonId, correct, total)}
      grammarFor={explainer ? (ex) => sectionFor(explainer, ex, lesson.title) : undefined}
    />
  );
}

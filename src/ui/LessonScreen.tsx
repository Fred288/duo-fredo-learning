import { useEffect, useState } from 'react';
import { fetchUnit } from '../content/load';
import type { Lesson } from '../content/schema';
import { t } from '../i18n';
import { useApp } from '../store/app';
import { LessonRunner } from './LessonRunner';

export function LessonScreen({ unitId, lessonId }: { unitId: string; lessonId: string }) {
  const goHome = useApp((s) => s.goHome);
  const [lesson, setLesson] = useState<Lesson>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchUnit(unitId)
      .then((unit) => {
        const found = unit.lessons.find((l) => l.id === lessonId);
        if (found) setLesson(found);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [unitId, lessonId]);

  if (failed) return <p className="text-rose-700 dark:text-rose-400">{t('home.error')}</p>;
  if (!lesson) return <p className="text-stone-500">{t('runner.loading')}</p>;
  return <LessonRunner lesson={lesson} onExit={goHome} />;
}

import { useEffect, useState } from 'react';
import { isListeningCard } from '../content/listening';
import { fetchLookup, fetchManifest, type Manifest } from '../content/load';
import { t } from '../i18n';
import type { LookupIndex } from '../lookup/types';
import { addDays, dayKey } from '../progress/day';
import { insights, type BoxCounts } from '../progress/insights';
import type { Card } from '../srs/card';
import { INTERVALS } from '../srs/leitner';
import { useApp } from '../store/app';
import { useCanSpeak } from '../store/audio';
import { useProgress } from '../store/progress';

const backButton =
  'min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800';
const rowButton =
  'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-stone-800';
const card =
  'rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900';

/** 'YYYY-MM-DD' → Heute / Morgen / 30.10. */
function dayLabel(day: string, today: string): string {
  if (day === today) return t('stats.due.today');
  if (day === addDays(today, 1)) return t('stats.due.tomorrow');
  const [, m, d] = day.split('-');
  return t('lookup.srs.date', { d: d ?? '', m: m ?? '' });
}

/** Schlichte Balken je Box; die Zahl steht als Text daneben (auch für Screenreader). */
function Boxes({ counts, label }: { counts: BoxCounts; label: string }) {
  const max = Math.max(1, ...counts.boxes);
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{label}</h3>
      <ul className="space-y-1">
        {counts.boxes.map((n, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 text-stone-600 dark:text-stone-400">
              {t('stats.box', { box: i + 1, days: INTERVALS[i] ?? '' })}
            </span>
            <span
              aria-hidden="true"
              className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
            >
              <span className="block h-full bg-teal-600" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="w-8 text-right tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-stone-500">{t('stats.unseen', { count: counts.unseen })}</p>
    </div>
  );
}

/** Ruhige Übersicht: was steht wo, was kommt, was fällt schwer. Keine Punkte, keine Vergleiche. */
export function StatsScreen() {
  const goHome = useApp((s) => s.goHome);
  const openLesson = useApp((s) => s.openLesson);
  const openLookup = useApp((s) => s.openLookup);
  const setLookup = useApp((s) => s.setLookup);
  const { completions, attempts, cards } = useProgress();
  const canListen = useCanSpeak();
  const [manifest, setManifest] = useState<Manifest>();
  const [index, setIndex] = useState<LookupIndex>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchManifest()
      .then(setManifest)
      .catch(() => setFailed(true));
    // Ohne Index fehlen nur die Wörter der schwierigen Vokabeln; die IDs bleiben lesbar.
    fetchLookup()
      .then(setIndex)
      .catch(() => undefined);
  }, []);

  const today = dayKey();
  const data = manifest
    ? insights(manifest.units, completions, attempts, cards, today, {
        skip: canListen ? undefined : isListeningCard,
      })
    : undefined;
  const vocabOf = (c: Card) => {
    const ref = c.ref;
    return ref.kind === 'vocab' ? index?.vocab.find((v) => v.id === ref.vocabId) : undefined;
  };
  const lessonOf = (c: Card) => {
    if (c.ref.kind !== 'exercise') return undefined;
    const lessonId = c.ref.exerciseId.replace(/-e\d+$/, '');
    const unit = manifest?.units.find((u) => u.id === c.unitId);
    const lesson = unit?.lessons.find((l) => l.id === lessonId);
    return unit && lesson ? { unit, lesson } : undefined;
  };
  const openWord = (c: Card) => {
    const v = vocabOf(c);
    if (!v) return;
    setLookup(v.tr, v.id);
    openLookup();
  };

  return (
    <section className="space-y-6" aria-labelledby="stats-title">
      <header className="flex items-center gap-3">
        <button type="button" onClick={goHome} className={backButton}>
          ← {t('settings.back')}
        </button>
        <h1 id="stats-title" className="text-xl font-semibold">
          {t('stats.title')}
        </h1>
      </header>

      {failed ? (
        <p className="text-rose-700 dark:text-rose-400">{t('home.error')}</p>
      ) : !data ? (
        <p className="text-stone-500">{t('home.loading')}</p>
      ) : (
        <>
          <section className={`${card} space-y-4`} aria-labelledby="stats-words">
            <h2 id="stats-words" className="font-medium">
              {t('stats.words')}
            </h2>
            <Boxes counts={data.vocab.tr_de} label={t('lookup.srs.tr_de')} />
            <Boxes counts={data.vocab.de_tr} label={t('lookup.srs.de_tr')} />
          </section>

          <section className={card} aria-labelledby="stats-due">
            <h2 id="stats-due" className="font-medium">
              {t('stats.due')}
            </h2>
            <ul className="mt-2 grid grid-cols-7 gap-1 text-center text-sm">
              {data.due.map((d) => (
                <li key={d.day} className="rounded-lg bg-stone-100 px-1 py-2 dark:bg-stone-800">
                  <span className="block text-xs text-stone-500">{dayLabel(d.day, today)}</span>
                  <span className="block tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-labelledby="stats-hard">
            <h2 id="stats-hard" className="font-medium">
              {t('stats.hard')}
            </h2>
            {data.hardWords.length + data.hardForms.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">{t('stats.hard.none')}</p>
            ) : (
              <>
                {data.hardWords.length > 0 && (
                  <>
                    <h3 className="mt-3 text-sm font-medium">{t('stats.hard.words')}</h3>
                    <ul>
                      {data.hardWords.map((c) => {
                        const v = vocabOf(c);
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              disabled={!v}
                              onClick={() => openWord(c)}
                              className={rowButton}
                            >
                              <span>
                                <span lang="tr" className="font-medium">
                                  {v?.tr ?? (c.ref.kind === 'vocab' ? c.ref.vocabId : c.id)}
                                </span>
                                {v && (
                                  <span className="text-stone-600 dark:text-stone-400">
                                    {' '}
                                    · {v.de.join(', ')}
                                  </span>
                                )}
                                <span className="block text-xs text-stone-500">
                                  {c.ref.kind === 'vocab' && t(`lookup.srs.${c.ref.dir}`)}
                                </span>
                              </span>
                              <span className="shrink-0 text-sm text-stone-500">
                                {t('stats.lapses', { count: c.lapses })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {data.hardForms.length > 0 && (
                  <>
                    <h3 className="mt-3 text-sm font-medium">{t('stats.hard.forms')}</h3>
                    <ul>
                      {data.hardForms.map((c) => {
                        const at = lessonOf(c);
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              disabled={!at}
                              onClick={() => at && openLesson(at.unit.id, at.lesson.id)}
                              className={rowButton}
                            >
                              <span>
                                <span className="font-medium">{at?.lesson.title ?? c.id}</span>
                                {at && (
                                  <span className="block text-xs text-stone-500">
                                    {at.unit.title}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-sm text-stone-500">
                                {t('stats.lapses', { count: c.lapses })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          <section className={card} aria-labelledby="stats-units">
            <h2 id="stats-units" className="font-medium">
              {t('stats.units')}
            </h2>
            <p className="mt-1 text-xs text-stone-500">{t('stats.units.hint')}</p>
            <ul className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
              {data.units.map((u) => (
                <li key={u.id} className="py-2 text-sm">
                  <span className="block font-medium">{u.title}</span>
                  <span className="block text-stone-600 dark:text-stone-400">
                    {[
                      t('home.unitProgress', { done: u.done, total: u.total }),
                      u.accuracy === undefined
                        ? t('stats.accuracy.none')
                        : t('stats.accuracy', { percent: Math.round(u.accuracy * 100) }),
                      t('stats.settled', { settled: u.settled, cards: u.cards }),
                    ].join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  );
}

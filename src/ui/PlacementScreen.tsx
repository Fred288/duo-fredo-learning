import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlacement, fetchUnit } from '../content/load';
import type { Unit, Vocab } from '../content/schema';
import { t } from '../i18n';
import {
  answer as advance,
  currentItem,
  recommend,
  startPlacement,
  type PlacementPlan,
  type PlacementState,
  type UnitResult,
} from '../placement';
import { grade, isSupported } from '../session/grade';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { ExerciseView } from './ExerciseView';

const buttonBase =
  'min-h-12 w-full rounded-xl px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-40';

/**
 * Doppeltippen (Klick mit `detail` > 1) und gehaltene Tasten auf den Antwortknöpfen zählen
 * nicht: der zweite Tipp träfe schon die nächste, ungesehene Aufgabe.
 */
const repeated = (e: React.MouseEvent) => e.detail > 1;
const noKeyRepeat = (e: React.KeyboardEvent) => {
  if (e.repeat) e.preventDefault();
};

/**
 * Einstufungstest: ein bis zwei Aufgaben je Thema, ohne Rückmeldung und ohne Punkte. Schreibt
 * nichts in Versuche, Abschlüsse oder Karten; nur die übernommene Empfehlung wird gespeichert.
 */
export function PlacementScreen() {
  const goHome = useApp((s) => s.goHome);
  const [plan, setPlan] = useState<PlacementPlan>();
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [flow, setFlow] = useState<PlacementState>();
  const fail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (!plan) fetchPlacement().then(setPlan, fail);
  }, [plan, tries, fail]);

  if (failed) {
    // Der Stand `flow` bleibt erhalten: nach „Nochmal versuchen“ geht es bei derselben Aufgabe weiter.
    return (
      <section className="space-y-4">
        <p role="alert" className="text-rose-700 dark:text-rose-400">
          {t('placement.error')}
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setFailed(false);
            setTries((n) => n + 1);
          }}
          className={`${buttonBase} bg-teal-700 text-white`}
        >
          {t('placement.retry')}
        </button>
        <BackButton label={t('placement.leave')} onClick={goHome} />
      </section>
    );
  }
  if (!plan) return <p className="text-stone-500 dark:text-stone-400">{t('placement.loading')}</p>;
  if (!flow) return <Intro onStart={() => setFlow(startPlacement(plan))} onBack={goHome} />;
  if (flow.done) return <Result plan={plan} flow={flow} />;
  return <Question plan={plan} flow={flow} onFlow={setFlow} onFail={fail} />;
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
    >
      ← {label}
    </button>
  );
}

function Intro({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return (
    <section className="space-y-6" aria-labelledby="placement-title">
      <header className="flex items-center gap-3">
        <BackButton label={t('placement.back')} onClick={onBack} />
        <h1 id="placement-title" className="text-xl font-semibold">
          {t('placement.title')}
        </h1>
      </header>
      <div className="space-y-3">
        <p>{t('placement.intro.1')}</p>
        <p>{t('placement.intro.2')}</p>
        <p>{t('placement.intro.3')}</p>
      </div>
      <button
        type="button"
        autoFocus
        onClick={onStart}
        className={`${buttonBase} bg-teal-700 text-white`}
      >
        {t('placement.intro.start')}
      </button>
    </section>
  );
}

function Question({
  plan,
  flow,
  onFlow,
  onFail,
}: {
  plan: PlacementPlan;
  flow: PlacementState;
  onFlow: (s: PlacementState) => void;
  onFail: () => void;
}) {
  const goHome = useApp((s) => s.goHome);
  const tolerateDiacritics = useSettings((s) => s.tolerateDiacritics);
  const [value, setValue] = useState('');
  const [loaded, setLoaded] = useState<Unit>();
  const [leaving, setLeaving] = useState(false);
  const units = useRef(new Map<string, Promise<Unit>>());
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback((id: string) => {
    let p = units.current.get(id);
    if (!p) {
      p = fetchUnit(id);
      units.current.set(id, p);
      // Ein Fehlschlag (offline ohne Cache) wird beim nächsten Versuch wiederholt.
      p.catch(() => units.current.delete(id));
    }
    return p;
  }, []);

  const cur = currentItem(plan, flow);
  const unitId = cur?.unit.unitId;
  useEffect(() => {
    if (!unitId) return;
    load(unitId).then(setLoaded, onFail);
    // Die nächste Unit des Niveaus schon holen, damit der Wechsel nicht stockt.
    const nextUnit = plan.levels[flow.level]?.units[flow.unit + 1];
    if (nextUnit) load(nextUnit.unitId).catch(() => undefined);
  }, [unitId, plan, flow.level, flow.unit, load, onFail]);

  const ready = loaded && loaded.id === unitId ? loaded : undefined;
  const ex = ready?.lessons.flatMap((l) => l.exercises).find((e) => e.id === cur?.item.id);
  const supported = ex && isSupported(ex) ? ex : undefined;
  // Die Aufgabe fehlt in den Daten (veralteter Cache): lieber melden als falsch werten.
  useEffect(() => {
    if (ready && !supported) onFail();
  }, [ready, supported, onFail]);

  // Neue Aufgabe: Fokus auf die Fortschrittszeile, damit Screenreader sie ansagen und die
  // Tastatur oben beginnt (der gedrückte Knopf ist nach dem Wechsel nicht mehr derselbe).
  const supportedId = supported?.id;
  useEffect(() => {
    if (supportedId) heading.current?.focus();
  }, [supportedId]);

  const send = useCallback(
    (unknown: boolean) => {
      if (!supported) return;
      if (!unknown && !value.trim()) return;
      const verdict = unknown ? 'unknown' : grade(supported, value, { tolerateDiacritics }).verdict;
      setValue('');
      onFlow(advance(plan, flow, verdict));
    },
    [supported, value, tolerateDiacritics, plan, flow, onFlow],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Aktive Buttons lösen Enter selbst aus (sonst würde doppelt gewertet).
      const button = e.target instanceof HTMLButtonElement ? e.target : undefined;
      if (e.key !== 'Enter' || e.repeat || (button && !button.disabled)) return;
      e.preventDefault();
      send(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  if (!cur) return null;
  const vocab: Vocab[] = ready ? [...(ready.vocab ?? []), ...(ready.lexicon ?? [])] : [];
  // Erst nach einer Antwort lohnt die Rückfrage vorm Verlassen.
  const answered = flow.step === 1 || Object.keys(flow.statuses).length > 0;

  return (
    <section className="space-y-6" aria-labelledby="placement-progress">
      <header className="flex items-center gap-3">
        <BackButton
          label={t('placement.leave')}
          onClick={() => (answered ? setLeaving(true) : goHome())}
        />
        <h1
          id="placement-progress"
          ref={heading}
          tabIndex={-1}
          className="flex-1 text-sm text-stone-600 outline-none dark:text-stone-400"
        >
          {t('placement.progress', {
            level: cur.level,
            current: cur.position,
            total: cur.total,
          })}
        </h1>
      </header>

      {leaving && (
        <div
          role="group"
          aria-labelledby="placement-leave"
          className="space-y-3 rounded-xl border border-stone-300 p-4 dark:border-stone-700"
        >
          <p id="placement-leave">{t('placement.leave.confirm')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setLeaving(false)}
              className="min-h-11 rounded-lg bg-teal-700 px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              {t('placement.leave.keep')}
            </button>
            <button
              type="button"
              onClick={goHome}
              className="min-h-11 rounded-lg border border-stone-300 px-4 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              {t('placement.leave.yes')}
            </button>
          </div>
        </div>
      )}

      {!supported ? (
        <p className="text-stone-500 dark:text-stone-400">{t('placement.unit.loading')}</p>
      ) : (
        <>
          <div key={supported.id} data-exercise-id={supported.id}>
            <ExerciseView
              ex={supported}
              vocab={vocab}
              value={value}
              onChange={setValue}
              disabled={false}
            />
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={(e) => !repeated(e) && send(false)}
              onKeyDown={noKeyRepeat}
              disabled={!value.trim()}
              className={`${buttonBase} bg-teal-700 text-white`}
            >
              {t('runner.continue')}
            </button>
            <button
              type="button"
              onClick={(e) => !repeated(e) && send(true)}
              onKeyDown={noKeyRepeat}
              className={`${buttonBase} bg-stone-200 dark:bg-stone-800`}
            >
              {t('placement.unknown')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const names = (units: readonly UnitResult[]) => units.map((u) => u.title).join(', ');

function Result({ plan, flow }: { plan: PlacementPlan; flow: PlacementState }) {
  const goHome = useApp((s) => s.goHome);
  const goHomeTo = useApp((s) => s.goHomeTo);
  const recordPlacement = useProgress((s) => s.recordPlacement);
  const set = useSettings((s) => s.set);
  const heading = useRef<HTMLHeadingElement>(null);
  const rec = recommend(plan, flow.statuses);
  const byStatus = (status: UnitResult['status']) => rec.units.filter((u) => u.status === status);
  const start = rec.units.find((u) => u.unitId === rec.startUnit);
  const catchUp = rec.units.filter((u) => rec.catchUp.includes(u.unitId));
  const untested = rec.units.filter((u) => !u.status).length;
  // Ohne Start und ohne Übersprungenes gäbe es nichts zu übernehmen (kommt nicht vor).
  const acceptable = rec.startUnit !== null || rec.skipped.length > 0;

  // Die Überschrift bekommt den Fokus: Screenreader lesen die Empfehlung, bevor sie den
  // Knopf erreichen, der sie übernimmt.
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className="space-y-6" aria-labelledby="placement-result">
      <h1
        id="placement-result"
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t('placement.result.title')}
      </h1>
      <div className="space-y-2">
        <p className="font-medium">
          {start
            ? t('placement.result.start', { unit: start.title })
            : t(catchUp.length ? 'placement.result.catchUpOnly' : 'placement.result.allKnown')}
        </p>
        {catchUp.length > 0 && <p>{t('placement.result.catchUp', { units: names(catchUp) })}</p>}
        {rec.skipped.length > 0 && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t('placement.result.effect')}
          </p>
        )}
      </div>

      <Group title={t('placement.section.unsure')} units={byStatus('unsure')} />
      <Group title={t('placement.section.shaky')} units={byStatus('shaky')} />
      <Group title={t('placement.section.secure')} units={byStatus('secure')} fold />
      {untested > 0 && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {t('placement.section.untested', { count: untested })}
        </p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={!acceptable}
          onClick={() => {
            recordPlacement({
              at: Date.now(),
              startUnit: rec.startUnit,
              skipped: rec.skipped,
              shaky: rec.shaky,
            });
            set('placementOffered', true);
            if (rec.startUnit) goHomeTo(rec.startUnit);
            else goHome();
          }}
          className={`${buttonBase} bg-teal-700 text-white`}
        >
          {t('placement.accept')}
        </button>
        <button
          type="button"
          onClick={goHome}
          className={`${buttonBase} bg-stone-200 dark:bg-stone-800`}
        >
          {t('placement.decline')}
        </button>
      </div>
    </section>
  );
}

function Group({
  title,
  units,
  fold = false,
}: {
  title: string;
  units: readonly UnitResult[];
  fold?: boolean;
}) {
  if (!units.length) return null;
  const list = (
    <ul className="mt-2 space-y-1 text-sm">
      {units.map((u) => (
        <li key={u.unitId}>
          <span className="font-medium">{u.title}</span>
          {u.topic && <span className="text-stone-600 dark:text-stone-400"> · {u.topic}</span>}
        </li>
      ))}
    </ul>
  );
  // Bewusst ohne Zahl im Titel: eine Zählung je Gruppe läse sich wie eine Trefferzahl.
  return fold ? (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 font-medium">{title}</summary>
      {list}
    </details>
  ) : (
    <div>
      <h2 className="font-medium">{title}</h2>
      {list}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { LEVELS, type Level } from '../content/schema';
import {
  deckFor,
  lessonSummary,
  markedKeys,
  openWrong,
  type Scope,
  type Selection,
} from '../flashcards/deck';
import { t, type MessageKey } from '../i18n';
import { completedLessonIds } from '../progress/stats';
import { useApp } from '../store/app';
import { useFlashcards } from '../store/flashcards';
import { useProgress } from '../store/progress';
import { useSettings, type Settings } from '../store/settings';
import { useManifest } from './useManifest';

type ScopeName = Scope['scope'];
const SCOPES: readonly ScopeName[] = ['learned', 'unit', 'lesson', 'level', 'wrong', 'marked'];

const select = 'min-h-11 w-full rounded-lg border border-field-edge bg-surface px-2';

/** Knopfreihe aus Radios (wie das Farbschema in den Einstellungen). */
function Choice<T extends string>({
  name,
  legend,
  values,
  value,
  label,
  onChange,
}: {
  name: string;
  legend: string;
  values: readonly T[];
  value: T;
  label: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <label
            key={v}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-center has-focus-visible:outline-2 has-focus-visible:outline-focus ${
              value === v ? 'border-brand-edge bg-brand-soft' : 'border-line-strong bg-surface'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            {label(v)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Karteikasten: Stapel und Abfrage wählen. Die Wahl (außer dem Stapel) merken die Einstellungen. */
export function FlashcardsScreen({ unitId: presetUnit }: { unitId?: string }) {
  const openFlashRun = useApp((s) => s.openFlashRun);
  const { manifest, failed } = useManifest();
  const completions = useProgress((s) => s.completions);
  const { flashes, marks } = useFlashcards();
  const settings = useSettings();
  const setSetting = useSettings((s) => s.set);

  const completed = useMemo(() => completedLessonIds(completions), [completions]);
  const units = useMemo(
    () =>
      manifest?.units.filter((u) => u.lessons.some((l) => l.vocab?.length || l.phrases?.length)) ??
      [],
    [manifest],
  );
  const [scope, setScope] = useState<ScopeName>(
    presetUnit ? 'unit' : completed.size ? 'learned' : 'unit',
  );
  const [unitId, setUnitId] = useState(presetUnit);
  const [lessonId, setLessonId] = useState<string>();
  const [level, setLevel] = useState<Level>('A1');

  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const lessons = unit?.lessons.filter((l) => l.vocab?.length || l.phrases?.length) ?? [];
  const lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0];
  const levels = LEVELS.filter((l) => units.some((u) => u.level === l));

  const wrongCount = openWrong(flashes).length;
  const markedCount = markedKeys(marks).size;

  const selection: Selection | undefined = (() => {
    const base = {
      content: settings.flashContent,
      dir: settings.flashDir,
      order: settings.flashOrder,
    };
    switch (scope) {
      case 'unit':
        return unit && { ...base, scope: { scope, unitId: unit.id } };
      case 'lesson':
        return lesson && { ...base, scope: { scope, lessonId: lesson.id } };
      case 'level':
        return { ...base, scope: { scope, level } };
      default:
        return { ...base, scope: { scope } };
    }
  })();
  // Zählen ohne Zufall: nur die Menge zählt, nicht Richtung oder Reihenfolge.
  const cards =
    manifest && selection
      ? deckFor(manifest.units, selection, { flashes, marks, completedLessons: completed }, () => 0)
      : [];
  const count = cards.length;
  // „Zuletzt gewusst x von n“ für Lektion, Unit, Niveau und Gelerntes (nicht für Falsch/Markiert).
  const last =
    scope !== 'wrong' && scope !== 'marked' && count > 0
      ? lessonSummary(cards, flashes)
      : undefined;

  const scopeLabel = (s: ScopeName): string =>
    s === 'wrong'
      ? t('flash.scope.wrong', { count: wrongCount })
      : s === 'marked'
        ? t('flash.scope.marked', { count: markedCount })
        : t(`flash.scope.${s}` as MessageKey);
  const pref = <K extends 'flashContent' | 'flashDir' | 'flashMode' | 'flashOrder'>(
    key: K,
    prefix: string,
  ) => ({
    value: settings[key],
    onChange: (v: Settings[K]) => setSetting(key, v),
    label: (v: string) => t(`${prefix}.${v}` as MessageKey),
  });

  return (
    <section aria-labelledby="flash-title" className="space-y-6">
      <header>
        <h1 id="flash-title" className="text-2xl font-semibold">
          {t('flash.title')}
        </h1>
        <p className="mt-1 text-ink-muted">{t('flash.intro')}</p>
      </header>
      {failed && <p className="text-danger">{t('home.error')}</p>}
      {!manifest && !failed && <p className="text-ink-subtle">{t('flash.loading')}</p>}
      {manifest && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (selection && count) openFlashRun(selection, settings.flashMode);
          }}
        >
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t('flash.scope')}</legend>
            {SCOPES.map((s) => (
              <label
                key={s}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name="flash-scope"
                  value={s}
                  checked={scope === s}
                  onChange={() => setScope(s)}
                  className="size-5 accent-brand"
                />
                {scopeLabel(s)}
              </label>
            ))}
          </fieldset>

          {(scope === 'unit' || scope === 'lesson') && unit && (
            <label className="block space-y-1">
              <span className="block text-sm text-ink-muted">{t('flash.unit')}</span>
              <select
                value={unit.id}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setLessonId(undefined);
                }}
                className={select}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.level} · {u.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === 'lesson' && lesson && (
            <label className="block space-y-1">
              <span className="block text-sm text-ink-muted">{t('flash.lesson')}</span>
              <select
                value={lesson.id}
                onChange={(e) => setLessonId(e.target.value)}
                className={select}
              >
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === 'level' && (
            <label className="block space-y-1">
              <span className="block text-sm text-ink-muted">{t('flash.level')}</span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className={select}
              >
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {t('home.level', { level: l })}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Choice
            name="flash-content"
            legend={t('flash.content')}
            values={['vocab', 'phrase', 'both'] as const}
            {...pref('flashContent', 'flash.content')}
          />
          <Choice
            name="flash-dir"
            legend={t('flash.dir')}
            values={['tr_de', 'de_tr', 'mixed'] as const}
            {...pref('flashDir', 'flash.dir')}
          />
          <Choice
            name="flash-mode"
            legend={t('flash.mode')}
            values={['flip', 'type'] as const}
            {...pref('flashMode', 'flash.mode')}
          />
          <Choice
            name="flash-order"
            legend={t('flash.order')}
            values={['course', 'shuffled'] as const}
            {...pref('flashOrder', 'flash.order')}
          />

          {count === 0 && <p className="text-ink-muted">{t('flash.empty')}</p>}
          {last && (
            <p className="text-sm text-ink-muted">
              {last.known + last.wrong === 0
                ? t('flash.last.none')
                : t('flash.last', { known: last.known, total: last.total, wrong: last.wrong })}
            </p>
          )}
          <button
            type="submit"
            disabled={!count}
            className="min-h-12 w-full rounded-xl bg-brand px-5 font-medium text-on-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t('flash.start', { count })}
          </button>
        </form>
      )}
    </section>
  );
}

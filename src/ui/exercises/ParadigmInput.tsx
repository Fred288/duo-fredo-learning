import { useRef, useState } from 'react';
import { paradigmRows } from '../../content/lexicon';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { paradigmCells } from '../../session/grade';
import { SpecialCharBar } from '../SpecialCharBar';
import { tenseLabels } from './ConjugationInput';
import { Prompt } from './Prompt';

type ParadigmExercise = Extract<Exercise, { type: 'paradigm' }>;

const PRONOUNS = {
  '1sg': 'ben',
  '2sg': 'sen',
  '3sg': 'o',
  '1pl': 'biz',
  '2pl': 'siz',
  '3pl': 'onlar',
};

interface Props {
  ex: ParadigmExercise;
  onChange: (v: string) => void;
  disabled: boolean;
}

/** Zeilenbeschriftung: Kasusfolge („Plural + Lokativ“) oder Pronomen mit Übersetzung. */
export function rowLabels(ex: ParadigmExercise): string[] {
  return paradigmRows(ex).map((row) =>
    typeof row === 'string'
      ? `${PRONOUNS[row]} (${t(`person.${row}`)})`
      : row.length
        ? row.map((tag) => t(`tag.${tag}`)).join(' + ')
        : t('ex.paradigm.base'),
  );
}

export function ParadigmInput({ ex, onChange, disabled }: Props) {
  const labels = rowLabels(ex);
  const [cells, setCells] = useState(() => labels.map(() => ''));
  const [focused, setFocused] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const results = disabled ? paradigmCells(ex, cells.join('\n')) : undefined;

  const update = (next: string[]) => {
    setCells(next);
    // Prüfen erst, wenn jede Zelle ausgefüllt ist.
    onChange(next.every((c) => c.trim()) ? next.join('\n') : '');
  };

  const insert = (char: string) => {
    const el = inputs.current[focused];
    const value = cells[focused] ?? '';
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    update(
      cells.map((c, i) => (i === focused ? value.slice(0, start) + char + value.slice(end) : c)),
    );
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + char.length, start + char.length);
    });
  };

  const formula = [
    ex.lemma,
    ...(ex.kind === 'noun'
      ? []
      : ex.kind === 'verbal'
        ? [
            ex.causative && t('tag.CAUS'),
            ex.reciprocal && t('tag.RECIP'),
            ex.passive && t('tag.PASS'),
            // verneintes Können ist -(y)AmA (gelemeyen), nicht -ebil + verneint
            ex.ability && t(ex.negative ? 'tag.ABIL_NEG' : 'tag.ABIL'),
            t(`tag.${ex.verbal!}`),
          ]
        : tenseLabels(ex.kind === 'copula', ex)),
    ex.negative && !(ex.kind === 'verbal' && ex.ability) && t('ex.conjugation.negative'),
    ex.question && t('ex.conjugation.question'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4">
      <Prompt instruction={t(`ex.paradigm.${ex.kind}`)} text={formula} ex={ex} lang="de" />
      {ex.gloss_de && <p className="-mt-2 text-ink-muted">„{ex.gloss_de}“</p>}
      <div className="space-y-2">
        {labels.map((label, i) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3"
          >
            <label
              htmlFor={`${ex.id}-cell-${i}`}
              className="text-sm text-ink-muted"
            >
              {label}
            </label>
            <div>
              <input
                id={`${ex.id}-cell-${i}`}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                autoFocus={i === 0}
                value={cells[i]}
                disabled={disabled}
                onFocus={() => setFocused(i)}
                onChange={(e) => update(cells.map((c, j) => (j === i ? e.target.value : c)))}
                onKeyDown={(e) => {
                  // Enter springt weiter, solange noch Felder leer sind.
                  const empty = cells.findIndex((c, j) => j > i && !c.trim());
                  if (e.key === 'Enter' && empty !== -1) {
                    e.preventDefault();
                    e.stopPropagation();
                    inputs.current[empty]?.focus();
                  }
                }}
                lang="tr"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={results ? !results[i] : undefined}
                className={`min-h-11 w-full rounded-lg border bg-surface px-3 text-lg focus-visible:outline-2 focus-visible:outline-focus ${
                  results
                    ? results[i]
                      ? 'border-success-edge'
                      : 'border-danger-edge'
                    : 'border-line-strong'
                }`}
              />
              {results && (
                <p className="mt-1 text-sm" lang="tr">
                  {results[i] ? (
                    <span className="text-success">
                      ✓ {t('ex.paradigm.ok')}
                    </span>
                  ) : (
                    <span className="text-danger">
                      ✗ {t('ex.paradigm.expected', { form: ex.targets[i]! })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <SpecialCharBar onInsert={insert} disabled={disabled} />
    </div>
  );
}

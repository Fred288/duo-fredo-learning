import { useMemo, useState } from 'react';
import type { Exercise, SegmentTag } from '../../content/schema';
import { t } from '../../i18n';
import {
  fixedBoundaries,
  piecesFromCuts,
  segmentAnswer,
  segmentLetters,
  segmentRoleOptions,
} from '../../session/segment';
import { Prompt } from './Prompt';

interface Props {
  ex: Extract<Exercise, { type: 'segment' }>;
  onChange: (answer: string) => void;
  disabled: boolean;
}

const letterButton =
  'min-h-11 min-w-7 rounded-md px-0.5 text-xl font-medium focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-default';

/**
 * Wort zerlegen: Antippen eines Buchstabens setzt (oder entfernt) die Grenze danach; feste
 * Grenzen (Leerzeichen, Apostroph) sind vorgegeben. Darunter je Endung eine Rollenauswahl.
 * Die Antwort entsteht erst, wenn jede Endung eine Rolle hat.
 */
export function SegmentInput({ ex, onChange, disabled }: Props) {
  const letters = useMemo(() => segmentLetters(ex.word), [ex.word]);
  const fixed = useMemo(() => new Set(fixedBoundaries(ex.word)), [ex.word]);
  const options = useMemo(() => segmentRoleOptions(ex), [ex]);
  const [cuts, setCuts] = useState<Set<number>>(new Set());
  // Rolle je Stück, über seinen Anfang gemerkt: bleibt beim Verschieben anderer Grenzen stehen.
  const [roles, setRoles] = useState<Map<number, SegmentTag>>(new Map());

  const pieces = piecesFromCuts(ex.word, cuts);
  const starts = pieces.map((_, i) => pieces.slice(0, i).join('').length);

  const emit = (nextCuts: Set<number>, nextRoles: Map<number, SegmentTag>) => {
    const ps = piecesFromCuts(ex.word, nextCuts);
    const st = ps.map((_, i) => ps.slice(0, i).join('').length);
    const tags = st.map((s, i) => (i === 0 ? 'STEM' : (nextRoles.get(s) ?? '')));
    const complete = ps.length >= 2 && tags.every(Boolean);
    onChange(complete ? segmentAnswer({ pieces: ps, tags }) : '');
  };

  const toggle = (at: number) => {
    const next = new Set(cuts);
    if (next.has(at)) next.delete(at);
    else next.add(at);
    setCuts(next);
    emit(next, roles);
  };

  const choose = (start: number, tag: SegmentTag | '') => {
    const next = new Map(roles);
    if (tag) next.set(start, tag);
    else next.delete(start);
    setRoles(next);
    emit(cuts, next);
  };

  // Buchstaben samt sichtbaren Grenzen; nach dem letzten Buchstaben gibt es keine Grenze.
  const letterNodes = [...letters].map((letter, i) => {
    const at = i + 1;
    const last = at === letters.length;
    const isFixed = fixed.has(at);
    return (
      <span key={i} className="inline-flex items-center">
        {last || isFixed ? (
          <span className={`${letterButton} inline-flex items-center`}>{letter}</span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={cuts.has(at)}
            aria-label={t('ex.segment.cut', { prefix: letters.slice(0, at) })}
            onClick={() => toggle(at)}
            className={`${letterButton} hover:bg-stone-200 dark:hover:bg-stone-800`}
          >
            {letter}
          </button>
        )}
        {cuts.has(at) && !isFixed && (
          <span className="mx-0.5 h-8 w-0.5 rounded bg-teal-600" aria-hidden="true" />
        )}
      </span>
    );
  });

  // Je Wort (bis zur festen Grenze) eine Gruppe, die nicht umbricht: geliyor | musun.
  // Apostroph (İstanbul'da) bleibt sichtbar am Ende seiner Gruppe.
  const apostrophes = new Set(
    [...ex.word].flatMap((ch, i) =>
      /['’]/.test(ch) ? [segmentLetters(ex.word.slice(0, i)).length] : [],
    ),
  );
  const groups = [0, ...fixed].map((start, g, all) => {
    const end = all[g + 1] ?? letters.length;
    return (
      <span key={start} className="inline-flex max-w-full flex-wrap items-center">
        {letterNodes.slice(start, end)}
        {apostrophes.has(end) && <span className="text-xl">'</span>}
      </span>
    );
  });

  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.segment')} text={ex.word} ex={ex} lang="tr" />
      {ex.gloss_de && <p className="-mt-2 text-stone-600 dark:text-stone-400">„{ex.gloss_de}“</p>}
      <p className="text-sm text-stone-500">{t('ex.segment.help')}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" lang="tr">
        {groups}
      </div>
      <ul className="flex flex-wrap gap-2">
        {pieces.map((piece, i) => (
          <li
            key={`${starts[i]}-${piece}`}
            className="flex flex-col gap-1 rounded-lg border border-stone-300 p-2 dark:border-stone-700"
          >
            <span className="font-medium" lang="tr">
              {piece}
            </span>
            {i === 0 ? (
              <span className="text-sm text-stone-500">{t('tag.STEM')}</span>
            ) : (
              <select
                aria-label={t('ex.segment.role', { n: i + 1, piece })}
                disabled={disabled}
                value={roles.get(starts[i]!) ?? ''}
                onChange={(e) => choose(starts[i]!, e.target.value as SegmentTag | '')}
                className="min-h-11 rounded-md border border-stone-300 bg-white px-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                <option value="">{t('ex.segment.choose')}</option>
                {options.map((tag) => (
                  <option key={tag} value={tag}>
                    {t(`tag.${tag}`)}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

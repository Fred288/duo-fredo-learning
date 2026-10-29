import { useEffect, useRef } from 'react';
import { speechText } from '../audio/speech-text';
import { t, type MessageKey } from '../i18n';
import { formTable, type FormLabel } from '../lookup/forms';
import type { LookupIndex, VocabEntry } from '../lookup/types';
import { INTERVALS, vocabStatus, type Card, type VocabDir } from '../srs';
import { dayKey } from '../progress/day';
import { useApp } from '../store/app';
import { ShadowButton } from './ShadowButton';
import { SpeakButton } from './SpeakButton';

/** „Plural + Lokativ“, „Präsens, ich, verneint“ … aus den strukturierten Form-Angaben. */
export function formLabelText(label: FormLabel): string {
  switch (label.kind) {
    case 'noun':
      return label.tags.map((tag) => t(`tag.${tag}`)).join(' + ');
    case 'pronoun':
      return t(`tag.${label.case}` as MessageKey);
    case 'verbal':
      return [
        [t(`tag.${label.form}`), ...(label.tags ?? []).map((tag) => t(`tag.${tag}`))].join(' + '),
        label.ability && t('tag.ABIL'),
        label.passive && t('lookup.passive'),
        label.negative && t('lookup.negative'),
      ]
        .filter(Boolean)
        .join(', ');
    case 'verb':
      return [
        t(`tense.${label.tense}`),
        label.compound && t(`compound.${label.compound}`),
        t(`person.${label.person}`),
        label.ability && t('tag.ABIL'),
        label.passive && t('lookup.passive'),
        label.negative && t('lookup.negative'),
      ]
        .filter(Boolean)
        .join(', ');
  }
}

export const formLabelsText = (labels: FormLabel[]): string =>
  labels.map(formLabelText).join(t('lookup.or'));

const caseLabel = (c: string): string =>
  c === 'NOM' ? t('lookup.nominative') : t(`tag.${c}` as MessageKey);

const th = 'px-2 py-1 text-left font-medium';
const td = 'px-2 py-1';

function Forms({ entry }: { entry: VocabEntry }) {
  const table = formTable(entry);
  if (!table) return null;
  return (
    <details className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <summary className="cursor-pointer font-medium">{t('lookup.forms')}</summary>
      <div className="mt-2 overflow-x-auto" lang="tr">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800">
              {table.kind === 'noun' && (
                <>
                  <th className={th} lang="de" />
                  <th className={th} lang="de">
                    {t('lookup.singular')}
                  </th>
                  <th className={th} lang="de">
                    {t('lookup.plural')}
                  </th>
                </>
              )}
              {table.kind === 'pronoun' && <th className={th} colSpan={2} lang="de" />}
              {table.kind === 'verb' && (
                <>
                  <th className={th} />
                  {table.tenses.map((tense) => (
                    <th key={tense} className={th} lang="de">
                      {t(`tense.${tense}`)}
                    </th>
                  ))}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {table.kind === 'noun' &&
              table.rows.map((r) => (
                <tr key={r.case} className="border-b border-stone-100 dark:border-stone-800">
                  <th className={th} scope="row" lang="de">
                    {caseLabel(r.case)}
                  </th>
                  <td className={td}>{r.sg ?? '–'}</td>
                  <td className={td}>{r.pl ?? '–'}</td>
                </tr>
              ))}
            {table.kind === 'pronoun' &&
              table.rows.map((r) => (
                <tr key={r.case} className="border-b border-stone-100 dark:border-stone-800">
                  <th className={th} scope="row" lang="de">
                    {caseLabel(r.case)}
                  </th>
                  <td className={td}>{r.form}</td>
                </tr>
              ))}
            {table.kind === 'verb' &&
              table.rows.map((r) => (
                <tr key={r.person} className="border-b border-stone-100 dark:border-stone-800">
                  <th className={th} scope="row" lang="de">
                    {t(`person.${r.person}`)}
                  </th>
                  {r.forms.map((f, i) => (
                    <td key={i} className={td}>
                      {f ?? '–'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const dueText = (due: string, isDue: boolean): string => {
  if (isDue) return t('lookup.srs.dueNow');
  const [, m, d] = due.split('-');
  return t('lookup.srs.dueOn', { date: t('lookup.srs.date', { d: d ?? '', m: m ?? '' }) });
};

function SrsStatus({ cards, id }: { cards: readonly Card[]; id: string }) {
  const status = vocabStatus(cards, id, dayKey());
  const dirs = (['tr_de', 'de_tr'] as VocabDir[]).filter((d) => status[d]);
  return (
    <section>
      <h3 className="font-medium">{t('lookup.srs.title')}</h3>
      {dirs.length === 0 ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">{t('lookup.srs.none')}</p>
      ) : (
        <ul className="text-sm text-stone-600 dark:text-stone-400">
          {dirs.map((d) => (
            <li key={d}>
              {t('lookup.srs.card', {
                dir: t(`lookup.srs.${d}`),
                box: status[d]!.box,
                max: INTERVALS.length,
                due: dueText(status[d]!.due, status[d]!.isDue),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Detailansicht einer Vokabel: Glossen, Wortart, Unit, Formtabelle, Wiederholen-Stand. */
export function LookupEntry({
  entry,
  index,
  cards,
  compact = false,
}: {
  entry: VocabEntry;
  index: LookupIndex;
  cards: readonly Card[];
  /** Im Lesetext: ohne Sprung zur Erklärkarte (die Lektion bliebe sonst halb liegen). */
  compact?: boolean;
}) {
  const openExplainer = useApp((s) => s.openExplainer);
  const unit = index.units.find((u) => u.id === entry.unit);
  // Das Suchfeld verschwindet beim Öffnen: Fokus auf die Überschrift, damit Tastatur und
  // Screenreader im Eintrag ankommen.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [entry.id]);
  return (
    <article className="space-y-4">
      <header>
        <div className="flex items-center gap-1">
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none" lang="tr">
            {entry.tr}
          </h2>
          {speechText(entry.tr) && <SpeakButton text={speechText(entry.tr)!} />}
          {speechText(entry.tr) && <ShadowButton text={speechText(entry.tr)!} />}
        </div>
        <p className="mt-1">{entry.de.join(', ')}</p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {t(`pos.${entry.pos}`)}
          {entry.register &&
            ` · ${t(entry.register === 'formal' ? 'lookup.formal' : 'lookup.informal')}`}
        </p>
      </header>
      <Forms entry={entry} />
      <SrsStatus cards={cards} id={entry.id} />
      {unit && (
        <p className="text-sm">
          {t('lookup.unit', { unit: unit.title })}
          {unit.explainer && !compact && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => openExplainer(unit.id, { from: 'lookup' })}
                className="min-h-11 rounded-lg px-2 text-teal-700 underline focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-teal-400"
              >
                {t('lookup.explainer')}
              </button>
            </>
          )}
        </p>
      )}
    </article>
  );
}

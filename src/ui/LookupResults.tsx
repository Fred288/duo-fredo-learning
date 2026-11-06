import { useEffect, useState } from 'react';
import { fetchLookup } from '../content/load';
import { t } from '../i18n';
import {
  MAX_RESULTS,
  prepareLookup,
  type PreparedLookup,
  type SearchResult,
} from '../lookup/search';
import { formLabelsText } from './LookupEntry';

// Einmal je Sitzung vorbereitet: Beim Zurückkehren steht die Liste sofort, der Scrollstand passt.
let preparedOnce: PreparedLookup | undefined;

/** Nachschlagewerk laden und Suchschlüssel einmal je Sitzung berechnen. */
export function usePreparedLookup() {
  const [prepared, setPrepared] = useState(preparedOnce);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchLookup()
      .then((index) => {
        if (preparedOnce?.index !== index) preparedOnce = prepareLookup(index);
        if (!cancelled) setPrepared(preparedOnce);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  return { prepared, failed, retry };
}

export const rowButton =
  'card block min-h-11 w-full rounded-2xl border border-line p-3 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

/**
 * Trefferzahl und Trefferlisten (Wörter, Grammatik) einer Suche; gemeinsam für den Bildschirm
 * „Nachschlagen“ und das Nachschlage-Sheet in Lektionen.
 */
export function LookupResults({
  query,
  result,
  unitTitle,
  onWord,
  onSection,
}: {
  query: string;
  result: SearchResult;
  unitTitle: (id: string) => string;
  onWord: (id: string) => void;
  onSection: (unit: string, slug: string) => void;
}) {
  const total = result.vocab.length + result.sections.length;
  return (
    <>
      {/* Dauerhaft im DOM, sonst lesen Screenreader die erste Trefferzahl nicht vor. */}
      <p role="status" aria-live="polite" className="text-sm text-ink-muted">
        {!query.trim()
          ? ''
          : total === 0
            ? t('lookup.none')
            : result.more
              ? t('lookup.countMore', { count: MAX_RESULTS })
              : t('lookup.count', { count: total })}
      </p>
      {query.trim() && total === 0 && (
        <p className="text-sm text-ink-muted">{t('lookup.noneHint')}</p>
      )}
      {query.trim() && result.vocab.length > 0 && (
        <ul className="space-y-2" aria-label={t('lookup.words')}>
          {result.vocab.map((h) => (
            <li key={h.entry.id}>
              <button type="button" onClick={() => onWord(h.entry.id)} className={rowButton}>
                <span className="font-medium" lang="tr">
                  {h.entry.tr}
                </span>{' '}
                <span className="text-sm text-ink-muted">
                  {h.entry.de.join(', ')} · {t(`pos.${h.entry.pos}`)}
                </span>
                {h.form && (
                  <span className="block text-sm text-brand-ink">
                    {t('lookup.formOf', {
                      form: h.form.form,
                      label: formLabelsText(h.form.labels),
                    })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && result.sections.length > 0 && (
        <>
          <h2 className="font-medium">{t('lookup.grammar')}</h2>
          <ul className="space-y-2">
            {result.sections.map((h) => (
              <li key={`${h.section.unit}/${h.section.slug}`}>
                <button
                  type="button"
                  onClick={() => onSection(h.section.unit, h.section.slug)}
                  className={rowButton}
                >
                  <span className="font-medium">{h.section.title}</span>
                  <span className="block text-sm text-ink-muted">{unitTitle(h.section.unit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

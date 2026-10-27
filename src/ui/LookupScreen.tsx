import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLookup } from '../content/load';
import { t } from '../i18n';
import { prepareLookup, search, type PreparedLookup } from '../lookup/search';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { LookupEntry, formLabelsText } from './LookupEntry';
import { SpecialCharBar } from './SpecialCharBar';

const backButton =
  'min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-stone-400 dark:hover:bg-stone-800';
const rowButton =
  'block min-h-11 w-full rounded-xl border border-stone-200 bg-white p-3 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800';

/** Nachschlagewerk: Suche in Vokabeln (Türkisch/Deutsch, auch gebeugt) und Grammatik-Abschnitten. */
export function LookupScreen() {
  const goHome = useApp((s) => s.goHome);
  const openExplainer = useApp((s) => s.openExplainer);
  const query = useApp((s) => s.lookupQuery);
  const entryId = useApp((s) => s.lookupEntry);
  const setLookup = useApp((s) => s.setLookup);
  const cards = useProgress((s) => s.cards);
  const [prepared, setPrepared] = useState<PreparedLookup>();
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLookup()
      .then((index) => !cancelled && setPrepared(prepareLookup(index)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const deferred = useDeferredValue(query);
  const result = useMemo(
    () => (prepared ? search(prepared, deferred) : { vocab: [], sections: [] }),
    [prepared, deferred],
  );
  const entry = entryId ? prepared?.index.vocab.find((v) => v.id === entryId) : undefined;
  const total = result.vocab.length + result.sections.length;

  const openSection = (unit: string, slug: string) =>
    openExplainer(unit, { section: slug, from: 'lookup' });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const hit = result.vocab[0];
      const section = result.sections[0];
      if (hit) setLookup(query, hit.entry.id);
      else if (section) openSection(section.section.unit, section.section.slug);
    } else if (e.key === 'Escape') {
      if (query) setLookup('');
      else goHome();
    }
  };

  const unitTitle = (id: string) => prepared?.index.units.find((u) => u.id === id)?.title ?? id;

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => (entry ? setLookup(query) : goHome())}
        className={backButton}
      >
        ← {t('lookup.back')}
      </button>
      {failed ? (
        <p className="text-rose-700 dark:text-rose-400">{t('lookup.error')}</p>
      ) : !prepared ? (
        <p className="text-stone-500">{t('lookup.loading')}</p>
      ) : entry ? (
        <LookupEntry entry={entry} index={prepared.index} cards={cards} />
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{t('lookup.title')}</h1>
          <input
            ref={input}
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setLookup(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('lookup.search')}
            placeholder={t('lookup.search')}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-lg focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-stone-700 dark:bg-stone-900"
          />
          <SpecialCharBar
            disabled={false}
            onInsert={(c) => {
              setLookup(query + c);
              input.current?.focus();
            }}
          />
          {!deferred.trim() ? (
            <Register prepared={prepared} onOpen={openSection} />
          ) : (
            <>
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-stone-600 dark:text-stone-400"
              >
                {total === 0 ? t('lookup.none') : t('lookup.count', { count: total })}
              </p>
              {result.vocab.length > 0 && (
                <ul className="space-y-2" aria-label={t('lookup.words')}>
                  {result.vocab.map((h) => (
                    <li key={h.entry.id}>
                      <button
                        type="button"
                        onClick={() => setLookup(query, h.entry.id)}
                        className={rowButton}
                      >
                        <span className="font-medium" lang="tr">
                          {h.entry.tr}
                        </span>{' '}
                        <span className="text-sm text-stone-600 dark:text-stone-400">
                          {h.entry.de.join(', ')} · {t(`pos.${h.entry.pos}`)}
                        </span>
                        {h.form && (
                          <span className="block text-sm text-teal-800 dark:text-teal-300">
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
              {result.sections.length > 0 && (
                <>
                  <h2 className="font-medium">{t('lookup.grammar')}</h2>
                  <ul className="space-y-2">
                    {result.sections.map((h) => (
                      <li key={`${h.section.unit}/${h.section.slug}`}>
                        <button
                          type="button"
                          onClick={() => openSection(h.section.unit, h.section.slug)}
                          className={rowButton}
                        >
                          <span className="font-medium">{h.section.title}</span>
                          <span className="block text-sm text-stone-600 dark:text-stone-400">
                            {unitTitle(h.section.unit)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Ohne Suchtext: Hinweis und alle Grammatik-Abschnitte nach Unit, zum Durchblättern. */
function Register({
  prepared,
  onOpen,
}: {
  prepared: PreparedLookup;
  onOpen: (unit: string, slug: string) => void;
}) {
  const { units, sections } = prepared.index;
  return (
    <div className="space-y-4">
      <p className="text-stone-600 dark:text-stone-400">{t('lookup.hint')}</p>
      <h2 className="font-medium">{t('lookup.registry')}</h2>
      {units.map((u) => {
        const own = sections.filter((s) => s.unit === u.id);
        if (!own.length) return null;
        return (
          <details key={u.id} className="rounded-xl border border-stone-200 dark:border-stone-800">
            <summary className="min-h-11 cursor-pointer p-3">{u.title}</summary>
            <ul className="px-3 pb-2">
              {own.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => onOpen(u.id, s.slug)}
                    className="min-h-11 w-full rounded-lg px-2 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-stone-800"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

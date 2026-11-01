import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLookup } from '../content/load';
import { t } from '../i18n';
import { MAX_RESULTS, prepareLookup, search, type PreparedLookup } from '../lookup/search';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { LookupEntry, formLabelsText } from './LookupEntry';
import { SpecialCharBar } from './SpecialCharBar';
import { useBackGuard } from './useBackGuard';
import { useWide } from './useWide';

const backButton =
  'min-h-11 rounded-lg px-3 text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';
const rowButton =
  'card block min-h-11 w-full rounded-2xl border border-line p-3 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

// Einmal je Sitzung vorbereitet: Beim Zurückkehren steht die Liste sofort, der Scrollstand passt.
let preparedOnce: PreparedLookup | undefined;

/** Nachschlagewerk: Suche in Vokabeln (Türkisch/Deutsch, auch gebeugt) und Grammatik-Abschnitten. */
export function LookupScreen() {
  const goBack = useApp((s) => s.goBack);
  const openExplainer = useApp((s) => s.openExplainer);
  const query = useApp((s) => s.lookupQuery);
  const entryId = useApp((s) => s.lookupEntry);
  const setLookup = useApp((s) => s.setLookup);
  const cards = useProgress((s) => s.cards);
  const [prepared, setPrepared] = useState(preparedOnce);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wide = useWide();

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

  // Die Suche braucht unter 3 ms; ohne Verzögerung entspricht Enter immer dem sichtbaren Text.
  const result = useMemo(
    () => (prepared ? search(prepared, query) : { vocab: [], sections: [], more: false }),
    [prepared, query],
  );
  const entry = entryId ? prepared?.index.vocab.find((v) => v.id === entryId) : undefined;
  const total = result.vocab.length + result.sections.length;

  // Escape schließt einen geöffneten Eintrag (einspaltig ist das Suchfeld dann nicht im DOM).
  const hasEntry = !!entry;
  // Zurück-Taste des Geräts geht vom Eintrag zur Trefferliste, nicht aus dem Nachschlagen. In zwei
  // Spalten steht die Liste ohnehin neben dem Eintrag: dort verlässt Zurück das Nachschlagen.
  useBackGuard(hasEntry && !wide, () => setLookup(query));
  useEffect(() => {
    if (!hasEntry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setLookup(query);
      // In zwei Spalten bleibt das Suchfeld stehen und holt sich den Fokus nicht von selbst.
      requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasEntry, query, setLookup]);

  const openSection = (unit: string, slug: string) =>
    openExplainer(unit, { section: slug, from: 'lookup' });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const hit = result.vocab[0];
      const section = result.sections[0];
      if (hit) setLookup(query, hit.entry.id);
      else if (section) openSection(section.section.unit, section.section.slug);
    } else if (e.key === 'Escape') {
      // Chromium leert Suchfelder bei Escape selbst; hier entscheidet die App.
      e.preventDefault();
      // Erst den Eintrag schließen (zwei Spalten), dann die Suche leeren, dann hinaus.
      if (entry && wide) setLookup(query);
      else if (query) setLookup('');
      else goBack();
    }
  };

  const unitTitle = (id: string) => prepared?.index.units.find((u) => u.id === id)?.title ?? id;

  const panel = (p: PreparedLookup) => (
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
        className="min-h-11 w-full rounded-lg border border-field-edge bg-surface px-3 text-lg focus-visible:outline-2 focus-visible:outline-focus"
      />
      <SpecialCharBar
        disabled={false}
        onInsert={(c) => {
          // An der Cursorposition einfügen, nicht ans Ende.
          const el = input.current;
          const start = el?.selectionStart ?? query.length;
          const end = el?.selectionEnd ?? query.length;
          setLookup(query.slice(0, start) + c + query.slice(end));
          requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(start + c.length, start + c.length);
          });
        }}
      />
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
      {!query.trim() ? (
        <Register prepared={p} onOpen={openSection} />
      ) : (
        <>
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
                      <span className="block text-sm text-ink-muted">
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
  );
  const entryView =
    entry && prepared ? (
      <LookupEntry entry={entry} index={prepared.index} cards={cards} />
    ) : undefined;

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => (entry && !wide ? setLookup(query) : goBack())}
        className={backButton}
      >
        ← {t('lookup.back')}
      </button>
      {failed ? (
        <div className="space-y-2">
          <p className="text-danger">{t('lookup.error')}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
            className={backButton}
          >
            {t('lookup.retry')}
          </button>
        </div>
      ) : !prepared ? (
        <p className="text-ink-subtle">{t('lookup.loading')}</p>
      ) : wide ? (
        // Zwei Spalten: Suche und Treffer bleiben stehen, der Eintrag erscheint daneben.
        <div className="grid grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-8">
          <div className="space-y-4">{panel(prepared)}</div>
          <div className="sticky top-[calc(1.5rem+var(--safe-top))] -m-0.5 max-h-[calc(100dvh-3rem-var(--safe-top))] self-start overflow-y-auto p-0.5">
            {entryView ?? <p className="text-ink-subtle">{t('lookup.pick')}</p>}
          </div>
        </div>
      ) : (
        ((entryView && (
          <>
            <h1 className="sr-only">{t('lookup.title')}</h1>
            {entryView}
          </>
        )) ??
        panel(prepared))
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
  // Aufgeklappte Units überleben den Sprung in die Erklärkarte und zurück.
  const open = useApp((s) => s.registerOpen);
  const setOpen = useApp((s) => s.setRegisterOpen);
  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t('lookup.hint')}</p>
      <h2 className="font-medium">{t('lookup.registry')}</h2>
      {units.map((u) => {
        const own = sections.filter((s) => s.unit === u.id);
        if (!own.length) return null;
        return (
          <details
            key={u.id}
            open={open.includes(u.id)}
            onToggle={(e) => {
              const now = e.currentTarget.open;
              if (now !== open.includes(u.id)) {
                setOpen(now ? [...open, u.id] : open.filter((id) => id !== u.id));
              }
            }}
            className="rounded-xl border border-line"
          >
            <summary className="min-h-11 cursor-pointer p-3">{u.title}</summary>
            <ul className="px-3 pb-2">
              {own.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => onOpen(u.id, s.slug)}
                    className="min-h-11 w-full rounded-lg px-2 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
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

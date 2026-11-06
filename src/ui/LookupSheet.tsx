import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { fetchExplainer, fetchManifest } from '../content/load';
import { explainerSections, sectionSlug } from '../content/explainer-section';
import { t } from '../i18n';
import { search } from '../lookup/search';
import { useProgress } from '../store/progress';
import { LookupEntry } from './LookupEntry';
import { LookupResults, usePreparedLookup } from './LookupResults';
import { Markdown } from './Markdown';
import { SearchIcon } from './NavIcons';
import { SpecialCharBar } from './SpecialCharBar';
import { useBackGuard } from './useBackGuard';

const smallButton =
  'min-h-11 shrink-0 rounded-lg px-3 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

interface SheetState {
  query: string;
  /** Offener Wort-Eintrag. */
  entry?: string;
  /** Offener Grammatik-Abschnitt. */
  section?: { unit: string; slug: string };
}

/**
 * Knopf „Nachschlagen“ für Fokusbereiche (Lektion, Wiederholen, Übungstext). Öffnet das
 * Nachschlagewerk als Sheet über der Aufgabe; die Aufgabe bleibt, wie sie ist. Suche und offener
 * Eintrag bleiben erhalten, solange der Knopf steht (also bis die Lektion verlassen wird).
 * Taste „/“ öffnet es, wenn kein Feld den Fokus hat.
 */
export function LookupButton() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SheetState>({ query: '' });
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const altGr = e.getModifierState?.('AltGraph') ?? false;
      if (e.key !== '/' || e.metaKey || ((e.ctrlKey || e.altKey) && !altGr)) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      // Ein anderes Sheet (Wort im Lesetext) hat Vorrang.
      if (document.querySelector('[role=dialog]')) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('lookup.title')}
        aria-haspopup="dialog"
        title={t('lookup.title')}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
      >
        <SearchIcon />
      </button>
      {/* Portal: Der Lektionskopf ist Glas (backdrop-filter), darin wäre `fixed` an ihn gebunden. */}
      {open &&
        createPortal(
          <LookupSheet state={state} onChange={setState} onClose={close} />,
          document.body,
        )}
    </>
  );
}

export function LookupSheet({
  state,
  onChange,
  onClose,
}: {
  state: SheetState;
  onChange: (state: SheetState) => void;
  onClose: () => void;
}) {
  const { prepared, failed, retry } = usePreparedLookup();
  const cards = useProgress((s) => s.cards);
  const input = useRef<HTMLInputElement>(null);
  const { query } = state;
  const result = useMemo(
    () => (prepared ? search(prepared, query) : { vocab: [], sections: [], more: false }),
    [prepared, query],
  );
  const entry = state.entry ? prepared?.index.vocab.find((v) => v.id === state.entry) : undefined;
  const inDetail = !!entry || !!state.section;

  const toList = () => {
    onChange({ query });
    requestAnimationFrame(() => input.current?.focus());
  };
  // Zurück-Taste und Esc gehen eine Ebene hoch: Eintrag → Treffer → Lektion.
  const up = () => (inDetail ? toList() : onClose());
  useBackGuard(true, up);

  const openSection = (unit: string, slug: string) => onChange({ query, section: { unit, slug } });

  // Tasten bleiben im Sheet: Enter im Suchfeld darf die Aufgabe nicht prüfen, Ziffern keine Option
  // wählen. Dafür übernimmt das Sheet Esc selbst.
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key !== 'Escape') return;
    e.preventDefault();
    // Chromium leert Suchfelder bei Esc selbst; hier: erst die Suche leeren, dann schließen.
    if (!inDetail && query && e.target === input.current) onChange({ query: '' });
    else up();
  };

  const onInputKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hit = result.vocab[0];
    const section = result.sections[0];
    if (hit) onChange({ query, entry: hit.entry.id });
    else if (section) openSection(section.section.unit, section.section.slug);
  };

  const unitTitle = (id: string) => prepared?.index.units.find((u) => u.id === id)?.title ?? id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('lookup.title')}
      onKeyDown={onKeyDown}
      // Fokus im Sheet betrifft die Aufgabe nicht (sie scrollt sonst ihr Feld hervor).
      onFocus={(e) => e.stopPropagation()}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line-strong glass-strong [--shadow-y:-8px] p-4 pb-[calc(1rem+var(--safe-bottom))]"
    >
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          {inDetail ? (
            <button type="button" onClick={toList} className={`${smallButton} text-ink-muted`}>
              ← {t('lookup.results')}
            </button>
          ) : (
            <p className="font-medium">{t('lookup.title')}</p>
          )}
          <button type="button" onClick={onClose} className={smallButton}>
            {t('reading.close')}
          </button>
        </div>
        {failed ? (
          <div className="space-y-2">
            <p className="text-danger">{t('lookup.error')}</p>
            <button type="button" onClick={retry} className={smallButton}>
              {t('lookup.retry')}
            </button>
          </div>
        ) : !prepared ? (
          <p className="text-ink-subtle">{t('lookup.loading')}</p>
        ) : entry ? (
          <LookupEntry entry={entry} index={prepared.index} cards={cards} compact />
        ) : state.section ? (
          <SectionView unit={state.section.unit} slug={state.section.slug} unitTitle={unitTitle} />
        ) : (
          <>
            <input
              ref={input}
              type="search"
              autoFocus
              value={query}
              onChange={(e) => onChange({ query: e.target.value })}
              onKeyDown={onInputKey}
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
                const el = input.current;
                const start = el?.selectionStart ?? query.length;
                const end = el?.selectionEnd ?? query.length;
                onChange({ query: query.slice(0, start) + c + query.slice(end) });
                requestAnimationFrame(() => {
                  el?.focus();
                  el?.setSelectionRange(start + c.length, start + c.length);
                });
              }}
            />
            {!query.trim() && <p className="text-sm text-ink-muted">{t('lookup.hint')}</p>}
            <LookupResults
              query={query}
              result={result}
              unitTitle={unitTitle}
              onWord={(id) => onChange({ query, entry: id })}
              onSection={openSection}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Ein Abschnitt der Erklärkarte im Sheet; der Sprung zur ganzen Karte bliebe sonst halb liegen. */
function SectionView({
  unit,
  slug,
  unitTitle,
}: {
  unit: string;
  slug: string;
  unitTitle: (id: string) => string;
}) {
  const [text, setText] = useState<string>();
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let cancelled = false;
    fetchManifest()
      .then((m) => {
        const path = m.units.find((u) => u.id === unit)?.explainer;
        if (!path) throw new Error('kein Explainer');
        return fetchExplainer(path);
      })
      .then((md) => !cancelled && setText(md))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [unit]);
  const section =
    text === undefined ? undefined : explainerSections(text).find((s) => sectionSlug(s.title) === slug);
  useEffect(() => {
    if (section) heading.current?.focus();
  }, [section]);

  if (failed || (text !== undefined && !section)) {
    return <p className="text-danger">{t('explainer.error')}</p>;
  }
  if (!section) return <p className="text-ink-subtle">{t('explainer.loading')}</p>;
  return (
    <article className="space-y-2">
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
        {section.title.replaceAll('**', '')}
      </h2>
      <p className="text-sm text-ink-muted">{unitTitle(unit)}</p>
      <div className="text-sm">
        <Markdown source={section.body} />
      </div>
    </article>
  );
}

import { useEffect, useRef } from 'react';
import type { PassageToken } from '../content/schema';
import { t } from '../i18n';
import type { LookupIndex } from '../lookup/types';
import { useProgress } from '../store/progress';
import { LookupEntry } from './LookupEntry';
import { useBackGuard } from './useBackGuard';

export const wordButton =
  'rounded underline decoration-ink-subtle decoration-dotted underline-offset-4 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus';

/** Antippbares Wort: Eintrag aus dem Nachschlagewerk (Grundform) und/oder Glosse des Textes. */
export function WordSheet({
  token,
  index,
  onClose,
}: {
  token: PassageToken;
  index?: LookupIndex;
  onClose: () => void;
}) {
  const cards = useProgress((s) => s.cards);
  const entry = token.vocab ? index?.vocab.find((v) => v.id === token.vocab) : undefined;
  // Fokus ins Sheet, damit Tastatur und Screenreader es erreichen; Schließen gibt ihn zurück.
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, [token]);
  // Zurück-Taste des Geräts schließt das Sheet, statt die Lektion zu verlassen.
  useBackGuard(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={dialog}
      role="dialog"
      tabIndex={-1}
      aria-label={t('reading.word', { word: token.text })}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto rounded-t-3xl border-t border-line-strong glass-strong [--shadow-y:-8px] p-4 pb-[calc(1rem+var(--safe-bottom))] outline-none"
    >
      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-ink-subtle">
            <span lang="tr" className="font-medium text-ink">
              {token.text}
            </span>
            {token.gloss && ` · ${token.gloss}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 rounded-lg px-3 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
          >
            {t('reading.close')}
          </button>
        </div>
        {entry && index ? (
          <LookupEntry entry={entry} index={index} cards={cards} compact />
        ) : (
          <h2 className="text-xl font-semibold" lang="tr">
            {token.text}
          </h2>
        )}
        {!entry && !token.gloss && (
          <p className="text-sm text-ink-subtle">{t('reading.noEntry')}</p>
        )}
      </div>
    </div>
  );
}

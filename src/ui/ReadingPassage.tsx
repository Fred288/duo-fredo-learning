import { useEffect, useRef, useState } from 'react';
import { fetchLookup } from '../content/load';
import type { Passage, PassageToken } from '../content/schema';
import { t } from '../i18n';
import type { LookupIndex } from '../lookup/types';
import { useProgress } from '../store/progress';
import { LookupEntry } from './LookupEntry';
import { ShadowButton } from './ShadowButton';
import { SpeakButton } from './SpeakButton';

const wordButton =
  'rounded underline decoration-ink-subtle decoration-dotted underline-offset-4 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus';

/** Antippbares Wort: Eintrag aus dem Nachschlagewerk (Grundform) und/oder Glosse des Textes. */
function WordSheet({
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
      className="fixed inset-x-0 bottom-0 z-10 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-line-strong bg-surface p-4 shadow-lg outline-none"
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
        {!entry && !token.gloss && <p className="text-sm text-ink-subtle">{t('reading.noEntry')}</p>}
      </div>
    </div>
  );
}

/**
 * Lesetext satzweise: jedes Wort antippbar (Eintrag aus dem Nachschlagewerk), Übersetzung auf
 * Wunsch, Vorlesen und Nachsprechen je Satz. Die Auflösung der Wörter kommt aus dem Build.
 */
export function ReadingPassage({ passage }: { passage: Passage }) {
  const [index, setIndex] = useState<LookupIndex>();
  const [open, setOpen] = useState<PassageToken>();
  const [translate, setTranslate] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Ohne Index (offline ohne Cache) zeigen Wörter nur ihre Glosse.
    fetchLookup()
      .then(setIndex)
      .catch(() => undefined);
  }, []);

  const close = () => {
    setOpen(undefined);
    opener.current?.focus();
  };
  const tokens: PassageToken[][] = passage.tokens ?? passage.sentences.map((s) => [{ text: s.tr }]);
  const whole = passage.sentences.map((s) => s.tr).join(' ');

  return (
    <article className="space-y-4" aria-label={t('reading.text')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={translate}
            onChange={(e) => setTranslate(e.target.checked)}
            className="size-5 accent-brand"
          />
          {t('reading.translate')}
        </label>
        <span className="flex items-center gap-1 text-sm text-ink-muted">
          {t('reading.readAll')}
          <SpeakButton text={whole} />
        </span>
      </div>
      {passage.title_tr && (
        <h2 className="text-lg font-semibold" lang="tr">
          {passage.title_tr}
        </h2>
      )}
      <div className="space-y-3">
        {passage.sentences.map((s, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1">
              <p lang="tr" className="text-lg leading-relaxed">
                {(tokens[i] ?? []).map((tok, j) =>
                  tok.w ? (
                    <button
                      key={j}
                      type="button"
                      onClick={(e) => {
                        opener.current = e.currentTarget;
                        setOpen(tok);
                      }}
                      className={wordButton}
                    >
                      {tok.text}
                    </button>
                  ) : (
                    <span key={j}>{tok.text}</span>
                  ),
                )}
              </p>
              {translate && (
                <p className="text-sm text-ink-muted" lang="de">
                  {s.de}
                </p>
              )}
            </div>
            <SpeakButton text={s.tr} slow={false} />
            <ShadowButton text={s.tr} />
          </div>
        ))}
      </div>
      {open && <WordSheet token={open} index={index} onClose={close} />}
    </article>
  );
}

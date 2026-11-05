import { useEffect, useRef, useState } from 'react';
import { fetchLookup } from '../content/load';
import type { Passage, PassageToken } from '../content/schema';
import { t } from '../i18n';
import type { LookupIndex } from '../lookup/types';
import { ShadowButton } from './ShadowButton';
import { SpeakButton } from './SpeakButton';
import { WordSheet, wordButton } from './WordSheet';

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

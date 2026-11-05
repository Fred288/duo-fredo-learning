import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchLookup } from '../content/load';
import type { PassageToken } from '../content/schema';
import type { LookupIndex } from '../lookup/types';
import { WordSheet, wordButton } from './WordSheet';

/**
 * Türkischer Satz mit antippbaren Wörtern (Auflösung aus dem Build, wie im Lesetext). Antippbar
 * ist nur, was einen Eintrag oder eine Glosse hat; der Rest bleibt Text.
 */
export function TokenText({ tokens }: { tokens: readonly PassageToken[] }) {
  const [index, setIndex] = useState<LookupIndex>();
  const [open, setOpen] = useState<PassageToken>();
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetchLookup()
      .then(setIndex)
      .catch(() => undefined);
  }, []);

  const close = () => {
    setOpen(undefined);
    opener.current?.focus();
  };

  return (
    <>
      {tokens.map((tok, i) =>
        tok.w && (tok.vocab || tok.gloss) ? (
          <button
            key={i}
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
          <span key={i}>{tok.text}</span>
        ),
      )}
      {/* Portal: Der Satz steht in <p>/<h2>, das Sheet (ein <div>) darf dort nicht hinein. */}
      {open &&
        createPortal(<WordSheet token={open} index={index} onClose={close} />, document.body)}
    </>
  );
}

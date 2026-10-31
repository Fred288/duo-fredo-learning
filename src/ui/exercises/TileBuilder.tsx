import { useEffect, useState } from 'react';
import { t } from '../../i18n';

const tile =
  'min-h-11 rounded-lg border border-line-strong bg-surface px-3 shadow-sm focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-30';

interface Props {
  tokens: string[];
  /** Verbindet die gewählten Bausteine: Leerzeichen bei Wörtern, nichts bei Wortteilen, | bei Satzgliedern. */
  joiner: string;
  emptyLabel: string;
  onChange: (answer: string) => void;
  disabled: boolean;
}

/** Bausteine antippen und in Reihenfolge ablegen (Wortbank, Suffix-Builder, Satzbau). */
export function TileBuilder({ tokens, joiner, emptyLabel, onChange, disabled }: Props) {
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onChange(next.map((i) => tokens[i]).join(joiner));
  };

  // Tastatur: Backspace nimmt den letzten Baustein zurück.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && picked.length) update(picked.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div
        aria-label={emptyLabel}
        className="flex min-h-14 flex-wrap gap-2 border-b-2 border-line-strong pb-2"
        lang="tr"
      >
        {picked.length === 0 && (
          <span className="self-center text-sm text-ink-subtle">{emptyLabel}</span>
        )}
        {picked.map((i, pos) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={t('ex.word_bank.remove', { token: tokens[i]! })}
            onClick={() => update(picked.filter((_, p) => p !== pos))}
            className={tile}
          >
            {tokens[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" lang="tr">
        {tokens.map((token, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled || picked.includes(i)}
            onClick={() => update([...picked, i])}
            className={tile}
          >
            {token}
          </button>
        ))}
      </div>
    </>
  );
}

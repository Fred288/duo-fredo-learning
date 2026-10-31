import { useEffect, useMemo, useRef } from 'react';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { tileTokens } from '../../session/grade';
import { speak, useAudio, useCanSpeak } from '../../store/audio';
import { SpeakButton } from '../SpeakButton';
import { SpecialCharBar } from '../SpecialCharBar';
import { TileBuilder } from './TileBuilder';

interface Props {
  ex: Extract<Exercise, { type: 'listen' }>;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

/**
 * Hörübung: Der Satz wird einmal von selbst gespielt (die Lektion wurde per Klick gestartet),
 * danach über die Knöpfe. Der Text bleibt bis zur Antwort verborgen und steht im Feedback.
 */
export function ListenInput({ ex, value, onChange, disabled }: Props) {
  const can = useCanSpeak();
  const unlocked = useAudio((s) => s.unlocked);
  useEffect(() => {
    if (can && unlocked && !disabled) void speak(ex.text);
  }, [ex.id, can, unlocked, disabled, ex.text]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-subtle">{t(`ex.listen.${ex.mode}`)}</p>
      {!disabled && <SpeakButton text={ex.text} size="large" />}
      {ex.mode === 'tiles' && <Tiles ex={ex} onChange={onChange} disabled={disabled} />}
      {ex.mode === 'dictation' && (
        <Dictation value={value} onChange={onChange} disabled={disabled} />
      )}
      {ex.mode === 'meaning' && (
        <Meaning ex={ex} value={value} onChange={onChange} disabled={disabled} />
      )}
      {disabled && (
        // Audio immer mit Text: nach der Antwort steht der Satz da, mit Bedeutung.
        <div>
          <p className="text-xl font-medium" lang="tr">
            {ex.text}
          </p>
          {ex.gloss_de && <p className="text-ink-muted">„{ex.gloss_de}“</p>}
        </div>
      )}
    </div>
  );
}

function Tiles({ ex, onChange, disabled }: Pick<Props, 'ex' | 'onChange' | 'disabled'>) {
  const tokens = useMemo(() => tileTokens([ex.text], ex.distractors, ex.id), [ex]);
  return (
    <TileBuilder
      tokens={tokens}
      joiner=" "
      emptyLabel={t('ex.word_bank.empty')}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function Dictation({ value, onChange, disabled }: Omit<Props, 'ex'>) {
  const input = useRef<HTMLInputElement>(null);
  // Fügt an der Cursorposition ein und setzt den Cursor dahinter.
  const insert = (char: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + char + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + char.length, start + char.length);
    });
  };
  return (
    <>
      <input
        ref={input}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('ex.free_text.placeholder')}
        aria-label={t('ex.free_text.placeholder')}
        lang="tr"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-lg focus-visible:outline-2 focus-visible:outline-focus"
      />
      <SpecialCharBar onInsert={insert} disabled={disabled} />
    </>
  );
}

function Meaning({ ex, value, onChange, disabled }: Props) {
  // Tastatur: 1–9 wählt die Option.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const option = ex.options?.[Number(e.key) - 1];
      if (option) onChange(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ex.options, onChange, disabled]);

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t('ex.listen.meaning')}</legend>
      {ex.options?.map((option, i) => {
        const selected = option === value;
        return (
          <label
            key={option}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 has-focus-visible:outline-2 has-focus-visible:outline-focus ${
              selected
                ? 'border-brand-edge bg-brand-soft'
                : 'border-line bg-surface'
            }`}
          >
            <input
              type="radio"
              name={ex.id}
              value={option}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <kbd className="text-xs text-ink-subtle">{i + 1}</kbd>
            <span lang="de">{option}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

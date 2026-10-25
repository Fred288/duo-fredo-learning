import { t } from '../i18n';
import { SPECIAL_CHARS } from '../lib/turkish';

export function SpecialCharBar({
  onInsert,
  disabled,
}: {
  onInsert: (c: string) => void;
  disabled: boolean;
}) {
  return (
    <div role="toolbar" aria-label={t('chars.label')} className="flex flex-wrap gap-2" lang="tr">
      {SPECIAL_CHARS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          // mousedown verhindert, dass das Eingabefeld den Fokus verliert
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(c)}
          aria-label={t('chars.insert', { char: c })}
          className="min-h-11 min-w-11 rounded-lg border border-stone-300 bg-white text-lg focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

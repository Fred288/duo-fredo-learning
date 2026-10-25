import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';

/** Aufgabenstellung mit Anweisung und Register-Kennzeichnung (sen/siz). */
export function Prompt({
  instruction,
  text,
  ex,
  lang,
}: {
  instruction: string;
  text: string;
  ex: Exercise;
  lang: 'de' | 'tr';
}) {
  return (
    <div>
      <p className="text-sm text-stone-500">{instruction}</p>
      <p className="mt-2 text-2xl font-medium" lang={lang}>
        {text}
      </p>
      {ex.register && (
        <span className="mt-2 inline-block rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-stone-800">
          {t(`ex.register.${ex.register}`)}
        </span>
      )}
    </div>
  );
}

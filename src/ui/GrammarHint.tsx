import type { ExplainerSection } from '../content/explainer-section';
import { t } from '../i18n';
import { Markdown } from './Markdown';

/** Passender Abschnitt der Erklärkarte nach einer falschen Antwort, aufklappbar. */
export function GrammarHint({ section }: { section: ExplainerSection }) {
  return (
    <details
      open
      className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
    >
      <summary className="cursor-pointer font-medium">
        {t('grammar.title', { section: section.title })}
      </summary>
      <div className="mt-2 text-sm">
        <Markdown source={section.body} />
      </div>
    </details>
  );
}

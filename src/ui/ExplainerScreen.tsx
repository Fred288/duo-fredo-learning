import { useEffect, useState } from 'react';
import { fetchExplainer, fetchManifest } from '../content/load';
import { t } from '../i18n';
import { useApp } from '../store/app';
import { Markdown } from './Markdown';

/** Zeigt die Erklärkarte (Markdown) einer Unit. */
export function ExplainerScreen({ unitId }: { unitId: string }) {
  const goHome = useApp((s) => s.goHome);
  const [text, setText] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchManifest()
      .then((m) => {
        const path = m.units.find((u) => u.id === unitId)?.explainer;
        if (!path) throw new Error('kein Explainer');
        return fetchExplainer(path);
      })
      .then((md) => !cancelled && setText(md))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={goHome}
        className="min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-stone-400 dark:hover:bg-stone-800"
      >
        ← {t('explainer.back')}
      </button>
      {failed ? (
        <p className="text-rose-700 dark:text-rose-400">{t('explainer.error')}</p>
      ) : text === undefined ? (
        <p className="text-stone-500">{t('explainer.loading')}</p>
      ) : (
        <Markdown source={text} />
      )}
    </section>
  );
}

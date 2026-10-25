import { useEffect, useState } from 'react';
import { fetchManifest, type Manifest } from '../content/load';
import { t } from '../i18n';
import { useApp } from '../store/app';
import { notesAsText, useNotes } from '../store/notes';

/** Prüfstand der Inhalte: ungeprüfte Units und lokal gesammelte Fehlernotizen. */
export function Review() {
  const openSettings = useApp((s) => s.openSettings);
  const { notes, remove } = useNotes();
  const [manifest, setManifest] = useState<Manifest>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchManifest()
      .then(setManifest)
      .catch(() => setManifest({ units: [] }));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notesAsText(notes));
      setCopied(true);
    } catch {
      setCopied(false); // Zwischenablage nicht erlaubt: Notizen bleiben sichtbar zum Abschreiben
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="review-title">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={openSettings}
          className="min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          ← {t('review.back')}
        </button>
        <h1 id="review-title" className="text-xl font-semibold">
          {t('review.title')}
        </h1>
      </header>

      <p className="text-sm text-stone-600 dark:text-stone-400">{t('review.hint')}</p>

      <div>
        <h2 className="mb-2 font-medium">{t('review.units')}</h2>
        <ul className="space-y-2">
          {manifest?.units.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900"
            >
              <span>{u.title}</span>
              <span className="text-sm text-stone-500">
                {u.unreviewed > 0
                  ? t('review.unitCount', { count: u.unreviewed })
                  : t('review.unitDone')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-medium">{t('review.notes')}</h2>
          {notes.length > 0 && (
            <button
              type="button"
              onClick={() => void copy()}
              className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm dark:border-stone-700"
            >
              {copied ? t('review.copied') : t('review.copy')}
            </button>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="text-stone-500">{t('review.notes.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"
              >
                <div>
                  <p className="text-xs text-stone-500">
                    {n.itemId} · {new Date(n.at).toLocaleDateString('de-DE')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('review.delete', { item: n.itemId })}
                  onClick={() => void remove(n.id!)}
                  className="min-h-11 min-w-11 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { t } from '../i18n';
import { useNotes } from '../store/notes';

interface Props {
  exerciseId: string;
  unitId: string;
  unreviewed: boolean;
}

/** "Fehler melden": speichert eine Notiz lokal (Review-Ansicht), zeigt den Prüfstatus. */
export function ReportError({ exerciseId, unitId, unreviewed }: Props) {
  const add = useNotes((s) => s.add);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await add(exerciseId, unitId, text);
    setText('');
    setOpen(false);
    setSaved(true);
  };

  return (
    <div className="space-y-2 text-sm">
      {unreviewed && <p className="text-ink-subtle">{t('report.unreviewed')}</p>}
      {saved && !open && <p role="status">{t('report.saved')}</p>}
      {open ? (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block">{t('report.label')}</span>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('report.placeholder')}
              rows={3}
              // Enter im Textfeld soll nicht die Lektion weiterschalten
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-line-strong bg-surface p-2 text-base text-ink"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => void save()}
              className="min-h-11 rounded-lg bg-inverse px-4 text-on-inverse disabled:opacity-40"
            >
              {t('report.save')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-lg px-4"
            >
              {t('report.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
          className="min-h-11 rounded-lg underline underline-offset-2"
        >
          {t('report.open')}
        </button>
      )}
    </div>
  );
}

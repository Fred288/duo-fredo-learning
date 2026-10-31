import { useRef, useState } from 'react';
import {
  backupFileName,
  MAX_BACKUP_BYTES,
  parseBackup,
  type Backup,
  type Skipped,
} from '../backup/format';
import { exportBackup, importBackup, planImport } from '../backup/io';
import type { ImportMode, Merged } from '../backup/merge';
import { t, type MessageKey } from '../i18n';
import { dayKey } from '../progress/day';
import { useSettings } from '../store/settings';

const button =
  'min-h-11 w-full rounded-lg border border-line-strong px-4 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

/** 'YYYY-MM-DD' → 28.10.2026 */
const formatDay = (day: string) => {
  const [y, m, d] = day.split('-');
  return t('backup.date', { d: d ?? '', m: m ?? '', y: y ?? '' });
};

interface Pending {
  backup: Backup;
  skipped: Skipped;
  plans: Record<ImportMode, Merged>;
}

type Message = { kind: 'ok' | 'error'; key: MessageKey };

/** Datei teilen (Handy: Dateien-App, Drive) oder herunterladen (Desktop). */
async function saveFile(file: File): Promise<void> {
  // Am Desktop öffnet `share` einen Systemdialog statt eines Downloads; nur auf Touch-Geräten teilen.
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // Teilen nicht erlaubt (z. B. ohne Nutzergeste): auf Download ausweichen.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Einstufungen nennt die Vorschau nur, wenn welche betroffen sind (meist keine). */
const placementNote = (count: number) =>
  count > 0 ? t('backup.counts.placements', { count }) : '';

export function BackupSection() {
  const lastBackup = useSettings((s) => s.lastBackup);
  const setSetting = useSettings((s) => s.set);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>();
  const [pending, setPending] = useState<Pending>();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      const today = dayKey();
      const backup = await exportBackup();
      const file = new File([JSON.stringify(backup, null, 2)], backupFileName(today), {
        type: 'application/json',
      });
      await saveFile(file);
      setSetting('lastBackup', today);
      setMessage({ kind: 'ok', key: 'backup.exported' });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setMessage({ kind: 'error', key: 'backup.error.export' });
      }
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    // Leeren, damit dieselbe Datei nach einem Fehler erneut gewählt werden kann (sonst kein change).
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setMessage(undefined);
    setPending(undefined);
    setConfirming(false);
    // Vor dem Lesen prüfen: eine versehentlich gewählte große Datei (Video) nicht in den Speicher holen.
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ kind: 'error', key: 'backup.error.too_large' });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ kind: 'error', key: 'backup.error.read' });
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage({ kind: 'error', key: `backup.error.${parsed.reason}` });
      return;
    }
    try {
      const [merge, replace] = await Promise.all([
        planImport(parsed.backup, 'merge'),
        planImport(parsed.backup, 'replace'),
      ]);
      setMode('merge');
      setPending({ backup: parsed.backup, skipped: parsed.skipped, plans: { merge, replace } });
    } catch {
      setMessage({ kind: 'error', key: 'backup.error.nodb' });
    }
  };

  const reset = () => {
    setPending(undefined);
    setConfirming(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const onApply = async () => {
    if (!pending) return;
    if (mode === 'replace' && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await importBackup(pending.backup, mode);
      setMessage({ kind: 'ok', key: 'backup.imported' });
      reset();
    } catch {
      setMessage({ kind: 'error', key: 'backup.error.nodb' });
    } finally {
      setBusy(false);
    }
  };

  const data = pending?.backup.data;
  const skipped = pending ? Object.values(pending.skipped).reduce((sum, n) => sum + n, 0) : 0;
  const merge = pending?.plans.merge.summary;
  const replace = pending?.plans.replace.summary;

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-medium">{t('backup.title')}</legend>
      <p className="text-sm text-ink-subtle">{t('backup.privacy')}</p>
      <p className="text-sm text-ink-subtle">
        {lastBackup ? t('backup.last', { date: formatDay(lastBackup) }) : t('backup.last.never')}
      </p>
      <button type="button" disabled={busy} onClick={() => void onExport()} className={button}>
        {t('backup.export')}
      </button>
      <label
        className={`${button} flex cursor-pointer items-center has-focus-visible:outline-2 has-focus-visible:outline-focus`}
      >
        {t('backup.import')}
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json,text/plain"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="sr-only"
        />
      </label>

      {pending && data && merge && replace && (
        <div
          className="space-y-3 rounded-lg border border-line-strong p-3"
          role="group"
          aria-labelledby="backup-preview"
        >
          <p id="backup-preview" className="font-medium">
            {t('backup.preview', { date: formatDay(dayKey(new Date(pending.backup.exportedAt))) })}
          </p>
          <p className="text-sm">
            {t('backup.counts', {
              attempts: data.attempts.length,
              completions: data.completions.length,
              cards: data.cards.length,
              notes: data.notes.length,
              placementNote: placementNote(data.placements.length),
            })}
          </p>
          {skipped > 0 && (
            <p className="text-sm text-warn">
              {t('backup.skipped', { count: skipped })}
            </p>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm">{t('backup.mode')}</legend>
            {(['merge', 'replace'] as const).map((m) => (
              <label key={m} className="flex min-h-11 items-start gap-3">
                <input
                  type="radio"
                  name="backup-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => {
                    setMode(m);
                    setConfirming(false);
                  }}
                  className="mt-1 size-5 accent-brand"
                />
                <span>
                  <span className="block">{t(`backup.mode.${m}`)}</span>
                  <span className="block text-sm text-ink-subtle">{t(`backup.mode.${m}.hint`)}</span>
                  <span className="block text-sm text-ink-subtle">
                    {m === 'merge'
                      ? t('backup.mode.merge.effect', {
                          ...merge.added,
                          updated: merge.updatedCards,
                          placementNote: placementNote(merge.added.placements),
                        })
                      : t('backup.mode.replace.effect', {
                          ...replace.dropped,
                          placementNote: placementNote(replace.dropped.placements),
                        })}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {confirming && (
            <p role="alert" className="text-sm text-danger">
              {t('backup.confirm')}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onApply()}
              className="min-h-11 flex-1 rounded-lg bg-brand px-4 text-on-brand hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40"
            >
              {confirming ? t('backup.confirm.yes') : t('backup.apply')}
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 rounded-lg border border-line-strong px-4 hover:bg-hover"
            >
              {t('backup.cancel')}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message.kind === 'error' ? 'text-danger' : 'text-brand-ink'}`}
        >
          {t(message.key)}
        </p>
      )}
    </fieldset>
  );
}

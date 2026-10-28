// Nachsprechen: eigene Aufnahme hinter einem Interface (MediaRecorder heute, Fake in Tests).
// Aufnahmen bleiben nur im Speicher, werden nie gespeichert oder gesendet und nicht bewertet.

/** Längste Aufnahme; danach stoppt sie von selbst (ein Satz dauert wenige Sekunden). */
export const MAX_RECORDING_MS = 15_000;

/** `cancelled`: ein Abbruch oder neuer Start kam, während noch nach dem Mikrofon gefragt wurde. */
export type RecordError = 'denied' | 'failed' | 'cancelled';

export interface Recorder {
  /** Mikrofon und MediaRecorder vorhanden (sagt nichts über die Erlaubnis). */
  supported(): boolean;
  /**
   * Fragt beim ersten Mal nach dem Mikrofon; wirft `RecordError`. Bricht eine laufende Aufnahme
   * ab. `onLimit` meldet, dass die Höchstdauer erreicht ist (`stop()` liefert sie dann).
   */
  start(onLimit?: () => void): Promise<void>;
  /** Beendet die Aufnahme und liefert sie; undefined, wenn keine lief. */
  stop(): Promise<Blob | undefined>;
  /** Bricht ab (auch eine noch offene Mikrofon-Anfrage) und gibt das Mikrofon frei. */
  cancel(): void;
}

export function createMediaRecorder(
  nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Recorder {
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished: Promise<Blob | undefined> | undefined;
  // Jeder Start und Abbruch zählt hoch; ein überholter Start gibt sein Mikrofon sofort zurück.
  let generation = 0;

  const release = () => {
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    recorder = undefined;
  };

  const cancel = () => {
    generation++;
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    finished = undefined;
    release();
  };

  return {
    supported: () => typeof MediaRecorder !== 'undefined' && !!nav?.mediaDevices?.getUserMedia,
    async start(onLimit) {
      cancel();
      const mine = generation;
      let media: MediaStream;
      try {
        media = await nav!.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        throw (
          e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
            ? 'denied'
            : 'failed'
        ) satisfies RecordError;
      }
      if (mine !== generation) {
        // Seite verlassen oder anderer Satz, während die Erlaubnis-Abfrage offen war.
        media.getTracks().forEach((track) => track.stop());
        throw 'cancelled' satisfies RecordError;
      }
      stream = media;
      try {
        const rec = new MediaRecorder(media);
        // Je Aufnahme eigene Stücke: ein spätes onstop einer alten Aufnahme greift nicht hinein.
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        finished = new Promise((resolve) => {
          rec.onstop = () => {
            const blob = chunks.length ? new Blob(chunks, { type: rec.mimeType }) : undefined;
            if (recorder === rec) release();
            resolve(blob);
          };
        });
        recorder = rec;
        rec.start();
        timer = setTimeout(() => {
          if (rec.state !== 'recording') return;
          rec.stop();
          onLimit?.();
        }, MAX_RECORDING_MS);
      } catch {
        release();
        throw 'failed' satisfies RecordError;
      }
    },
    async stop() {
      if (recorder?.state === 'recording') recorder.stop();
      const done = finished;
      finished = undefined;
      return done;
    },
    cancel,
  };
}

let current: Recorder | undefined;

/** Der gemeinsame Recorder; wird beim ersten Zugriff angelegt. */
export function getRecorder(): Recorder {
  return (current ??= createMediaRecorder());
}

/** Ersetzt den Recorder (Tests). */
export function setRecorder(next: Recorder): void {
  current = next;
}

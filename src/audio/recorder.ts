// Nachsprechen: eigene Aufnahme hinter einem Interface (MediaRecorder heute, Fake in Tests).
// Aufnahmen bleiben nur im Speicher, werden nie gespeichert oder gesendet und nicht bewertet.

/** Längste Aufnahme; danach stoppt sie von selbst (ein Satz dauert wenige Sekunden). */
export const MAX_RECORDING_MS = 15_000;

export type RecordError = 'denied' | 'failed';

export interface Recorder {
  /** Mikrofon und MediaRecorder vorhanden (sagt nichts über die Erlaubnis). */
  supported(): boolean;
  /** Fragt beim ersten Mal nach dem Mikrofon; wirft `RecordError`. */
  start(): Promise<void>;
  /** Beendet die Aufnahme und liefert sie; undefined, wenn keine lief. */
  stop(): Promise<Blob | undefined>;
  /** Bricht ab und gibt das Mikrofon frei. */
  cancel(): void;
}

export function createMediaRecorder(
  nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Recorder {
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let chunks: Blob[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished: Promise<Blob | undefined> | undefined;

  const release = () => {
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    recorder = undefined;
  };

  return {
    supported: () => typeof MediaRecorder !== 'undefined' && !!nav?.mediaDevices?.getUserMedia,
    async start() {
      release();
      try {
        stream = await nav!.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        throw (
          e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
            ? 'denied'
            : 'failed'
        ) satisfies RecordError;
      }
      try {
        const rec = new MediaRecorder(stream);
        chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        finished = new Promise((resolve) => {
          rec.onstop = () => {
            const blob = chunks.length ? new Blob(chunks, { type: rec.mimeType }) : undefined;
            release();
            resolve(blob);
          };
        });
        recorder = rec;
        rec.start();
        timer = setTimeout(() => {
          if (rec.state === 'recording') rec.stop();
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
    cancel() {
      if (recorder?.state === 'recording') {
        recorder.onstop = null;
        recorder.stop();
      }
      finished = undefined;
      release();
    },
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaRecorder, MAX_RECORDING_MS } from './recorder';

class FakeRecorder {
  static last: FakeRecorder | undefined;
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    FakeRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['x']) });
    this.onstop?.();
  }
}

const released = vi.fn();
const nav = (getUserMedia: () => Promise<unknown>) =>
  ({ mediaDevices: { getUserMedia } }) as unknown as Navigator;
const stream = () => Promise.resolve({ getTracks: () => [{ stop: released }] });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  released.mockClear();
});

describe('createMediaRecorder', () => {
  it('ist ohne MediaRecorder oder Mikrofon nicht verfügbar', () => {
    expect(createMediaRecorder(nav(stream)).supported()).toBe(false);
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    expect(createMediaRecorder({} as Navigator).supported()).toBe(false);
    expect(createMediaRecorder(nav(stream)).supported()).toBe(true);
  });

  it('nimmt auf, liefert die Aufnahme und gibt das Mikrofon frei', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const r = createMediaRecorder(nav(stream));
    await r.start();
    const blob = await r.stop();
    expect(blob?.size).toBe(1);
    expect(released).toHaveBeenCalledOnce();
    expect(await r.stop()).toBeUndefined();
  });

  it('meldet verweigerte Erlaubnis als denied, anderes als failed', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const deny = () => Promise.reject(new DOMException('nein', 'NotAllowedError'));
    await expect(createMediaRecorder(nav(deny)).start()).rejects.toBe('denied');
    const none = () => Promise.reject(new DOMException('kein Gerät', 'NotFoundError'));
    await expect(createMediaRecorder(nav(none)).start()).rejects.toBe('failed');
  });

  it('stoppt nach der Höchstdauer von selbst; Abbrechen verwirft', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const r = createMediaRecorder(nav(stream));
    const onLimit = vi.fn();
    await r.start(onLimit);
    vi.advanceTimersByTime(MAX_RECORDING_MS);
    expect(FakeRecorder.last?.state).toBe('inactive');
    expect(onLimit).toHaveBeenCalledOnce();
    expect((await r.stop())?.size).toBe(1);

    await r.start();
    r.cancel();
    expect(released).toHaveBeenCalledTimes(2);
    expect(await r.stop()).toBeUndefined();
  });

  it('gibt das Mikrofon frei, wenn während der Erlaubnis-Abfrage abgebrochen wird', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    let grant!: () => void;
    const pending = () =>
      new Promise((resolve) => {
        grant = () => resolve({ getTracks: () => [{ stop: released }] });
      });
    const r = createMediaRecorder(nav(pending));
    const started = r.start();
    r.cancel();
    grant();
    await expect(started).rejects.toBe('cancelled');
    expect(released).toHaveBeenCalledOnce();
    expect(await r.stop()).toBeUndefined();
  });

  it('ein neuer Start beendet die alte Aufnahme, ohne die neue zu stören', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const r = createMediaRecorder(nav(stream));
    await r.start();
    const first = FakeRecorder.last!;
    await r.start();
    expect(first.state).toBe('inactive');
    expect(released).toHaveBeenCalledOnce();
    // Spätes onstop der alten Aufnahme (Browser feuert asynchron) gibt das neue Mikrofon nicht frei.
    first.onstop?.();
    expect(released).toHaveBeenCalledOnce();
    expect((await r.stop())?.size).toBe(1);
    expect(released).toHaveBeenCalledTimes(2);
  });
});

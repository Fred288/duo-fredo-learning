import { afterEach, describe, expect, it } from 'vitest';
import { setAudioSession } from './session';

const nav = navigator as Navigator & { audioSession?: { type: string } };

describe('Audio-Sitzung', () => {
  afterEach(() => {
    delete nav.audioSession;
  });

  it('stellt die Sitzung um, wo Safari sie kennt', () => {
    nav.audioSession = { type: 'auto' };
    setAudioSession('playback');
    expect(nav.audioSession.type).toBe('playback');
    setAudioSession('auto');
    expect(nav.audioSession.type).toBe('auto');
  });

  it('tut ohne audioSession nichts', () => {
    expect(() => setAudioSession('playback')).not.toThrow();
  });
});

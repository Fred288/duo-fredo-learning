import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeSpeaker } from '../audio/fake';
import { SpeakButton } from '../ui/SpeakButton';
import { setSpeaker, speak, useAudio, useAutoplay, useCanSpeak, watchGestures } from './audio';
import { DEFAULT_SETTINGS, useSettings } from './settings';

let fake: FakeSpeaker;

afterEach(cleanup);

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS });
  useAudio.setState({ unlocked: false });
  fake = new FakeSpeaker('ready');
  setSpeaker(fake);
});

describe('Audio-Einstellungen', () => {
  it('Standard: Audio an, automatisch aus, Stimme automatisch', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ audioEnabled: true, autoplay: false, voiceURI: '' });
  });
});

describe('Audio-Store', () => {
  it('spiegelt den Status des Speakers', () => {
    expect(useAudio.getState().status).toBe('ready');
    act(() => fake.setStatus('no-voice'));
    expect(useAudio.getState().status).toBe('no-voice');
  });

  it('spricht nur bei eingeschaltetem Audio und bereiter Stimme', async () => {
    await speak('merhaba');
    expect(fake.spoken).toEqual([{ text: 'merhaba', rate: 'normal' }]);

    useSettings.setState({ audioEnabled: false });
    await speak('nein');
    act(() => fake.setStatus('no-voice'));
    useSettings.setState({ audioEnabled: true });
    await speak('auch nicht');
    expect(fake.spoken).toHaveLength(1);
  });

  it('die erste Geste schaltet frei', () => {
    const stop = watchGestures();
    expect(useAudio.getState().unlocked).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(useAudio.getState().unlocked).toBe(true);
    stop();
  });

  it('useCanSpeak folgt Einstellung und Status', () => {
    const { result } = renderHook(() => useCanSpeak());
    expect(result.current).toBe(true);
    act(() => useSettings.setState({ audioEnabled: false }));
    expect(result.current).toBe(false);
  });
});

describe('Automatisch abspielen', () => {
  const play = (text: string | undefined, active = true) =>
    renderHook(({ t, a }) => useAutoplay(t, a), { initialProps: { t: text, a: active } });

  it('ist standardmäßig aus', () => {
    act(() => useAudio.setState({ unlocked: true }));
    play('merhaba');
    expect(fake.spoken).toEqual([]);
  });

  it('spricht erst nach einer Geste', () => {
    useSettings.setState({ autoplay: true });
    const { rerender } = play('merhaba');
    expect(fake.spoken).toEqual([]);
    act(() => useAudio.setState({ unlocked: true }));
    rerender({ t: 'merhaba', a: true });
    expect(fake.spoken).toEqual([{ text: 'merhaba', rate: 'normal' }]);
  });

  it('spricht neuen Text, bricht beim Wechsel ab, schweigt ohne Text oder wenn inaktiv', () => {
    useSettings.setState({ autoplay: true });
    useAudio.setState({ unlocked: true });
    const { rerender } = play('bir');
    rerender({ t: 'iki', a: true });
    expect(fake.spoken.map((s) => s.text)).toEqual(['bir', 'iki']);
    expect(fake.cancelled).toBeGreaterThan(0);
    rerender({ t: undefined, a: true });
    rerender({ t: 'üç', a: false });
    expect(fake.spoken).toHaveLength(2);
  });
});

describe('SpeakButton', () => {
  it('spricht normal und langsam', () => {
    render(<SpeakButton text="Günaydın" />);
    fireEvent.click(screen.getByRole('button', { name: 'Anhören: Günaydın' }));
    fireEvent.click(screen.getByRole('button', { name: 'Langsam anhören: Günaydın' }));
    expect(fake.spoken).toEqual([
      { text: 'Günaydın', rate: 'normal' },
      { text: 'Günaydın', rate: 'slow' },
    ]);
  });

  it('erscheint nicht ohne Stimme oder bei ausgeschaltetem Audio', () => {
    act(() => fake.setStatus('no-voice'));
    const { container } = render(<SpeakButton text="x" />);
    expect(container.innerHTML).toBe('');
    act(() => fake.setStatus('ready'));
    expect(screen.getAllByRole('button')).toHaveLength(2);
    act(() => useSettings.setState({ audioEnabled: false }));
    expect(container.innerHTML).toBe('');
  });
});

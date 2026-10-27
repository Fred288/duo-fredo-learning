import { useEffect } from 'react';
import { create } from 'zustand';
import { playClip, resolveClip } from '../audio/clip';
import {
  canSpeak,
  type Rate,
  type Speaker,
  type VoiceInfo,
  type VoiceStatus,
} from '../audio/types';
import { createWebSpeechSpeaker } from '../audio/web-speech';
import { useSettings } from './settings';

interface AudioState {
  status: VoiceStatus;
  voices: VoiceInfo[];
  /** Erst nach einer Nutzergeste darf der Browser sprechen (iOS, Android); Knöpfe sind selbst Gesten. */
  unlocked: boolean;
}

export const useAudio = create<AudioState>(() => ({
  status: 'loading',
  voices: [],
  unlocked: false,
}));

let speaker: Speaker | undefined;
let unsubscribe: (() => void) | undefined;

/** Der gemeinsame Speaker; wird beim ersten Zugriff angelegt. */
export function getSpeaker(): Speaker {
  if (!speaker) setSpeaker(createWebSpeechSpeaker());
  return speaker!;
}

/** Ersetzt den Speaker (Tests). */
export function setSpeaker(next: Speaker): void {
  unsubscribe?.();
  speaker = next;
  const sync = () => useAudio.setState({ status: next.status(), voices: next.voices() });
  next.setPreferred(useSettings.getState().voiceURI);
  unsubscribe = next.subscribe(sync);
  sync();
}

/** Setzt `unlocked` bei der ersten Geste; Rückgabe meldet die Listener ab. */
export function watchGestures(target: Window = window): () => void {
  const unlock = () => useAudio.setState({ unlocked: true });
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  events.forEach((e) => target.addEventListener(e, unlock, { once: true, passive: true }));
  return () => events.forEach((e) => target.removeEventListener(e, unlock));
}

/** Startet Speaker und Gesten-Erkennung und hält die gewählte Stimme aktuell. */
export function useAudioSetup(): void {
  const voiceURI = useSettings((s) => s.voiceURI);
  useEffect(() => {
    getSpeaker();
    return watchGestures();
  }, []);
  useEffect(() => {
    getSpeaker().setPreferred(voiceURI);
  }, [voiceURI]);
}

/** Audio ist eingeschaltet und eine türkische Stimme bereit. */
export function useCanSpeak(): boolean {
  const enabled = useSettings((s) => s.audioEnabled);
  const status = useAudio((s) => s.status);
  return enabled && canSpeak(status);
}

/** Spielt Türkisch ab, wenn Audio an und bereit ist; sonst nichts (kein Fehler). */
export function speak(text: string, rate: Rate = 'normal'): Promise<void> {
  const s = getSpeaker();
  if (!useSettings.getState().audioEnabled || !canSpeak(s.status())) return Promise.resolve();
  return playClip(resolveClip(text), rate, { speaker: s });
}

export const stopSpeaking = (): void => speaker?.cancel();

/**
 * Liest `text` von selbst vor, wenn „automatisch abspielen“ an ist und der Nutzer schon
 * interagiert hat. Bricht beim Wechsel des Textes und beim Verlassen ab.
 */
export function useAutoplay(text: string | undefined, active = true): void {
  const autoplay = useSettings((s) => s.autoplay);
  const can = useCanSpeak();
  const unlocked = useAudio((s) => s.unlocked);
  useEffect(() => {
    if (!text || !active || !autoplay || !can || !unlocked) return;
    void speak(text);
    return stopSpeaking;
  }, [text, active, autoplay, can, unlocked]);
}

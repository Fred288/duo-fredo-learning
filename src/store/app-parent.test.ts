import { expect, it } from 'vitest';
import { useApp } from './app';

// Eigene Datei: Der Verlauf steht hier noch beim ersten Eintrag.
it('Zurück ohne Eintrag davor führt zum Elternbildschirm', () => {
  useApp.setState({ screen: { name: 'review' } });
  useApp.getState().goBack();
  expect(useApp.getState().screen.name).toBe('settings');
});

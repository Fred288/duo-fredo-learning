import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { useNotes } from './store/notes';
import { useProgress } from './store/progress';
import { applyTheme, DEFAULT_SETTINGS, useSettings } from './store/settings';

// Die App rendert sofort mit Defaults; gespeicherte Werte kommen nach dem Laden dazu.
applyTheme(DEFAULT_SETTINGS.theme);
void useSettings.getState().load();
void useProgress.getState().load();
void useNotes.getState().load();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

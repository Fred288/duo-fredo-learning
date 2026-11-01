import { useEffect, useState } from 'react';
import { fetchManifest, type Manifest } from '../content/load';

// Einmal je Sitzung: Der Kurs steht beim Zurückkehren sofort, der Scrollstand passt. Ein Fehler
// (offline ohne Cache) wird beim nächsten Bildschirm wiederholt.
let loaded: Manifest | undefined;
let loading: Promise<Manifest> | undefined;

function loadManifest(): Promise<Manifest> {
  loading ??= fetchManifest().then(
    (m) => (loaded = m),
    (err: unknown) => {
      loading = undefined;
      throw err;
    },
  );
  return loading;
}

/** Das Kursverzeichnis; `failed` bei Ladefehler. */
export function useManifest(): { manifest?: Manifest; failed: boolean } {
  const [manifest, setManifest] = useState(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (manifest) return;
    loadManifest()
      .then(setManifest)
      .catch(() => setFailed(true));
  }, [manifest]);
  return { manifest, failed };
}

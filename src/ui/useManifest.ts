import { useEffect, useState } from 'react';
import { fetchManifest, type Manifest } from '../content/load';

/** Lädt das Kursverzeichnis einmal je Bildschirm; `failed` bei Ladefehler (offline ohne Cache). */
export function useManifest(): { manifest?: Manifest; failed: boolean } {
  const [manifest, setManifest] = useState<Manifest>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetchManifest()
      .then(setManifest)
      .catch(() => setFailed(true));
  }, []);
  return { manifest, failed };
}

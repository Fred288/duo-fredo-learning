import { trLower } from '../lib/turkish';

/**
 * Suchschlüssel für das Nachschlagewerk: tr-Kleinschreibung, alle diakritischen Zeichen weg
 * (ş→s, ğ→g, ç→c, ö→o, ü→u, ä→a, â→a), ı→i, ß→ss, ohne Apostroph (İstanbul'da), Satzzeichen
 * als Leerraum. Da I→ı→i und İ→i, sind alle vier i-Varianten gleich; deutsches „Ich“ wird „ich“.
 */
export const searchKey = (s: string): string =>
  trLower(s)
    .replace(/['’`]/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Wie `searchKey`, aber mit Sonderzeichen; nur fürs Ranking (genau getippt vor gefaltet). */
export const exactKey = (s: string): string =>
  trLower(s)
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

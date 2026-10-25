import { create } from 'zustand';
import { db, safely, type NoteRow } from '../db/db';

interface NotesState {
  notes: NoteRow[];
  load: () => Promise<void>;
  add: (itemId: string, unitId: string, text: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useNotes = create<NotesState>((set) => ({
  notes: [],
  load: async () => {
    const rows = await safely(() => db.notes.orderBy('at').reverse().toArray(), []);
    set((s) => ({
      notes: [...s.notes, ...rows.filter((r) => !s.notes.some((n) => n.id === r.id))],
    }));
  },
  add: async (itemId, unitId, text) => {
    const note: NoteRow = { itemId, unitId, text: text.trim(), at: Date.now() };
    if (!note.text) return;
    // Ohne IndexedDB bleibt die Notiz in dieser Sitzung (negative ID als Ersatz).
    const id = await safely(() => db.notes.add({ ...note }), -Date.now());
    set((s) => ({ notes: [{ ...note, id }, ...s.notes] }));
  },
  remove: async (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    await safely(() => db.notes.delete(id), undefined);
  },
}));

/** Text für die Zwischenablage: eine Zeile je Notiz, direkt als Korrekturliste verwendbar. */
export function notesAsText(notes: readonly NoteRow[]): string {
  return notes.map((n) => `${n.itemId}: ${n.text.replace(/\s+/g, ' ')}`).join('\n');
}

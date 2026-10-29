// Hörlektionen und Vorlese-Erkennung über die echten Inhalte in content/.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { speechText } from '../src/audio/speech-text';
import { annotateSpeech, courseWords } from '../src/audio/turkish-detect';
import { withListening } from '../src/content/listening';
import { Unit } from '../src/content/schema';
import { tileTokens } from '../src/session/grade';
import { checkListen, isUnitFile, parseUnitFile } from './content-checks';

const loaded = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
  .sort()
  .map((f) => ({
    file: f,
    unit: parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit!,
  }));
const words = courseWords(loaded.map(({ unit }) => unit));
const built = loaded.map(({ file, unit }) => ({
  file,
  unit: annotateSpeech(withListening(unit, 'Hören'), words),
}));
const exercises = built.flatMap(({ unit }) => unit.lessons.flatMap((l) => l.exercises));

describe('Hörlektionen aus content/', () => {
  it('jede Unit bekommt eine schema-gültige Hörlektion ohne Build-Fehler', () => {
    for (const { unit } of built) {
      expect(Unit.safeParse(unit).success).toBe(true);
      expect(unit.lessons.filter((l) => l.type === 'listening')).toHaveLength(1);
    }
    expect(checkListen(built)).toEqual([]);
  });

  it('jeder Text ist sprechbar, Bausteine enthalten jedes Wort des Satzes', () => {
    for (const ex of exercises) {
      if (ex.type !== 'listen') continue;
      expect(speechText(ex.text)).toBeTruthy();
      if (ex.mode === 'tiles') {
        const tokens = tileTokens([ex.text], ex.distractors, ex.id);
        expect(tokens.length).toBeGreaterThanOrEqual(ex.text.split(/\s+/).length);
      }
    }
  });
});

describe('Vorlesen bei Multiple Choice', () => {
  const mc = exercises.filter((e) => e.type === 'multiple_choice');

  it('findet die meisten türkischen Prompts', () => {
    expect(mc.filter((e) => e.speak_prompt).length / mc.length).toBeGreaterThan(0.6);
  });

  it('liest kein Deutsch vor (Stichproben)', () => {
    const byPrompt = (p: string) => mc.find((e) => e.prompt === p);
    expect(byPrompt('Was heißt „Hallo“?')?.speak_prompt).toBeUndefined();
    expect(byPrompt('Was heißt „Hallo“?')?.speak_answer).toBe(true);
    expect(byPrompt('Wer ist „hala“?')?.speak_prompt).toBe('hala');
    expect(byPrompt('Wer ist „hala“?')?.speak_answer).toBeUndefined();
    for (const e of mc) {
      if (e.speak_prompt) expect(e.speak_prompt).not.toMatch(/[äßÄ]/);
    }
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Lesson } from '../content/schema';
import { FakeSpeaker } from '../audio/fake';
import { setSpeaker } from '../store/audio';
import { LessonRunner } from './LessonRunner';

afterEach(cleanup);

const lesson: Lesson = {
  id: 'a1-u01-l1',
  type: 'vocab',
  title: 'Test',
  exercises: [
    {
      id: 'a1-u01-l1-e1',
      type: 'multiple_choice',
      prompt: 'Was heißt „Hallo“?',
      options: ['Merhaba', 'Hayır'],
      answer: 'Merhaba',
    },
    {
      id: 'a1-u01-l1-e2',
      type: 'free_text',
      direction: 'de_tr',
      prompt: 'Danke',
      answers: ['Teşekkürler'],
      hint: '„Sağ ol“ ist informell.',
    },
    // Noch nicht unterstützt (Phase 2) → wird übersprungen
    {
      id: 'a1-u01-l1-e3',
      type: 'segment',
      word: 'evde',
      segments: [
        { text: 'ev', role: 'Stamm' },
        { text: 'de', role: 'Lokativ' },
      ],
    },
  ],
};

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('LessonRunner', () => {
  it('führt durch die Lektion, wiederholt Fehler und zeigt das Ergebnis', () => {
    const onExit = vi.fn();
    render(<LessonRunner lesson={lesson} onExit={onExit} />);

    // MC falsch → Feedback mit Lösung, Wiederholung angekündigt
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Leider falsch.');
    expect(screen.getByRole('status').textContent).toContain('Lösung: Merhaba');
    expect(screen.getByRole('status').textContent).toContain('noch einmal');
    click('Weiter');

    // Freitext mit Sonderzeichen-Leiste
    const input = screen.getByLabelText('Deine Antwort');
    fireEvent.change(input, { target: { value: 'Te' } });
    click('ş einfügen');
    fireEvent.change(input, { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
    click('Weiter');

    // Wiederholung der MC-Aufgabe
    fireEvent.click(screen.getByLabelText(/Merhaba/));
    click('Prüfen');
    click('Weiter');

    expect(screen.getByRole('heading', { name: 'Lektion geschafft' })).toBeTruthy();
    expect(screen.getByText('1 von 2 beim ersten Versuch richtig')).toBeTruthy();
    click('Zur Übersicht');
    expect(onExit).toHaveBeenCalled();
  });

  it('meldet Versuche einmal je Übung und den Abschluss genau einmal', () => {
    const onAttempt = vi.fn();
    const onComplete = vi.fn();
    render(
      <LessonRunner
        lesson={lesson}
        onExit={() => {}}
        onAttempt={onAttempt}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Hayır/)); // falsch
    click('Prüfen');
    click('Weiter');
    fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    click('Weiter');
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Merhaba/)); // Wiederholung der MC-Aufgabe
    click('Prüfen');
    click('Weiter');

    expect(onAttempt.mock.calls.map(([ex, verdict]) => [ex.id, verdict])).toEqual([
      ['a1-u01-l1-e1', 'wrong'],
      ['a1-u01-l1-e2', 'correct'],
    ]); // Wiederholung wird nicht als neuer Versuch gezählt
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(1, 2);
  });

  it('erlaubt Prüfen erst mit Antwort', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Prüfen' }).hasAttribute('disabled')).toBe(true);
  });

  it('prüft mit Enter, auch wenn der angetippte Baustein den Fokus hält', () => {
    const wb: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e9',
          type: 'word_bank',
          prompt: 'Guten Morgen!',
          answers: ['Günaydın!'],
          distractors: ['İyi'],
        },
      ],
    };
    render(<LessonRunner lesson={wb} onExit={() => {}} />);
    const tile = screen.getByRole('button', { name: 'Günaydın' });
    fireEvent.click(tile);
    expect(tile.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('baut Wortformen im Suffix-Builder und begründet die Regel', () => {
    const sbLesson: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e8',
          type: 'suffix_builder',
          stem: 'kitap',
          suffixes: ['ACC'],
          target: 'kitabı',
          gloss_de: 'das Buch',
        },
      ],
    };
    const vocab = [{ tr: 'kitap', de: ['Buch'], pos: 'noun' as const, softens: true }];
    render(<LessonRunner lesson={sbLesson} vocab={vocab} onExit={() => {}} />);
    expect(screen.getByText('kitap + Akkusativ')).toBeTruthy();
    // erst falsch (ungeänderter Stamm), dann richtig nach Wiederholung
    fireEvent.click(screen.getByRole('button', { name: 'kitap' }));
    fireEvent.click(screen.getByRole('button', { name: 'ı' }));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Lösung: kitabı');
    expect(screen.getByRole('status').textContent).toContain(
      'Auslaut „p“ wird vor einem Vokal zu „b“',
    );
    click('Weiter');
    fireEvent.click(screen.getByRole('button', { name: 'kitab' }));
    fireEvent.click(screen.getByRole('button', { name: 'ı' }));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('Konjugation: verneinte Form bauen und Verengung begründen', () => {
    const conjLesson: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e7',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          negative: true,
          target: 'gelmiyorum',
          gloss_de: 'ich komme nicht',
        },
      ],
    };
    render(<LessonRunner lesson={conjLesson} onExit={() => {}} />);
    expect(screen.getByText('gelmek · ich · verneint')).toBeTruthy();
    for (const tile of ['gel', 'mi', 'yor', 'um']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Richtig!');
    expect(status).toContain('Vor -yor wird die Verneinung -me/-ma zu „mi“');
  });

  it('Konjugation im Präteritum: Zeit in der Formel, Begründung der Angleichung', () => {
    const past: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e5',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'yapmak',
          person: '1sg',
          tense: 'past',
          target: 'yaptım',
          gloss_de: 'ich habe gemacht',
        },
      ],
    };
    render(<LessonRunner lesson={past} onExit={() => {}} />);
    expect(screen.getByText('yapmak · ich · Präteritum')).toBeTruthy();
    for (const tile of ['yap', 'tı', 'm']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Richtig!');
    expect(status).toContain('Nach stimmlosem „p“ wird d zu t');
  });

  it('Konjugation mit „können“: Formel und Begründung des Aorist-Vokals', () => {
    const ability: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e4',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          tense: 'aorist',
          ability: true,
          target: 'gelebilirim',
        },
      ],
    };
    render(<LessonRunner lesson={ability} onExit={() => {}} />);
    expect(screen.getByText('gelmek · ich · können · Aorist')).toBeTruthy();
    for (const tile of ['gel', 'ebil', 'ir', 'im']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Richtig!');
    expect(status).toContain('-ebil endet auf bil');
  });

  it('Tabelle: markiert falsche Zellen und begründet nur diese', () => {
    const parLesson: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e6',
          type: 'paradigm',
          kind: 'noun',
          lemma: 'park',
          rows: [['LOC'], ['DAT'], ['ABL']],
          targets: ['parkta', 'parka', 'parktan'],
        },
      ],
    };
    render(<LessonRunner lesson={parLesson} onExit={() => {}} />);
    const check = screen.getByRole('button', { name: 'Prüfen' });
    fireEvent.change(screen.getByLabelText('Lokativ'), { target: { value: 'parkda' } });
    fireEvent.change(screen.getByLabelText('Dativ'), { target: { value: 'parka' } });
    expect(check.hasAttribute('disabled')).toBe(true); // noch ein Feld leer
    fireEvent.change(screen.getByLabelText('Ablativ'), { target: { value: 'parktan' } });
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Leider falsch.');
    expect(status).toContain('Lokativ');
    expect(status).not.toContain('Ablativ');
    expect(screen.getByText('✗ richtig: parkta')).toBeTruthy();
    expect(screen.getByLabelText('Dativ').getAttribute('aria-invalid')).toBe('false');
  });

  it('wählt MC-Optionen per Zifferntaste und prüft mit Enter', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });
});

describe('LessonRunner Grammatik-Hinweis', () => {
  const section = { title: 'Begrüßen', body: '- **Merhaba** – Hallo' };

  it('zeigt den Abschnitt der Erklärkarte nur nach einer falschen Antwort', () => {
    const grammarFor = vi.fn(() => section);
    render(<LessonRunner lesson={lesson} onExit={() => {}} grammarFor={grammarFor} />);
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    expect(screen.getByText('Grammatik: Begrüßen')).toBeTruthy();
    expect(screen.getByText('Merhaba', { selector: 'strong' })).toBeTruthy();
    click('Weiter');

    fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    expect(screen.queryByText('Grammatik: Begrüßen')).toBeNull();
  });

  describe('Hörübungen', () => {
    const listening: Lesson = {
      id: 'a1-u01-h1',
      type: 'listening',
      title: 'Hören',
      exercises: [
        {
          id: 'a1-u01-h1-e1',
          type: 'listen',
          mode: 'dictation',
          text: 'Günaydın',
          gloss_de: 'Guten Morgen',
        },
        {
          id: 'a1-u01-h1-e2',
          type: 'listen',
          mode: 'meaning',
          text: 'Merhaba',
          options: ['Hallo', 'Danke'],
          answer: 'Hallo',
        },
      ],
    };

    it('mit Stimme: Diktat lösen, Text erscheint erst nach der Antwort', () => {
      const speaker = new FakeSpeaker('ready');
      setSpeaker(speaker);
      render(<LessonRunner lesson={listening} onExit={() => {}} />);
      expect(screen.queryByText('Günaydın')).toBeNull();
      click('Anhören');
      expect(speaker.spoken).toEqual([{ text: 'Günaydın', rate: 'normal' }]);
      fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'günaydin' } });
      click('Prüfen');
      expect(screen.getAllByText('Günaydın').length).toBeGreaterThan(0);
      expect(screen.getByText('„Guten Morgen“')).toBeTruthy();
    });

    it('Verlassen bricht eine laufende Ansage ab', () => {
      const speaker = new FakeSpeaker('ready');
      setSpeaker(speaker);
      const { unmount } = render(<LessonRunner lesson={listening} onExit={() => {}} />);
      const before = speaker.cancelled;
      unmount();
      expect(speaker.cancelled).toBeGreaterThan(before);
    });

    it('ohne Stimme: Hörübungen fehlen im Durchgang', () => {
      setSpeaker(new FakeSpeaker('no-voice'));
      render(<LessonRunner lesson={listening} onExit={() => {}} />);
      expect(screen.getByRole('heading', { name: /brauchen eine türkische Stimme/ })).toBeTruthy();
    });

    it('Jetzt nicht hören beendet ohne Abschluss und ohne Versuch', () => {
      setSpeaker(new FakeSpeaker('ready'));
      const onAttempt = vi.fn();
      const onComplete = vi.fn();
      render(
        <LessonRunner
          lesson={listening}
          onExit={() => {}}
          onAttempt={onAttempt}
          onComplete={onComplete}
        />,
      );
      click('Jetzt nicht hören');
      expect(screen.getByRole('heading', { name: 'Übersprungen' })).toBeTruthy();
      expect(onAttempt).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});

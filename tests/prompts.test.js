import { describe, it, expect } from 'vitest';
import ConversationPrompts from '../js/ai/prompts.js';

const ALL_SCENARIOS = [
  'restaurant', 'travel', 'shopping', 'family', 'work', 'health', 'emergency',
  'cafe', 'smalltalk', 'bank', 'techsupport', 'apartment', 'salon', 'gym', 'school', 'celebration'
];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

describe('ConversationPrompts scenarios', () => {
  const prompts = new ConversationPrompts();

  it('defines all 16 scenarios (7 original + 9 added for Issue #6)', () => {
    for (const scenario of ALL_SCENARIOS) {
      expect(prompts.systemPrompts.scenarios[scenario]).toBeTruthy();
    }
    expect(Object.keys(prompts.systemPrompts.scenarios)).toHaveLength(ALL_SCENARIOS.length);
  });

  it('generateSystemPrompt includes the scenario-specific content for every scenario', () => {
    for (const scenario of ALL_SCENARIOS) {
      const prompt = prompts.generateSystemPrompt(scenario, 'beginner');
      expect(prompt).toContain(prompts.systemPrompts.scenarios[scenario]);
    }
  });

  it('getConversationStarters returns a non-empty string for every scenario at every difficulty', () => {
    for (const scenario of ALL_SCENARIOS) {
      for (const difficulty of DIFFICULTIES) {
        const starter = prompts.getConversationStarters(scenario, difficulty);
        expect(typeof starter).toBe('string');
        expect(starter.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to restaurant/beginner starters for an unrecognized scenario or difficulty', () => {
    expect(() => prompts.getConversationStarters('nonexistent', 'expert')).not.toThrow();
    const fallback = prompts.getConversationStarters('nonexistent', 'expert');
    const restaurantBeginnerStarters = [
      "¡Hola! ¡Bienvenido al restaurante! ¿Mesa para cuántas personas?",
      "¡Buenos días! ¿Tiene reserva?",
      "¡Buenas tardes! ¿Prefiere mesa o barra?"
    ];
    expect(restaurantBeginnerStarters).toContain(fallback);
  });
});

// PLAN Stage 3a: the tutor speaks Mexican Spanish (DECISIONS 2026-11-24).
// The persona used to say "española/latinoamericana" and its examples mixed
// Spain and Mexico, which invites a speech-to-speech model's accent to drift.
describe('Mexican Spanish dialect', () => {
  const prompts = new ConversationPrompts();

  const allSystemPrompts = () =>
    ALL_SCENARIOS.flatMap((scenario) =>
      DIFFICULTIES.map((difficulty) => ({
        label: `${scenario}/${difficulty}`,
        text: prompts.generateSystemPrompt(scenario, difficulty, [{ spanish: 'agua', english: 'water' }]),
      }))
    );

  const allStarters = () =>
    Object.entries(prompts.getAllConversationStarters()).flatMap(([scenario, byLevel]) =>
      Object.entries(byLevel).flatMap(([level, lines]) =>
        lines.map((text) => ({ label: `starter ${scenario}/${level}`, text }))
      )
    );

  const everyText = () => [...allSystemPrompts(), ...allStarters()];

  // Unicode-aware word boundaries: JavaScript's \b treats accented letters as
  // non-word characters, so /\bos\b/ falsely matches inside "cumpleaños".
  const word = (alternatives) => new RegExp(`(?<!\\p{L})(${alternatives})(?!\\p{L})`, 'iu');

  function offenders(pattern) {
    return everyText()
      .filter(({ text }) => pattern.test(text))
      .map(({ label, text }) => `${label}: …${text.match(pattern)[0]}…`);
  }

  it('includes an explicit Mexican Spanish instruction in every system prompt', () => {
    const instruction = prompts.getDialectPrompt();
    expect(instruction).toMatch(/México|mexican/i);
    expect(instruction).toContain('ustedes');
    for (const { label, text } of allSystemPrompts()) {
      expect(text, label).toContain(instruction);
    }
  });

  it('no longer describes the tutor or setting as Spain/Latin America in general', () => {
    expect(offenders(/español(a)?\/latinoamerican[oa]/i)).toEqual([]);
  });

  it('never refers to Spain as the setting', () => {
    expect(offenders(word('España'))).toEqual([]);
  });

  it('drops the stage-direction instruction the model could speak aloud', () => {
    expect(offenders(/gestos descriptivos/i)).toEqual([]);
  });

  it('uses no vosotros forms', () => {
    expect(offenders(word('vosotr[oa]s|os|habéis|tenéis|queréis|sois|estáis'))).toEqual([]);
  });

  it('uses Mexican rather than Spain vocabulary for the terms the scenarios need', () => {
    // Spain term -> the Mexican term used instead: camarero/a -> mesero/a,
    // estancia -> estadía, alquiler -> renta, fianza -> depósito,
    // apartamento -> departamento.
    expect(offenders(word('camarer[oa]s?|estancia|alquiler|fianza|apartamentos?'))).toEqual([]);
  });

  it('getConversationStarters still picks from the full starter list', () => {
    const all = prompts.getAllConversationStarters();
    for (const scenario of ALL_SCENARIOS) {
      for (const difficulty of DIFFICULTIES) {
        expect(all[scenario][difficulty]).toContain(prompts.getConversationStarters(scenario, difficulty));
      }
    }
  });
});

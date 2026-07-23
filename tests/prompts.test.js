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

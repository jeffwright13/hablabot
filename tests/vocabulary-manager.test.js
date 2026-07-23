import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../js/utils/helpers.js'; // side effect: sets window.H, which manager.js reads as a bare global
import VocabularyManager from '../js/vocabulary/manager.js';

function makeMockDatabase(initialItems = []) {
  let items = [...initialItems];
  return {
    getAll: async () => items,
    put: async (storeName, item) => {
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item; else items.push(item);
    },
    delete: async (storeName, id) => {
      items = items.filter(i => i.id !== id);
    },
    addVocabularyItem: async (item) => {
      const id = 'test-' + Math.random().toString(36).slice(2);
      items.push({ ...item, id });
      return id;
    },
  };
}

const SEED = [
  { id: '1', spanish: 'menú', english: 'menu', category: 'food', difficulty: 1, tags: [] },
  { id: '2', spanish: 'hotel', english: 'hotel', category: 'travel', difficulty: 2, tags: [] },
  { id: '3', spanish: 'familia', english: 'family', category: 'family', difficulty: 1, tags: ['home'] },
];

async function makeManager(seed = SEED) {
  const manager = new VocabularyManager();
  await manager.init(makeMockDatabase(seed));
  return manager;
}

describe('VocabularyManager filtering', () => {
  let manager;

  beforeEach(async () => {
    manager = await makeManager();
  });

  it('loads the full list on init with no filters applied', () => {
    expect(manager.getFilteredList()).toHaveLength(3);
  });

  it('searchVocabulary matches on the Spanish word', () => {
    const results = manager.searchVocabulary('men');
    expect(results.map(w => w.id)).toEqual(['1']);
  });

  it('searchVocabulary matches on tags', () => {
    const results = manager.searchVocabulary('home');
    expect(results.map(w => w.id)).toEqual(['3']);
  });

  it('filterByCategory narrows to that category only', () => {
    const results = manager.filterByCategory('travel');
    expect(results.map(w => w.id)).toEqual(['2']);
  });

  it('filterByDifficulty narrows to that difficulty only', () => {
    const results = manager.filterByDifficulty('2');
    expect(results.map(w => w.id)).toEqual(['2']);
  });

  it('clearFilters restores the full list', () => {
    manager.filterByCategory('travel');
    manager.clearFilters();
    expect(manager.getFilteredList()).toHaveLength(3);
  });

  it('filters combine (category + search) rather than replacing each other', () => {
    manager.filterByCategory('food');
    const results = manager.searchVocabulary('menú');
    expect(results.map(w => w.id)).toEqual(['1']);
  });
});

describe('VocabularyManager.importFromCSV', () => {
  let manager;

  beforeEach(async () => {
    manager = await makeManager();
  });

  it('imports valid rows and adds them to the vocabulary list', async () => {
    const csv = 'spanish,english,phonetic,difficulty,category\nplaya,beach,,1,travel';
    const result = await manager.importFromCSV(csv);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.errors).toBe(0);
    expect(manager.getAllVocabulary().some(w => w.spanish === 'playa')).toBe(true);
  });

  it('rejects a row missing a required field', async () => {
    const csv = 'spanish,english\n,no spanish word';
    const result = await manager.importFromCSV(csv);

    expect(result.imported).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.errorDetails[0]).toMatch(/Missing Spanish or English/);
  });

  it('rejects a row that duplicates an existing Spanish word', async () => {
    const csv = 'spanish,english\nmenú,menu (again)';
    const result = await manager.importFromCSV(csv);

    expect(result.imported).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.errorDetails[0]).toMatch(/already exists/);
  });
});

describe('VocabularyManager.selectWordsForSession', () => {
  let manager;

  beforeEach(async () => {
    manager = await makeManager();
  });

  it('filters candidates to the requested difficulty tier', () => {
    // intermediate maps to difficulties [3, 4]; the seed set only has
    // difficulty 1 (menú, familia) and 2 (hotel) words, so none qualify.
    const selected = manager.selectWordsForSession({ difficulty: 'intermediate', maxWords: 10 });
    expect(selected).toEqual([]);
  });

  it('returns beginner-difficulty words for the beginner tier', () => {
    // beginner maps to difficulties [1, 2], which covers the whole seed set.
    const selected = manager.selectWordsForSession({ difficulty: 'beginner', maxWords: 10 });
    expect(selected.map(w => w.id).sort()).toEqual(['1', '2', '3']);
  });

  it('filters by scenario, matching either category or tags', () => {
    const selected = manager.selectWordsForSession({ difficulty: 'mixed', scenario: 'travel', maxWords: 10 });
    expect(selected.map(w => w.id)).toEqual(['2']);
  });

  it('caps the result at maxWords', () => {
    const selected = manager.selectWordsForSession({ difficulty: 'mixed', maxWords: 1 });
    expect(selected).toHaveLength(1);
  });

  it('defaults to mixed difficulty and no scenario filter, returning up to 5 words', () => {
    const selected = manager.selectWordsForSession();
    expect(selected.length).toBeLessThanOrEqual(5);
    expect(selected.length).toBe(3); // fewer than 5 words exist in the seed set
  });
});

describe('VocabularyManager.exportToCSV', () => {
  it('generates a CSV row per vocabulary item and hands it to H.downloadFile', async () => {
    const manager = await makeManager();
    const downloadSpy = vi.spyOn(window.H, 'downloadFile').mockImplementation(() => {});

    const result = manager.exportToCSV();

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [csvContent, filename, mimeType] = downloadSpy.mock.calls[0];
    expect(mimeType).toBe('text/csv');
    expect(filename).toMatch(/^hablabot-vocabulary-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csvContent).toContain('"menú"');
    expect(csvContent).toContain('"hotel"');
    expect(result.exported).toBe(3);

    downloadSpy.mockRestore();
  });
});

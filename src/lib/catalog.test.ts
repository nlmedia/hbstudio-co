import { describe, it, expect } from 'vitest';
// Imported from catalogNormalize directly, not catalog.ts: catalog.ts creates
// a Supabase client at module scope (createClient(import.meta.env...)),
// which throws outside a build/dev context. The pure mapping logic under
// test here lives in catalogNormalize.ts precisely so it doesn't need one.
import { normalize } from './catalogNormalize';

/**
 * Locks down the per-field French-with-English-fallback rule applied in
 * normalize() -- the only piece of logic in catalog.ts worth testing in
 * isolation, since it is what keeps a partially-translated template row
 * from ever rendering half-empty, `null`, or with a blank features/tags
 * list on /fr/.
 */
describe('normalize() — French fallback', () => {
  const baseRow = {
    slug: 'atelier',
    title: 'Atelier',
    cms: 'shopify',
    tagline: 'A calm, editorial Shopify theme.',
    description: 'Built for small studios that sell a focused catalogue.',
    body: 'Paragraph one.\n\nParagraph two.',
    status: 'published',
    features: ['Fast checkout', 'Editorial blog', 'Mobile-first'],
    tags: ['Shopify', 'Editorial'],
  };

  it('English locale is a pass-through and ignores any _fr columns', () => {
    const row = {
      ...baseRow,
      title_fr: 'Atelier FR',
      tagline_fr: 'Une accroche.',
      description_fr: 'Une description.',
      body_fr: 'Paragraphe.',
      features_fr: ['Une fonctionnalite'],
      tags_fr: ['Tag FR'],
    };
    const { data } = normalize(row, 'en');
    expect(data.title).toBe('Atelier');
    expect(data.tagline).toBe(baseRow.tagline);
    expect(data.description).toBe(baseRow.description);
    expect(data.body).toBe(baseRow.body);
    expect(data.features).toEqual(baseRow.features);
    expect(data.tags).toEqual(baseRow.tags);
  });

  it('all six French fields filled in: French wins for every field', () => {
    const row = {
      ...baseRow,
      title_fr: 'Atelier (FR)',
      tagline_fr: 'Un theme Shopify calme et editorial.',
      description_fr: 'Concu pour les petits studios au catalogue resserre.',
      body_fr: 'Paragraphe un.\n\nParagraphe deux.',
      features_fr: ['Paiement rapide', 'Blog editorial', 'Mobile-first'],
      tags_fr: ['Shopify', 'Editorial'],
    };
    const { data } = normalize(row, 'fr');
    expect(data.title).toBe('Atelier (FR)');
    expect(data.tagline).toBe(row.tagline_fr);
    expect(data.description).toBe(row.description_fr);
    expect(data.body).toBe(row.body_fr);
    expect(data.features).toEqual(row.features_fr);
    expect(data.tags).toEqual(row.tags_fr);
  });

  it('no French fields filled in (all undefined): every field falls back to English', () => {
    const { data } = normalize({ ...baseRow }, 'fr');
    expect(data.title).toBe(baseRow.title);
    expect(data.tagline).toBe(baseRow.tagline);
    expect(data.description).toBe(baseRow.description);
    expect(data.body).toBe(baseRow.body);
    expect(data.features).toEqual(baseRow.features);
    expect(data.tags).toEqual(baseRow.tags);
  });

  it('only tagline_fr filled in: French tagline, English everywhere else (per-field, not per-row)', () => {
    const row = { ...baseRow, tagline_fr: 'Un theme Shopify calme et editorial.' };
    const { data } = normalize(row, 'fr');
    expect(data.tagline).toBe(row.tagline_fr);
    expect(data.title).toBe(baseRow.title);
    expect(data.description).toBe(baseRow.description);
    expect(data.body).toBe(baseRow.body);
    expect(data.features).toEqual(baseRow.features);
    expect(data.tags).toEqual(baseRow.tags);
  });

  it('empty string French fields are treated as absent, not as a valid (blank) translation', () => {
    const row = { ...baseRow, title_fr: '', tagline_fr: '   ', description_fr: '', body_fr: '' };
    const { data } = normalize(row, 'fr');
    expect(data.title).toBe(baseRow.title);
    expect(data.tagline).toBe(baseRow.tagline);
    expect(data.description).toBe(baseRow.description);
    expect(data.body).toBe(baseRow.body);
  });

  it('empty array French lists fall back to English rather than wiping out the list', () => {
    const row = { ...baseRow, features_fr: [], tags_fr: [] };
    const { data } = normalize(row, 'fr');
    expect(data.features).toEqual(baseRow.features);
    expect(data.tags).toEqual(baseRow.tags);
  });

  it('null French fields (as stored by nullable DB columns) fall back to English', () => {
    const row = {
      ...baseRow,
      title_fr: null,
      tagline_fr: null,
      description_fr: null,
      body_fr: null,
      features_fr: null,
      tags_fr: null,
    };
    const { data } = normalize(row, 'fr');
    expect(data.title).toBe(baseRow.title);
    expect(data.tagline).toBe(baseRow.tagline);
    expect(data.description).toBe(baseRow.description);
    expect(data.body).toBe(baseRow.body);
    expect(data.features).toEqual(baseRow.features);
    expect(data.tags).toEqual(baseRow.tags);
  });
});

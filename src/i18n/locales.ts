// Locale constants, kept in their own module so both `index.ts` (dictionaries)
// and `routing.ts` (URL helpers) can depend on them without importing each
// other.
export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

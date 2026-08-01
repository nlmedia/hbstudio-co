import { en, type Dictionary } from './en';
import { fr } from './fr';
import { LOCALES, DEFAULT_LOCALE, type Locale } from './locales';

export { LOCALES, DEFAULT_LOCALE };
export type { Locale };

const dictionaries: Record<Locale, Dictionary> = { en, fr };

/**
 * Translation helper. Returns the full, fully-typed dictionary for a locale
 * so call sites get `t.nav.templates`-style access with autocomplete and
 * compile-time key checking — no untyped `t('nav.templates')` string keys.
 */
export function useTranslations(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type { Dictionary };
export { getLocaleFromPath, stripLocalePrefix, localizePath, getAlternatePath } from './routing';

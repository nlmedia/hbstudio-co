// URL <-> locale helpers.
//
// English is the default locale and is never prefixed (`/templates/atelier`).
// French is prefixed with `/fr` (`/fr/templates/atelier`). These helpers are
// the single source of truth for that mapping so the header's language
// switcher, the layout's hreflang tags and any future page all agree on it.
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

const FR_PREFIX = '/fr';

/** Ensure a leading slash and strip any trailing slash (root stays `/`). */
function normalize(pathname: string): string {
  let p = pathname || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** Detect the locale a given pathname belongs to. Anything not under `/fr` is English. */
export function getLocaleFromPath(pathname: string): Locale {
  const p = normalize(pathname);
  if (p === FR_PREFIX || p.startsWith(`${FR_PREFIX}/`)) return 'fr';
  return DEFAULT_LOCALE;
}

/**
 * Strip the locale prefix, returning the locale-neutral path.
 * `/fr` and `/fr/` both collapse to `/`, matching the root special case.
 */
export function stripLocalePrefix(pathname: string): string {
  const p = normalize(pathname);
  if (p === FR_PREFIX) return '/';
  if (p.startsWith(`${FR_PREFIX}/`)) return p.slice(FR_PREFIX.length) || '/';
  return p;
}

/** Build the URL for `pathname`'s content in `locale` (accepts a prefixed or bare path in). */
export function localizePath(pathname: string, locale: Locale): string {
  const bare = stripLocalePrefix(pathname);
  if (locale === DEFAULT_LOCALE) return bare;
  return bare === '/' ? FR_PREFIX : `${FR_PREFIX}${bare}`;
}

/** Given the current pathname, build the equivalent URL in the *other* locale. */
export function getAlternatePath(pathname: string): string {
  const current = getLocaleFromPath(pathname);
  const other = LOCALES.find((l) => l !== current) ?? DEFAULT_LOCALE;
  return localizePath(pathname, other);
}

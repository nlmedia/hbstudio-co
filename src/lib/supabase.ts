import { createServerClient, createBrowserClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const URL = import.meta.env.PUBLIC_SUPABASE_URL;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/** Server-side Supabase client wired to Astro cookies (SSR auth). */
export function createSupabaseServer(cookies: AstroCookies, headers: Headers) {
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        const header = headers.get('cookie') ?? '';
        return header
          .split(';')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const i = c.indexOf('=');
            return { name: c.slice(0, i), value: decodeURIComponent(c.slice(i + 1)) };
          });
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, { ...options, path: '/' });
        });
      },
    },
  });
}

/** Browser Supabase client (cookie storage so the server can read the session). */
export function createSupabaseBrowser() {
  return createBrowserClient(URL, KEY);
}

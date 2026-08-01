// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// Static by default (marketing pages prerendered); /admin routes opt into
// on-demand server rendering via `export const prerender = false`.
export default defineConfig({
  site: 'https://hbstudio-co.netlify.app',
  output: 'static',
  adapter: netlify(),
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      // English (default) has no URL prefix: /templates.
      // French is prefixed: /fr/templates.
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

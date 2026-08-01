// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static by default (marketing pages prerendered); /admin routes opt into
// on-demand server rendering via `export const prerender = false`.
export default defineConfig({
  // Astro does not read PORT on its own. Honouring it lets the preview harness
  // assign a free port instead of colliding with another session's server.
  server: { port: Number(process.env.PORT) || 4321 },
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
  integrations: [
    sitemap({
      // /admin is on-demand (prerender = false) and auth-gated: it still
      // shows up as a resolved "page" route, so without this filter it
      // would leak into the public sitemap even though it's never
      // statically built.
      filter: (page) => !new URL(page).pathname.startsWith('/admin/'),
      // Pairs same-path en/fr pages together so each <url> entry gets an
      // <xhtml:link rel="alternate"> to its counterpart, mirroring the
      // hreflang tags already emitted in Base.astro. The `en` key is only
      // used to label default-locale entries in that output — the actual
      // URL match for French is the `/fr` prefix declared under `fr`.
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', fr: 'fr' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

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
  vite: {
    plugins: [tailwindcss()],
  },
});

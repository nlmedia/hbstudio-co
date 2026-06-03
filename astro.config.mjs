// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build
export default defineConfig({
  site: 'https://hbstudio-co.netlify.app',
  vite: {
    plugins: [tailwindcss()],
  },
});

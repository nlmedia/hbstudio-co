# HB Studio Co — template marketplace

The agency site & template marketplace for **HB Studio Co**. Sells premium,
conversion-ready website templates across multiple platforms (Shopify, WordPress,
WooCommerce — more to come).

Built with **Astro 5 + Tailwind CSS 4**. Static output, deploys to **Netlify**.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview
```

## Add a template

Create a Markdown file in `src/content/templates/<slug>.md`:

```md
---
title: My Theme
cms: shopify          # shopify | wordpress | woocommerce | other
tagline: One-line pitch.
description: Longer paragraph.
price: 69             # or null for coming-soon
status: available     # or coming-soon
featured: true
order: 2
cover: /templates/my-theme/cover.jpg
gallery: [/templates/my-theme/1.jpg, /templates/my-theme/2.jpg]
features: ["Feature A", "Feature B"]
tags: [fashion, minimal]
demoUrl: "https://demo..."
buyUrl: "https://gumroad..."
docsUrl: "https://..."
---
Body content (Markdown) shown on the template page.
```

Put images in `public/templates/<slug>/`. The card, category page and detail
page update automatically.

## Categories

Defined in `src/data/cms.ts`. Add a new platform there and it appears in the
nav, footer, home grid and gets its own `/category/<key>` page.

## Deploy (Netlify)

- Connect this repo in Netlify → it reads `netlify.toml` (build `npm run build`, publish `dist`).
- The contact form uses **Netlify Forms** (no backend) — submissions appear in the Netlify dashboard.

© HB Studio Co.

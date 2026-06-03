import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const templates = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/templates' }),
  schema: z.object({
    title: z.string(),
    cms: z.enum(['shopify', 'wordpress', 'woocommerce', 'other']),
    tagline: z.string(),
    description: z.string(),
    price: z.number().nullable().default(null),
    currency: z.string().default('€'),
    status: z.enum(['available', 'coming-soon']).default('available'),
    featured: z.boolean().default(false),
    order: z.number().default(100),
    cover: z.string().optional(),
    preview: z.string().optional(), // tall full-page capture for the 3D scrolling mockup
    gallery: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    demoUrl: z.string().optional(),
    buyUrl: z.string().optional(),
    docsUrl: z.string().optional(),
  }),
});

export const collections = { templates };

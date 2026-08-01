import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests live in tests/, never in netlify/functions/: Netlify registers
    // every file in that directory as a deployable function, and a name
    // containing a dot (`_pricing.test`) is rejected -- the whole deploy
    // fails with a 422 that never mentions tests.
    include: ['src/**/*.test.{ts,mjs}', 'tests/**/*.test.{ts,mjs}'],
  },
});

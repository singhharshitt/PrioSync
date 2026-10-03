import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.js'],
        // Neon round-trips are ~250ms from most dev machines; integration files opt in via RUN_PG_TESTS.
        testTimeout: 60000,
        hookTimeout: 30000,
    },
});

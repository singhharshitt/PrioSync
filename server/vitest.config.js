import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.js'],
        // No network in unit tests; 60s is generous safety for any async work.
        testTimeout: 60000,
        hookTimeout: 30000,
    },
});

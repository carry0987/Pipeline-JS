import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    test: {
        environment: 'node',
        coverage: {
            // Test coverage options
            reporter: ['text', 'json', 'html'],
        }
    },
});

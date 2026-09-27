import { defineConfig } from 'vite';

// Relative paths work on both username.github.io and username.github.io/repository/.
export default defineConfig({ base: './', build: { target: 'es2022' } });

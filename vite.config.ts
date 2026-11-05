// FILE: Build settings for Vite (the tool that runs the dev server and builds the app).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' makes the built site work from any address, e.g. https://<user>.github.io/<repo>/
export default defineConfig({ base: './', plugins: [react()] });

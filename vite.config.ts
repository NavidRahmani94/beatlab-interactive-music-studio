// FILE: Build settings for Vite (the tool that runs the dev server and builds the app).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inspectBabel, inspectGraph } from './vite-plugins/inspect.mjs';
// base './' makes the built site work from any address, e.g. https://<user>.github.io/<repo>/
// The two inspect plugins only feed the INSPECT button in the page header (file and line of every element, and a map of the source files).
export default defineConfig({ base: './', plugins: [react({ babel: { plugins: [inspectBabel()] } }), inspectGraph(new URL('./src', import.meta.url))] });

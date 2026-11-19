// The kokeshi collection: its own page, built into kokeshi/dist (the models in kokeshi/public/models go with it).
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
export default { root: here, base: './', build: { target: 'es2022', outDir: `${here}dist`, emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 4000, modulePreload: { polyfill: false } } };

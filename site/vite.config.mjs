// The Ramayana site: its own page, built apart from the game into site/dist.
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
export default { root: here, base: './', build: { target: 'es2022', outDir: `${here}dist`, emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 4000, modulePreload: { polyfill: false } } };

import { build } from 'esbuild';

await build({
  entryPoints: ['src/core/reducer.ts'],
  outfile: 'public/js/reducer.bundle.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: process.env.NODE_ENV !== 'production',
});

console.log('[bundle] reducer.bundle.js generated');

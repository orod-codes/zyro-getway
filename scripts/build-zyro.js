const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'zyro', 'browser-entry.js');
const outFile = path.join(root, 'dist', 'zyro.js');

const esbuild = require('esbuild');

fs.mkdirSync(path.dirname(outFile), { recursive: true });

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: 'Zyro',
  outfile: outFile,
  platform: 'browser',
  target: ['es2020'],
});

console.log('Built', outFile);

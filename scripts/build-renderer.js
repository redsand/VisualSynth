const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist/renderer');
const srcDir = path.join(root, 'src/renderer');

fs.mkdirSync(outDir, { recursive: true });

const copyStatic = () => {
  for (const file of ['index.html', 'style.css']) {
    fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
  }
};

const build = () => {
  return esbuild.build({
    entryPoints: [path.join(srcDir, 'index.ts')],
    bundle: true,
    sourcemap: true,
    outfile: path.join(outDir, 'index.js'),
    platform: 'browser',
    target: ['chrome120'],
    define: {
      'process.env.NODE_ENV': watch ? '"development"' : '"production"'
    }
  });
};

const run = async () => {
  copyStatic();
  if (watch) {
    const ctx = await esbuild.context({
      entryPoints: [path.join(srcDir, 'index.ts')],
      bundle: true,
      sourcemap: true,
      outfile: path.join(outDir, 'index.js'),
      platform: 'browser',
      target: ['chrome120'],
      define: {
        'process.env.NODE_ENV': '"development"'
      }
    });
    await ctx.watch();
    fs.watch(srcDir, { recursive: true }, (event, filename) => {
      if (!filename) return;
      if (filename.endsWith('.html') || filename.endsWith('.css')) {
        copyStatic();
      }
    });
  } else {
    await build();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

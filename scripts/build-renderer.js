const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist/renderer');
const srcDir = path.join(root, 'src/renderer');

fs.mkdirSync(outDir, { recursive: true });

const copyStatic = () => {
  for (const file of ['index.html', 'style.css', 'output.html', 'output.css']) {
    fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
  }
  fs.copyFileSync(
    path.join(root, 'resources', 'visualsynth_logo-transparent.png'),
    path.join(outDir, 'visualsynth_logo-transparent.png')
  );
};

const build = () => {
  return esbuild.build({
    entryPoints: [path.join(srcDir, 'index.ts'), path.join(srcDir, 'output.ts')],
    bundle: true,
    sourcemap: true,
    outdir: outDir,
    entryNames: '[name]',
    platform: 'browser',
    target: ['chrome120'],
    external: ['@novnc/novnc', '@novnc/novnc/*'],
    define: {
      'process.env.NODE_ENV': watch ? '"development"' : '"production"'
    }
  });
};

const run = async () => {
  copyStatic();
  if (watch) {
    const ctx = await esbuild.context({
      entryPoints: [path.join(srcDir, 'index.ts'), path.join(srcDir, 'output.ts')],
      bundle: true,
      sourcemap: true,
      outdir: outDir,
      entryNames: '[name]',
      platform: 'browser',
      target: ['chrome120'],
      external: ['@novnc/novnc', '@novnc/novnc/*'],
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

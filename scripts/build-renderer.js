const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const entryArg = process.argv.find((arg) => arg.startsWith('--entry='));
const requestedEntry = entryArg ? entryArg.split('=')[1] : null;
const rendererEntry = requestedEntry === 'bootstrap' ? 'bootstrap' : 'index';
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist/renderer');
const srcDir = path.join(root, 'src/renderer');
const rendererEntryPath = path.join(srcDir, `${rendererEntry}.ts`);

fs.rmSync(outDir, { recursive: true, force: true });
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

const createBuildOptions = (mode) => ({
  entryPoints: [
    { in: rendererEntryPath, out: 'index' },
    { in: path.join(srcDir, 'output.ts'), out: 'output' }
  ],
  bundle: true,
  sourcemap: true,
  outdir: outDir,
  entryNames: '[name]',
  platform: 'browser',
  target: ['chrome120'],
  external: ['@novnc/novnc', '@novnc/novnc/*'],
  loader: { '.glsl': 'text' },
  define: {
    'process.env.NODE_ENV': mode === 'watch' ? '"development"' : '"production"'
  }
});

const build = () => {
  return esbuild.build(createBuildOptions(watch ? 'watch' : 'build'));
};

const run = async () => {
  console.log(`[build-renderer] entrypoint: ${rendererEntry}.ts`);
  copyStatic();
  if (watch) {
    const ctx = await esbuild.context(createBuildOptions('watch'));
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

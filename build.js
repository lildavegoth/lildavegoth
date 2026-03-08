const { glob } = require('glob');
const { minify } = require('html-minifier-terser');
const csso = require('csso');
const terser = require('terser');
const fs = require('fs').promises;
const path = require('path');

const sourceDir = process.cwd();
const distDir = path.join(sourceDir, 'dist');

const htmlOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true,
  minifyCSS: true
};

async function processFiles() {
  const files = await glob('**/*.{html,css,js}', {
    ignore: ['node_modules/**', 'dist/**', 'build.js']
  });

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(distDir, file);
    await fs.mkdir(path.dirname(destPath), { recursive: true });

    const content = await fs.readFile(sourcePath, 'utf8');
    const ext = path.extname(file);

    if (ext === '.html') {
      const result = await minify(content, htmlOptions);
      await fs.writeFile(destPath, result);
    } else if (ext === '.css') {
      const result = csso.minify(content).css;
      await fs.writeFile(destPath, result);
    } else if (ext === '.js') {
      const result = await terser.minify(content, { compress: true, mangle: true });
      await fs.writeFile(destPath, result.code);
    }
  }
}

processFiles().catch(err => {
  console.error(err);
  process.exit(1);
});

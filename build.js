const { glob } = require('glob')
const { minify } = require('html-minifier-terser')
const csso = require('csso')
const terser = require('terser')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

const sourceDir = process.cwd()
const distDir = path.join(sourceDir, 'dist')

const htmlOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true,
  minifyCSS: true
}

async function processFiles() {
  const files = await glob('**/*.{html,css,js}', {
    ignore: ['node_modules/**', 'dist/**', 'build.js']
  })

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file)
    const destPath = path.join(distDir, file)
    await mkdirp(path.dirname(destPath))

    const ext = path.extname(file)
    const content = fs.readFileSync(sourcePath, 'utf8')

    if (ext === '.html') {
      const result = await minify(content, htmlOptions)
      fs.writeFileSync(destPath, result)
    } else if (ext === '.css') {
      const result = csso.minify(content).css
      fs.writeFileSync(destPath, result)
    } else if (ext === '.js') {
      const result = await terser.minify(content, { compress: true, mangle: true })
      fs.writeFileSync(destPath, result.code)
    }
  }
}

processFiles()
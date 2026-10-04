const fs = require('fs')
const path = require('path')

const sourceDir = __dirname
const dataDir = process.env.DATA_DIR || sourceDir
const marker = path.join(dataDir, '.tefte-seeded-v1')

if (path.resolve(dataDir) === path.resolve(sourceDir)) {
  console.log('TEFTE seed: local mode, nothing to migrate')
  process.exit(0)
}

fs.mkdirSync(dataDir, { recursive: true })

if (fs.existsSync(marker)) {
  console.log('TEFTE seed: already completed')
  process.exit(0)
}

const files = [
  'user-products.json',
  'orders.json',
  'chat-messages.json',
]

for (const file of files) {
  const src = path.join(sourceDir, file)
  const dst = path.join(dataDir, file)

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst)
    console.log(`TEFTE seed: copied ${file}`)
  }
}

const uploadsSrc = path.join(sourceDir, 'uploads')
const uploadsDst = path.join(dataDir, 'uploads')

if (fs.existsSync(uploadsSrc)) {
  fs.cpSync(uploadsSrc, uploadsDst, {
    recursive: true,
    force: true,
  })
  console.log('TEFTE seed: copied uploads')
}

fs.writeFileSync(
  marker,
  new Date().toISOString(),
  'utf8'
)

console.log('TEFTE seed: completed')

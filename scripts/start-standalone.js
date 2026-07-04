const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env')

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')

  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (!match || match[1].startsWith('#') || process.env[match[1]] !== undefined) continue

    const value = match[2] || ''
    process.env[match[1]] = value.replace(/^(['"])(.*)\1$/, '$2')
  }
}

require('../.next/standalone/server.js')

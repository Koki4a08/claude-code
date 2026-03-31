import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dirname, '..')

const NODE_BUILTINS = new Set([
  'node:async_hooks', 'async_hooks', 'buffer', 'child_process', 'crypto', 'dns',
  'events', 'fs', 'fs/promises', 'http', 'https', 'net', 'os', 'path', 'perf_hooks',
  'process', 'readline', 'stream', 'tls', 'tty', 'url', 'util', 'v8', 'zlib',
])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (/\.(ts|tsx|mts|cts)$/.test(name)) files.push(p)
  }
  return files
}

function pkgName(spec) {
  if (!spec || spec.startsWith('bun:')) return null
  if (spec.includes('://')) return null
  if (spec.startsWith('node:')) return null
  if (spec.startsWith('.') || spec.startsWith('src/')) return null
  const rootMod = spec.startsWith('@')
    ? spec.split('/').slice(0, 2).join('/')
    : spec.split('/')[0]
  if (NODE_BUILTINS.has(rootMod) || NODE_BUILTINS.has(spec)) return null
  if (rootMod.includes('//') || /\.(com|org|io)\//.test(spec)) return null
  if (/^[a-z0-9-]+\.(com|org|net|io)$/i.test(rootMod)) return null
  if (!/^(@[a-z0-9-][^/]*\/[^/@]+|[a-zA-Z0-9@][a-zA-Z0-9._-]*)$/.test(rootMod))
    return null
  return rootMod
}

function extractFromLine(line) {
  const pkgs = []
  const re = /\bfrom\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(line))) {
    const n = pkgName(m[1])
    if (n) pkgs.push(n)
  }
  const side = line.match(/^\s*import\s+['"]([^'"]+)['"]/)
  if (side) {
    const n = pkgName(side[1])
    if (n) pkgs.push(n)
  }
  return pkgs
}

const pkgs = new Set()
for (const file of walk(root)) {
  const s = readFileSync(file, 'utf8')
  for (const line of s.split('\n')) {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*')) continue
    if (!/\bfrom\s+['"]/.test(line) && !/^\s*import\s+['"]/.test(line)) continue
    for (const p of extractFromLine(line)) pkgs.add(p)
  }
}

const sorted = [...pkgs].sort()
writeFileSync(join(root, 'scripts', 'collected-packages.txt'), sorted.join('\n') + '\n', 'utf8')
console.log(sorted.join('\n'))
console.error(`\nCount: ${sorted.length}`)

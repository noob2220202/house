#!/usr/bin/env node
// Adds missing @map("snake_case") to camelCase scalar fields and @@map("snake_case") to enums
// in every prisma/schema/*.prisma file. Idempotent. Run via `pnpm --filter @house/api db:format`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '..', 'prisma', 'schema');
const files = readdirSync(dir).filter((f) => f.endsWith('.prisma'));
const snake = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

const models = new Set();
for (const f of files) {
  for (const m of readFileSync(path.join(dir, f), 'utf8').matchAll(/^model\s+(\w+)\s*\{/gm))
    models.add(m[1]);
}

let changed = 0;
for (const f of files) {
  const file = path.join(dir, f);
  const lines = readFileSync(file, 'utf8').split('\n');
  const out = [];
  let block = null; // { kind, name, hasMap }
  for (const line of lines) {
    const open = /^(model|enum)\s+(\w+)\s*\{/.exec(line);
    if (open) {
      block = { kind: open[1], name: open[2], hasMap: false };
      out.push(line);
      continue;
    }
    if (block && /^\}/.test(line)) {
      if (block.kind === 'enum' && !block.hasMap && snake(block.name) !== block.name) {
        out.push(`\n  @@map("${snake(block.name)}")`);
        changed++;
      }
      block = null;
      out.push(line);
      continue;
    }
    if (block && /^\s*@@map\(/.test(line)) block.hasMap = true;
    if (block?.kind === 'model') {
      const m = /^(\s+)(\w+)(\s+)(\w+)(\[\]|\?)?(.*)$/.exec(line);
      if (m && !line.trim().startsWith('//') && !line.trim().startsWith('@@')) {
        const [, , name, , type, , rest] = m;
        const isRelation = models.has(type);
        if (!isRelation && !rest.includes('@map(') && snake(name) !== name) {
          const commentIdx = line.indexOf(' //');
          const code = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
          const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
          out.push(`${code.trimEnd()} @map("${snake(name)}")${comment}`);
          changed++;
          continue;
        }
      }
    }
    out.push(line);
  }
  writeFileSync(file, out.join('\n'));
}
console.log(`prisma-snake-map: ${changed} mapping(s) added`);

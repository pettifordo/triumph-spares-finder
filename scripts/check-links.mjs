#!/usr/bin/env node
/* Checks that every supplier front page still responds, and that each search
 * template returns something other than a 404.
 *
 * Shops go out of business and rebuild their sites; this is how you find out
 * before a visitor does. It cannot tell you whether a search returned useful
 * results — only that the URL is alive. Promoting an entry to verified:true is
 * still a human decision, made by opening the link and looking.
 *
 *   node scripts/check-links.mjs              # front pages only
 *   node scripts/check-links.mjs --templates  # also probe search templates
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const context = vm.createContext({});
for (const file of ['data/knowledge.js', 'data/suppliers.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const SUPPLIERS = vm.runInContext('SUPPLIERS', context);

const checkTemplates = process.argv.includes('--templates');
const PROBE = 'trunnion';
const TIMEOUT_MS = 15_000;

/* A browser-ish user agent: several classic-parts shops sit behind bot
 * protection that returns 403 to a bare fetch. A 403 here means "we were
 * blocked", not "the site is gone" — reported separately. */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', headers: HEADERS, signal: controller.signal });
    return { status: res.status, finalUrl: res.url };
  } catch (err) {
    return { status: 0, error: err.name === 'AbortError' ? 'timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function verdict(status) {
  if (status === 0) return { icon: '?', bucket: 'unreachable' };
  if (status === 403 || status === 429) return { icon: '~', bucket: 'blocked' };
  if (status >= 200 && status < 400) return { icon: 'o', bucket: 'ok' };
  return { icon: 'x', bucket: 'broken' };
}

const buckets = { ok: [], blocked: [], broken: [], unreachable: [] };

for (const s of SUPPLIERS) {
  const home = await probe(s.url);
  const v = verdict(home.status);
  buckets[v.bucket].push(s.id);
  let line = `${v.icon} ${s.id.padEnd(22)} ${String(home.status || 'ERR').padEnd(4)} ${s.url}`;
  if (home.error) line += `  (${home.error})`;
  console.log(line);

  if (checkTemplates && s.search?.template) {
    const url = s.search.template.replace('{q}', encodeURIComponent(PROBE));
    const t = await probe(url);
    const tv = verdict(t.status);
    console.log(`  ${tv.icon} search template   ${String(t.status || 'ERR').padEnd(4)} ${url}`);
  }
}

console.log('\n--- summary ---');
console.log(`ok:          ${buckets.ok.length}`);
console.log(`blocked:     ${buckets.blocked.length}${buckets.blocked.length ? '  (' + buckets.blocked.join(', ') + ')' : ''}`);
console.log(`broken:      ${buckets.broken.length}${buckets.broken.length ? '  (' + buckets.broken.join(', ') + ')' : ''}`);
console.log(`unreachable: ${buckets.unreachable.length}${buckets.unreachable.length ? '  (' + buckets.unreachable.join(', ') + ')' : ''}`);
console.log('\n"blocked" means bot protection turned us away, not that the site is dead — open those by hand.');

if (buckets.broken.length) process.exit(1);

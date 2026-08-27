#!/usr/bin/env node
/* Validates data/suppliers.js against data/knowledge.js.
 * Catches the mistakes you actually make when editing the directory: a typo in
 * a model id, a category that doesn't exist, a duplicate id, coordinates in
 * the wrong hemisphere. Exits non-zero on error so CI can gate on it. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const context = vm.createContext({});
for (const file of ['data/knowledge.js', 'data/suppliers.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const { SUPPLIERS, TRIUMPH_MODELS, PART_CATEGORIES, SUPPLIER_GROUPS } = vm.runInContext(
  '({ SUPPLIERS, TRIUMPH_MODELS, PART_CATEGORIES, SUPPLIER_GROUPS })',
  context
);

const modelIds = new Set(TRIUMPH_MODELS.map((m) => m.id));
const categoryIds = new Set(PART_CATEGORIES.map((c) => c.id));
const validTypes = new Set(['specialist', 'performance', 'trim', 'club', 'breaker', 'marketplace']);
const validStock = new Set(['new', 'repro', 'nos', 'used']);

const errors = [];
const warnings = [];
const seen = new Set();

for (const s of SUPPLIERS) {
  const where = `${s.id || '(missing id)'}`;

  if (!s.id) errors.push('A supplier has no id.');
  else if (seen.has(s.id)) errors.push(`Duplicate id: ${s.id}`);
  seen.add(s.id);

  for (const field of ['name', 'url', 'type', 'notes']) {
    if (!s[field]) errors.push(`${where}: missing "${field}"`);
  }

  if (!validTypes.has(s.type)) errors.push(`${where}: unknown type "${s.type}"`);

  try { new URL(s.url); } catch { errors.push(`${where}: "${s.url}" is not a valid URL`); }

  for (const m of s.models || []) {
    if (m !== '*' && !modelIds.has(m)) errors.push(`${where}: unknown model id "${m}"`);
  }
  for (const c of s.categories || []) {
    if (c !== '*' && !categoryIds.has(c)) errors.push(`${where}: unknown category id "${c}"`);
  }
  for (const st of s.stockTypes || []) {
    if (!validStock.has(st)) errors.push(`${where}: unknown stock type "${st}"`);
  }

  if (s.group && !SUPPLIER_GROUPS[s.group]) {
    errors.push(`${where}: unknown supplier group "${s.group}"`);
  }

  if (!(s.breadth >= 1 && s.breadth <= 5)) errors.push(`${where}: breadth must be 1–5, got ${s.breadth}`);

  if (s.coords) {
    const [lat, lon] = s.coords;
    if (typeof lat !== 'number' || typeof lon !== 'number') errors.push(`${where}: coords must be numbers`);
    else if (lat < -90 || lat > 90 || lon < -180 || lon > 180) errors.push(`${where}: coords out of range`);
    else if (s.country === 'GB' && (lat < 49 || lat > 61 || lon < -9 || lon > 2)) {
      warnings.push(`${where}: coords ${lat},${lon} fall outside the UK — is the country right?`);
    }
  } else if (s.collection) {
    warnings.push(`${where}: marked as collectable but has no coordinates, so distance ranking will skip it`);
  }

  if (s.searchable === false && !s.contact && !s.ebaySeller) {
    errors.push(`${where}: searchable:false with no contact details and no ebaySeller — the card would be a dead end`);
  }
  if (s.contact && !s.contact.phone && !s.contact.email) {
    errors.push(`${where}: contact block has neither phone nor email`);
  }
  if (s.contact?.email && !s.contact.email.includes('@')) {
    errors.push(`${where}: "${s.contact.email}" is not an email address`);
  }

  if (s.search?.verified && !s.search.template) errors.push(`${where}: verified:true with no template`);
  if (s.search?.template && !s.search.template.includes('{q}')) {
    errors.push(`${where}: search template has no {q} placeholder`);
  }
}

const unverified = SUPPLIERS.filter((s) => s.search?.template && !s.search.verified).length;
const noTemplate = SUPPLIERS.filter((s) => !s.search?.template).length;

for (const [id, g] of Object.entries(SUPPLIER_GROUPS)) {
  const members = SUPPLIERS.filter((s) => s.group === id);
  if (members.length < 2) {
    warnings.push(`group "${id}" has ${members.length} member(s) — a group of one tells the reader nothing`);
  }
}

console.log(`Checked ${SUPPLIERS.length} suppliers.`);
console.log(`  ${SUPPLIERS.length - unverified - noTemplate} use a verified site search`);
console.log(`  ${unverified} have an unverified template (falling back to Google)`);
console.log(`  ${noTemplate} have no template at all (Google only)`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.error('  x ' + e));
  process.exit(1);
}
console.log('\nNo errors.');

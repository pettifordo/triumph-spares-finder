/* Query parsing and supplier ranking.
 *
 * The ranking is deliberately explainable: every point a supplier scores comes
 * from a named signal, and the UI shows that breakdown. If a result looks
 * wrong, the breakdown tells you which signal to fix in the data files.
 */

/* ------------------------------------------------------------ text utils */

function normalise(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenise(s) {
  return normalise(s).split(' ').filter(Boolean);
}

/* Matches a multi-word phrase against the query as a whole-word phrase, so
 * "rack" doesn't fire on "bracket" and "su" doesn't fire on "suspension". */
function containsPhrase(haystack, phrase) {
  const p = normalise(phrase);
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

/* --------------------------------------------------------- query parsing */

function detectPartNumbers(raw) {
  const found = [];
  /* Candidate tokens keep their internal hyphen (Moss numbers need it) but
   * lose trailing punctuation. */
  const candidates = (raw || '')
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9-]+$/g, ''))
    .filter((t) => t.length >= 4 && /\d/.test(t));

  for (const c of candidates) {
    const format = PART_NUMBER_FORMATS.find((f) => f.test.test(c));
    if (format) {
      found.push({ value: c.toUpperCase(), format: format.id, formatLabel: format.label, note: format.note, boosts: format.boosts });
    }
  }
  return found;
}

function detectModels(norm) {
  const hits = [];
  for (const model of TRIUMPH_MODELS) {
    const matched = model.synonyms.some((syn) => containsPhrase(norm, syn));
    if (matched) hits.push(model);
  }
  /* "TR6" also literally contains "tr" style noise; nothing to do here, but
   * if both TR3 and TR3A synonyms fire we only keep one entry per model. */
  return hits;
}

function detectCategories(norm) {
  const scored = [];
  for (const cat of PART_CATEGORIES) {
    let hits = 0;
    for (const kw of cat.keywords) {
      if (containsPhrase(norm, kw)) hits += kw.includes(' ') ? 2 : 1;
    }
    if (hits > 0) scored.push({ id: cat.id, label: cat.label, hits });
  }
  scored.sort((a, b) => b.hits - a.hits);
  /* Keep the strong signals: anything within one hit of the best. */
  if (!scored.length) return [];
  const best = scored[0].hits;
  return scored.filter((c) => c.hits >= best - 1).slice(0, 3);
}

function detectCondition(norm) {
  for (const [cond, terms] of Object.entries(CONDITION_TERMS)) {
    if (terms.some((t) => containsPhrase(norm, t))) return cond;
  }
  return null;
}

function detectMotorcycle(norm) {
  return MOTORCYCLE_TERMS.some((t) => containsPhrase(norm, t));
}

function detectPerformanceIntent(norm) {
  return PERFORMANCE_TERMS.some((t) => containsPhrase(norm, t));
}

function parseQuery(raw) {
  const norm = normalise(raw);
  const partNumbers = detectPartNumbers(raw);
  /* Don't let a part number masquerade as a description keyword. */
  const descriptive = partNumbers.reduce(
    (acc, pn) => acc.replace(normalise(pn.value), ' '),
    norm
  ).replace(/\s+/g, ' ').trim();

  return {
    raw: (raw || '').trim(),
    norm,
    descriptive,
    tokens: tokenise(descriptive),
    partNumbers,
    models: detectModels(norm),
    categories: detectCategories(descriptive),
    condition: detectCondition(norm),
    looksLikeMotorcycle: detectMotorcycle(norm),
    wantsPerformance: detectPerformanceIntent(norm),
    isEmpty: !norm,
  };
}

/* -------------------------------------------------------------- distance */

function haversineMiles(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Postcode -> approximate coordinates via the postcode area (the letters at
 * the start). Deliberately tolerant: "ln6", "LN6 7DQ" and "ln" all work. */
function coordsFromPostcode(postcode) {
  const clean = (postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  const twoLetter = clean.slice(0, 2);
  const oneLetter = clean.slice(0, 1);
  if (/^[A-Z]{2}/.test(clean) && POSTCODE_AREAS[twoLetter]) {
    return { coords: POSTCODE_AREAS[twoLetter], area: twoLetter };
  }
  if (POSTCODE_AREAS[oneLetter]) {
    return { coords: POSTCODE_AREAS[oneLetter], area: oneLetter };
  }
  return null;
}

function resolveOrigin(opts) {
  if (opts.postcode) {
    const hit = coordsFromPostcode(opts.postcode);
    if (hit) return { coords: hit.coords, label: `${hit.area} postcode area` };
  }
  if (opts.region) {
    const region = UK_REGIONS.find((r) => r.id === opts.region);
    if (region) return { coords: region.coords, label: region.label };
  }
  return null;
}

/* --------------------------------------------------------------- scoring */

/* Model and part-type carry near-equal weight: people search for a part, and
 * which part it is matters as much as which car it came off. */
const WEIGHTS = {
  model: 28,
  category: 28,
  partNumber: 15,
  proximity: 18,
  condition: 12,
  intent: 15,
  breadth: 10,
};

function modelScore(supplier, parsed) {
  if (!parsed.models.length) return null;
  let best = 0;
  for (const m of parsed.models) {
    let s;
    if (supplier.models.includes(m.id)) s = 1;
    /* "Covers every model" is taken at face value: breadth measures how many
     * CATEGORIES a supplier carries, not how many models, so reusing it here
     * would penalise a trim maker that genuinely does cover the whole range.
     * Just short of 1, so an explicitly listed model still edges ahead. */
    else if (supplier.models.includes('*')) s = 0.95;
    else {
      const familyMatch = supplier.models.some((id) => {
        const other = TRIUMPH_MODELS.find((tm) => tm.id === id);
        return other && other.family === m.family;
      });
      s = familyMatch ? 0.7 : 0.15;
    }
    best = Math.max(best, s);
  }
  return best;
}

function categoryScore(supplier, parsed) {
  if (!parsed.categories.length) return null;
  let best = 0;
  for (const c of parsed.categories) {
    let s;
    if (supplier.categories.includes(c.id)) s = 1;
    /* A generalist covers the category too — how well depends on how deep the
     * catalogue is. Kept a gentle slope on purpose: breadth already has its own
     * signal below, so leaning on it hard here counts the same fact twice and
     * pushes narrow-but-deep specialists below broad catalogues that are worse
     * bets for the actual part. */
    else if (supplier.categories.includes('*')) s = 0.7 + 0.04 * supplier.breadth;
    else s = 0.2;
    best = Math.max(best, s);
  }
  return best;
}

function partNumberScore(supplier, parsed) {
  if (!parsed.partNumbers.length) return null;
  let best = 0;
  for (const pn of parsed.partNumbers) {
    let s;
    if (pn.boosts && pn.boosts.includes(supplier.id)) s = 1;
    else if (pn.format === 'oe-triumph' || pn.format === 'bl-alpha') {
      if (supplier.oeCrossReference) s = 0.9;
      else if (supplier.type === 'marketplace') s = 0.85;
      else s = 0.45;
    } else if (supplier.type === 'marketplace') s = 0.7;
    else s = 0.5;
    best = Math.max(best, s);
  }
  return best;
}

function proximityScore(supplier, origin, radius) {
  if (!origin) return null;
  if (!supplier.coords) return supplier.nationwide ? 0.6 : 0.3;
  const miles = haversineMiles(origin.coords, supplier.coords);
  if (radius && miles > radius) return supplier.nationwide ? 0.45 : 0;
  const ceiling = radius || 400;
  return Math.max(0, 1 - miles / ceiling);
}

/* Only applies when there's something to say: either the shop is a
 * competition specialist, or the search asks for competition parts. Everyone
 * else skips this signal entirely rather than being scored on a non-issue. */
function intentScore(supplier, parsed) {
  const isPerformanceShop = supplier.type === 'performance';
  if (!isPerformanceShop && !parsed.wantsPerformance) return null;
  if (parsed.wantsPerformance) return isPerformanceShop ? 1 : 0.55;
  return 0.35;
}

function conditionScore(supplier, parsed) {
  if (!parsed.condition) return null;
  return supplier.stockTypes.includes(parsed.condition) ? 1 : 0.2;
}

function scoreSupplier(supplier, parsed, opts) {
  const origin = opts.origin;
  const signals = [
    { key: 'model', label: 'Covers your model', value: modelScore(supplier, parsed) },
    { key: 'category', label: 'Stocks this kind of part', value: categoryScore(supplier, parsed) },
    { key: 'partNumber', label: 'Handles this part-number format', value: partNumberScore(supplier, parsed) },
    { key: 'proximity', label: 'Distance from you', value: proximityScore(supplier, origin, opts.radius) },
    { key: 'condition', label: 'Right condition of part', value: conditionScore(supplier, parsed) },
    { key: 'intent', label: 'Standard vs competition parts', value: intentScore(supplier, parsed) },
    { key: 'breadth', label: 'Catalogue depth', value: supplier.breadth / 5 },
  ].filter((s) => s.value !== null);

  const totalWeight = signals.reduce((sum, s) => sum + WEIGHTS[s.key], 0);
  const earned = signals.reduce((sum, s) => sum + WEIGHTS[s.key] * s.value, 0);
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;

  const distance =
    origin && supplier.coords ? Math.round(haversineMiles(origin.coords, supplier.coords)) : null;

  return {
    score,
    distance,
    breakdown: signals.map((s) => ({
      key: s.key,
      label: s.label,
      pct: Math.round(s.value * 100),
      weight: WEIGHTS[s.key],
    })),
    reasons: buildReasons(supplier, parsed, signals, distance),
  };
}

function buildReasons(supplier, parsed, signals, distance) {
  const reasons = [];
  const by = (k) => signals.find((s) => s.key === k);

  const model = by('model');
  if (model && model.value >= 0.99 && parsed.models.length) {
    reasons.push(`Lists ${parsed.models.map((m) => m.label).join(' / ')} specifically`);
  } else if (model && model.value >= 0.8) {
    reasons.push('Covers the whole Triumph range');
  } else if (model && model.value >= 0.7) {
    reasons.push('Covers this model family');
  }

  const cat = by('category');
  if (cat && cat.value >= 0.99 && parsed.categories.length) {
    reasons.push(`Specialises in ${parsed.categories[0].label.toLowerCase()}`);
  }

  const pn = by('partNumber');
  if (pn && pn.value >= 0.9) reasons.push('Good with factory part numbers');

  const intent = by('intent');
  if (intent && intent.value >= 0.99) reasons.push('Competition & fast-road parts');
  else if (intent && intent.value <= 0.4) reasons.push('Race parts — not the standard item');

  if (distance !== null) reasons.push(`${distance} miles away`);
  else if (!supplier.coords) reasons.push('Online / mail order');

  if (parsed.condition && supplier.stockTypes.includes(parsed.condition)) {
    const label = { new: 'new & reproduction', nos: 'NOS / original', used: 'used' }[parsed.condition];
    reasons.push(`Stocks ${label} parts`);
  }

  if (supplier.collection) reasons.push('Collection possible');
  return reasons;
}

/* --------------------------------------------------------------- ranking */

function applyFilters(suppliers, parsed, opts) {
  return suppliers.filter((s) => {
    if (!opts.includeInternational && s.country !== 'GB') return false;
    if (opts.types && opts.types.length && !opts.types.includes(s.type)) return false;
    if (opts.collectionOnly && !s.collection) return false;
    if (opts.collectionOnly && opts.origin && opts.radius && s.coords) {
      if (haversineMiles(opts.origin.coords, s.coords) > opts.radius) return false;
    }
    return true;
  });
}

function rankSuppliers(parsed, opts) {
  const filtered = applyFilters(SUPPLIERS, parsed, opts);
  return filtered
    .map((supplier) => ({ supplier, ...scoreSupplier(supplier, parsed, opts) }))
    .sort((a, b) => b.score - a.score || b.supplier.breadth - a.supplier.breadth);
}

/* ----------------------------------------------------------- search URLs */

/* The term we hand to the shop. A factory part number on its own beats a part
 * number buried in a sentence — most shop search boxes are exact-match. */
function bestSearchTerm(parsed) {
  if (parsed.partNumbers.length) return parsed.partNumbers[0].value;
  return parsed.raw;
}

function alternativeTerms(parsed) {
  const terms = new Set();
  if (parsed.partNumbers.length) {
    parsed.partNumbers.forEach((pn) => terms.add(pn.value));
  }
  if (parsed.descriptive) terms.add(parsed.descriptive);
  if (parsed.models.length && parsed.categories.length) {
    terms.add(`${parsed.models[0].label} ${parsed.categories[0].label.toLowerCase()}`);
  }
  terms.delete('');
  return [...terms];
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function googleSiteSearch(supplier, term) {
  const q = `site:${domainOf(supplier.url)} ${term}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/* Returns {url, via} — `via` tells the UI whether we hit the shop's own search
 * or fell back to Google, so the interface can be honest about it. */
function buildSearchUrl(supplier, term, preferGoogle) {
  const t = (term || '').trim();
  if (!t) return { url: supplier.url, via: 'home' };

  /* Some suppliers have no searchable site at all — you ring them. Where they
   * run an eBay shop, scoping a search to that seller is the one way to look
   * through their stock without picking up the phone. */
  if (supplier.ebaySeller) {
    const url = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(t)}&_ssn=${encodeURIComponent(supplier.ebaySeller)}`;
    return { url, via: 'ebay-seller' };
  }
  if (supplier.searchable === false) {
    return { url: supplier.url, via: 'no-search' };
  }
  const tpl = supplier.search && supplier.search.template;
  const verified = supplier.search && supplier.search.verified;
  if (!preferGoogle && tpl && verified) {
    return { url: tpl.replace('{q}', encodeURIComponent(t)), via: 'site' };
  }
  if (!preferGoogle && tpl && !verified) {
    return { url: googleSiteSearch(supplier, t), via: 'google-unverified' };
  }
  return { url: googleSiteSearch(supplier, t), via: 'google' };
}

/* Phone and email links for suppliers you have to contact directly. Returns an
 * empty list for everyone else, so the UI can just spread it in. */
function contactLinks(supplier) {
  const c = supplier.contact;
  if (!c) return [];
  const out = [];
  if (c.phone) {
    out.push({ label: c.phone, href: `tel:${c.phone.replace(/[^+\d]/g, '')}`, kind: 'phone' });
  }
  if (c.email) {
    out.push({ label: 'Email them', href: `mailto:${c.email}`, kind: 'email' });
  }
  return out;
}

/* Reverse-image search entry points, used by the photo panel when no vision
 * endpoint is configured. These all require the user to upload the picture at
 * the far end — we can't push a local file into them from here. */
const REVERSE_IMAGE_SEARCHES = [
  { id: 'lens', label: 'Google Lens', url: 'https://lens.google.com/upload' },
  { id: 'tineye', label: 'TinEye', url: 'https://tineye.com/' },
  { id: 'bing', label: 'Bing Visual Search', url: 'https://www.bing.com/visualsearch' },
  { id: 'yandex', label: 'Yandex Images', url: 'https://yandex.com/images/' },
];

/* UI wiring: read the form, rank the suppliers, render the results. */

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    form: $('searchForm'),
    q: $('q'),
    postcode: $('postcode'),
    region: $('region'),
    radius: $('radius'),
    condition: $('condition'),
    typeFilters: $('typeFilters'),
    international: $('international'),
    collectionOnly: $('collectionOnly'),
    preferGoogle: $('preferGoogle'),
    readback: $('readback'),
    warnings: $('warnings'),
    results: $('results'),
    resultCount: $('resultCount'),
    themeToggle: $('themeToggle'),
  };

  /* ------------------------------------------------------------- setup */

  UK_REGIONS.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.label;
    els.region.appendChild(opt);
  });

  /* -------------------------------------------------------- read state */

  function readOptions(parsed) {
    const origin = resolveOrigin({
      postcode: els.postcode.value,
      region: els.region.value,
    });
    const types = [...els.typeFilters.querySelectorAll('input:checked')].map((i) => i.value);
    return {
      origin,
      radius: Number(els.radius.value) || 0,
      types,
      includeInternational: els.international.checked,
      collectionOnly: els.collectionOnly.checked,
      preferGoogle: els.preferGoogle.checked,
      /* An explicit condition choice overrides whatever the text implied. */
      conditionOverride: els.condition.value || null,
    };
  }

  /* ----------------------------------------------------------- render */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderReadback(parsed, opts) {
    els.readback.innerHTML = '';
    const chips = [];

    parsed.partNumbers.forEach((pn) => {
      const chip = el('span', 'chip pn');
      chip.appendChild(el('b', null, pn.value));
      chip.appendChild(el('small', null, pn.formatLabel));
      chip.title = pn.note;
      chips.push(chip);
    });

    parsed.models.forEach((m) => {
      const chip = el('span', 'chip');
      chip.appendChild(el('b', null, m.label));
      chip.appendChild(el('small', null, m.years));
      chips.push(chip);
    });

    parsed.categories.forEach((c) => {
      chips.push(el('span', 'chip', c.label));
    });

    const cond = opts.conditionOverride || parsed.condition;
    if (cond) {
      const label = { new: 'New / reproduction', nos: 'NOS / original', used: 'Used' }[cond];
      chips.push(el('span', 'chip', label));
    }

    if (opts.origin) chips.push(el('span', 'chip', `Near ${opts.origin.label}`));

    if (!chips.length) {
      els.readback.hidden = true;
      return;
    }
    els.readback.appendChild(el('span', null, 'Reading your search as:'));
    chips.forEach((c) => els.readback.appendChild(c));
    els.readback.hidden = false;
  }

  function renderWarnings(parsed) {
    els.warnings.innerHTML = '';

    if (parsed.looksLikeMotorcycle) {
      const p = el('p', 'hint warn');
      p.textContent =
        'That looks like it might be a Triumph motorcycle part. This directory covers Triumph cars only — ' +
        'for bikes you want a motorcycle specialist instead.';
      els.warnings.appendChild(p);
    }

    if (parsed.partNumbers.length) {
      const pn = parsed.partNumbers[0];
      const p = el('p', 'hint');
      p.textContent = pn.note;
      els.warnings.appendChild(p);
    }
  }

  function renderResult(entry, term, preferGoogle, scored) {
    const { supplier, score, distance, breakdown, reasons } = entry;
    const card = el('article', 'result');

    const head = el('div');
    const h3 = el('h3');
    const link = el('a', null, supplier.name);
    link.href = supplier.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    h3.appendChild(link);
    head.appendChild(h3);

    const typeLabels = {
      specialist: 'Specialist', performance: 'Performance', trim: 'Trim & upholstery',
      club: 'Owners’ club', breaker: 'Used & breaking', marketplace: 'Marketplace',
    };
    const meta = [typeLabels[supplier.type] || supplier.type, supplier.town];
    if (supplier.country !== 'GB') meta.push(supplier.country === 'US' ? '🇺🇸 USA' : '🌍 Overseas');
    head.appendChild(el('p', 'meta', meta.filter(Boolean).join(' · ')));
    card.appendChild(head);

    /* With nothing typed there is nothing to match against, so showing a
     * percentage would be inventing precision. Show catalogue depth instead. */
    const match = el('div', 'match');
    if (scored) {
      match.appendChild(el('div', 'pct', `${score}%`));
      match.appendChild(el('div', 'pct-label', 'match'));
    } else {
      match.appendChild(el('div', 'pct stars', '★'.repeat(supplier.breadth)));
      match.appendChild(el('div', 'pct-label', 'catalogue depth'));
    }
    card.appendChild(match);

    card.appendChild(el('p', 'notes', supplier.notes));

    const reasonRow = el('div', 'reasons');
    reasons.slice(0, 5).forEach((r) => reasonRow.appendChild(el('span', 'reason', r)));
    card.appendChild(reasonRow);

    /* Actions: search their site (or Google-scoped), plus their front page. */
    const actions = el('div', 'actions');
    const built = buildSearchUrl(supplier, term, preferGoogle);
    const searchLink = el('a', 'btn', term ? `Search ${supplier.name}` : `Visit ${supplier.name}`);
    searchLink.href = built.url;
    searchLink.target = '_blank';
    searchLink.rel = 'noopener noreferrer';
    actions.appendChild(searchLink);

    const home = el('a', 'btn secondary', 'Front page');
    home.href = supplier.url;
    home.target = '_blank';
    home.rel = 'noopener noreferrer';
    actions.appendChild(home);

    const viaText = {
      site: 'uses their own search',
      google: 'via Google site search',
      'google-unverified': 'via Google — their search URL isn’t confirmed',
      home: 'no search term yet',
    }[built.via];
    actions.appendChild(el('span', 'via', viaText));
    card.appendChild(actions);

    /* Breakdown */
    const details = el('details', 'breakdown');
    details.appendChild(el('summary', null, 'Why this ranking'));
    const table = el('table', 'signals');
    breakdown.forEach((sig) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, sig.label));
      const barCell = el('td');
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.width = `${sig.pct}%`;
      bar.appendChild(fill);
      barCell.appendChild(bar);
      tr.appendChild(barCell);
      tr.appendChild(el('td', null, `${sig.pct}%`));
      table.appendChild(tr);
    });
    details.appendChild(table);
    if (distance !== null) {
      details.appendChild(el('p', 'meta', `Roughly ${distance} miles from ${'you'} — measured to the town centre, so treat it as a guide.`));
    }
    card.appendChild(details);

    return card;
  }

  /* ------------------------------------------------------------- search */

  function run() {
    const parsed = parseQuery(els.q.value);
    const opts = readOptions(parsed);
    if (opts.conditionOverride) parsed.condition = opts.conditionOverride;

    renderReadback(parsed, opts);
    renderWarnings(parsed);

    const ranked = rankSuppliers(parsed, opts);
    const term = bestSearchTerm(parsed);

    els.results.innerHTML = '';

    if (!ranked.length) {
      const empty = el('div', 'empty');
      empty.textContent = 'Nothing matches those filters. Try widening the distance, or tick a few more source types.';
      els.results.appendChild(empty);
      els.resultCount.textContent = '';
      return;
    }

    els.resultCount.textContent = parsed.isEmpty
      ? `${ranked.length} sources, ranked by catalogue depth — type a part to re-rank them`
      : `${ranked.length} sources, best match first`;

    const frag = document.createDocumentFragment();
    ranked.forEach((entry) => frag.appendChild(renderResult(entry, term, opts.preferGoogle, !parsed.isEmpty)));
    els.results.appendChild(frag);
  }

  /* Expose for the photo panel, which fills the box then re-runs the search. */
  window.TSF = {
    run,
    setQuery(text) {
      els.q.value = text;
      run();
      els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };

  /* ------------------------------------------------------------- events */

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    run();
  });

  /* Belt and braces: Enter in the box searches even if the form's own submit
   * never fires (some in-app browsers swallow it). */
  els.q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });

  document.querySelectorAll('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.q.value = btn.dataset.example;
      run();
    });
  });

  /* Filters re-rank live — no need to press Search again. */
  [els.postcode, els.region, els.radius, els.condition, els.international,
   els.collectionOnly, els.preferGoogle].forEach((node) => {
    node.addEventListener('change', run);
  });
  els.postcode.addEventListener('input', debounce(run, 350));
  els.typeFilters.addEventListener('change', run);

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /* Theme: follow the system unless the visitor overrides it. */
  const savedTheme = safeGet('tsf-theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  els.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = current ? (current === 'dark' ? 'light' : 'dark') : (prefersDark ? 'light' : 'dark');
    document.documentElement.dataset.theme = next;
    safeSet('tsf-theme', next);
  });

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

  /* First paint: show the whole directory so the page isn't empty. */
  run();
})();

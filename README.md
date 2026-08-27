# Triumph Spares Finder

A search tool for finding Triumph car parts. You type a part number, describe the
part, or upload a photo of it; the site ranks every supplier it knows about by how
closely they match, and links you straight into each one's search.

It is a **directory with a ranking engine**, not a stock feed. It tells you where
to look and why. It cannot tell you what is on the shelf today.

**Common ownership is flagged.** Moss Europe, Moss Motors and Rimmer Bros are owned
by the same group (Radial Equity Partners) and trade as a partnership, keeping
separate sites, catalogues, stock and pricing. Results from all three carry a "Moss /
Rimmer group" badge, because "try the other one" is weaker advice than it looks when
both belong to the same owner.

Covers Triumph **cars**, 1946–1984: TR2–TR8, Spitfire, GT6, Herald, Vitesse, Stag,
Dolomite, Toledo, the 2000/2500 saloons, the front-wheel-drive 1300/1500, Acclaim,
Mayflower, Renown and Roadster. Triumph motorcycles are out of scope, and the site
says so if your search looks like a bike part.

---

## Running it

No build step. It is plain HTML, CSS and JavaScript.

```bash
npm run dev
```

Then open <http://localhost:8765>. Opening `index.html` directly off disk works
too — everything except the photo identifier, which needs a server.

---

## Searching

**By part number.** `218131`, `UKC1234`, `142-500`. The site recognises the format
and says which numbering scheme it looks like, then feeds the bare number to each
supplier's search — shop search boxes do far better with a number on its own than
with a number buried in a sentence.

**By description.** `TR6 front suspension trunnion`. Model, part category and
condition are picked out of the text and shown back to you as chips, so you can see
what it understood before you trust the ranking.

**By photo.** Drop in a picture (or paste a screenshot). If the identifier is
switched on, the photo is read and turned into a search. If it isn't, you get
reverse-image search links instead — those need you to upload the picture again at
the far end, which the interface says plainly rather than pretending otherwise.

**Filters.** Postcode or region for distance, a radius, condition (new /
reproduction / NOS / used), which kinds of source to include, whether to widen the
net beyond the UK, and whether you need somewhere you could physically collect from.
Changing any filter re-ranks immediately.

---

## How the ranking works

Every supplier is scored on the signals that apply to your search. Signals that
don't apply are dropped rather than counted as zero, so the percentages stay
meaningful — searching a bare part number with no location set doesn't punish
everyone for a distance you never asked about.

| Signal | Weight | What it measures |
|---|---|---|
| Covers your model | 30 | Does it list your car? A whole-range catalogue is credited in proportion to how deep it actually is. |
| Stocks this kind of part | 25 | A trim shop beats a general catalogue on headlining; a general catalogue beats a niche shop on a water pump. |
| Handles this part-number format | 15 | Whether they cross-reference factory numbers, or the number is in their own house format. |
| Distance from you | 18 | Straight-line miles to the town. Mail-order-only suppliers aren't punished for having no shopfront. |
| Right condition of part | 12 | New, reproduction, NOS or used. |
| Standard vs competition parts | 15 | A race-parts house shouldn't top the list for a standard trunnion — unless you asked for uprated. |
| Catalogue depth | 10 | Tie-breaker. A hand-assigned 1–5 judgement — see the note below. |

Every result carries a **"Why this ranking"** panel showing the full breakdown. If a
result looks wrong, that panel tells you which signal — and therefore which line in
`data/suppliers.js` — to correct.

---

## Editing the directory

Two data files, no logic in either:

- **`data/suppliers.js`** — the suppliers. Add, remove or re-tag them here.
- **`data/knowledge.js`** — models and their synonyms, part categories and their
  keywords, part-number formats, postcode-area coordinates, supplier groups, and the
  terms that mean "I want the competition part".

**`breadth` is the softest field in the data.** It is a 1–5 judgement about how deep a
supplier's catalogue is, worth up to 10 points directly and also gently scaling how
much credit a "covers everything" supplier gets for a category. That scaling is
deliberately gentle: leaning on it counts the same fact twice, and pushes a
narrow-but-deep specialist below a broad catalogue that is a worse bet for the actual
part. There is no objective source for breadth — it reflects an opinion, and a wrong
guess can push a good local supplier below a distant one. If a supplier you actually use is ranking too low, this
is usually the field to change first. Compare it against similar suppliers already in
the file rather than setting it in isolation.

Adding a keyword to a category, or a synonym to a model, changes the ranking
straight away. No code changes needed.

```bash
npm run check-data      # validates ids, URLs, coordinates, search templates
npm run check-links     # checks every supplier site still responds
node scripts/check-links.mjs --templates   # also probes each search template
```

`check-links` reports *blocked* separately from *broken*: several classic-parts
shops sit behind bot protection that turns away a plain fetch with a 403. That means
"we couldn't look", not "the site is gone" — open those by hand.

### About the search links

Each supplier can carry a `search.template` — their own search URL with `{q}` where
the query goes. It is used only when `search.verified` is `true`, which is set by a
human opening the link and confirming it returns real results. Everything else falls
back to a Google search scoped to that domain, which always works.

Most entries are currently on the Google fallback. That is deliberate: a wrong
template sends people to a 404, whereas the fallback is merely less elegant. If you
verify a shop's search URL, set `verified: true` and it will be used directly.

Two entries — TR Bitz and Anglian Triumph Services — are listed as `http://` rather
than `https://`, because at the time of writing those hosts serve no working TLS.

---

## The photo identifier (optional)

`api/identify.js` is a serverless function that sends the photo to Claude and gets
back a structured identification: the part name in British catalogue vocabulary
("trunnion", not "kingpin housing"), the model if it can be told, the area of the
car, any part number legible on the casting, and a calibrated confidence score. The
front end turns that into a search.

The rest of the site works without it. With no API key configured the endpoint
returns a 503 and a plain explanation, and the photo panel falls back to
reverse-image search.

To switch it on:

```bash
vercel env add ANTHROPIC_API_KEY production
```

Get a key from <https://console.anthropic.com/>. The endpoint uses `claude-opus-5`
with adaptive thinking at medium effort, and enforces a 5 MB image cap, a
type allow-list, and a best-effort per-instance rate limit of 10 requests a minute
per IP. That limiter is per serverless instance, so put a real one in front of it if
the site gets busy. The browser downscales photos to 1400px before upload, which
keeps requests small and fast.

Two things worth knowing about the identification: it is a **guess from a
photograph**, so check it against the part in your hand before ordering; and a
generic bolt or hose clip genuinely cannot be identified from a picture, which is
why a low confidence score is reported rather than a confident wrong answer.

---

## Deploying

```bash
vercel --prod
```

Static files are served as-is; `api/identify.js` becomes a serverless function.

---

## Structure

```
index.html            markup and layout
assets/styles.css     styling, light and dark
data/knowledge.js     models, categories, part-number formats, geography
data/suppliers.js     the supplier directory
js/search.js          query parsing, scoring, ranking, URL building
js/app.js             UI wiring and rendering
js/photo.js           photo upload, identification, reverse-image fallback
api/identify.js       serverless vision endpoint (optional)
scripts/check-data.mjs    validates the data files
scripts/check-links.mjs   checks supplier links are alive
```

---

## Caveats

The directory is curated by hand and reflects what was true when it was written.
Businesses close, move and rebuild their websites. Run `npm run check-links`
periodically. The distances are straight-line to a town centre, not road miles.
Part-number format detection describes the *shape* of the number you typed — it does
not verify that the number exists or claim to know what it fits.

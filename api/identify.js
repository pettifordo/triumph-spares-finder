/* POST /api/identify
 *
 * Takes a photo of a car part and returns a structured guess: which Triumph
 * it's from, what the part is, and how confident that guess is. The front end
 * turns that into a search query.
 *
 * Requires ANTHROPIC_API_KEY in the deployment's environment variables. With
 * no key set the endpoint returns 503 and a plain explanation rather than
 * failing obscurely — the rest of the site works without it.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

/* Keep in step with PART_CATEGORIES in data/knowledge.js. */
const CATEGORY_IDS = [
  'engine', 'fuel', 'electrical', 'cooling', 'exhaust', 'transmission', 'axle',
  'suspension', 'steering', 'brakes', 'body', 'trim', 'hood', 'chrome',
  'wheels', 'literature',
];

const PartIdentification = z.object({
  part: z.string().describe('The most likely name of the part, in the words a UK parts catalogue would use, e.g. "front suspension trunnion" or "rear hub bearing kit".'),
  model: z.string().nullable().describe('The Triumph model this part belongs to if it can be told from the photo, e.g. "TR6" or "Spitfire". Null when the part is shared across models or the photo does not show enough.'),
  category: z.enum(CATEGORY_IDS).describe('Which area of the car the part belongs to.'),
  keywords: z.array(z.string()).describe('Two to five alternative search terms, including any part number legible in the photo.'),
  partNumber: z.string().nullable().describe('Any part number cast, stamped or printed on the part and legible in the photo. Null if none is readable — do not guess one.'),
  confidence: z.number().min(0).max(1).describe('How confident the identification is, 0 to 1. Be honest: a generic bolt photographed on a bench deserves a low number.'),
  reasoning: z.string().describe('One short sentence on what in the photo led to this identification.'),
});

const SYSTEM = `You identify classic car parts from photographs for a Triumph spares search tool.

The cars in scope are Triumph cars, 1946 to 1984 — TR2 through TR8, Spitfire, GT6, Herald, Vitesse, Stag, Dolomite, Toledo, the 2000/2500 saloons, the front-wheel-drive 1300/1500, Acclaim, Mayflower, Renown and Roadster. Triumph motorcycles are NOT in scope; if the photo is clearly a motorcycle part, say so in the part name and give a low confidence.

Name parts the way a British parts catalogue does: "trunnion" not "kingpin housing", "wing" not "fender", "boot lid" not "trunk lid", "silencer" not "muffler", "hood" for a soft top, "bonnet" for the engine cover.

Read any numbers cast or stamped into the part and report them exactly. Never invent a part number.

Be calibrated about confidence. A distinctive Triumph-specific casting photographed clearly is high confidence. A generic hose clip, bolt or bearing that a hundred cars share is low confidence however clear the picture, because the photo genuinely does not identify it.`;

/* Best-effort per-instance rate limit. Serverless instances come and go, so
 * this throttles casual abuse rather than providing a real guarantee. Put a
 * proper limiter in front of this if the site gets busy. */
const RECENT = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (RECENT.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(ip, hits);
  if (RECENT.size > 500) {
    for (const [key, times] of RECENT) {
      if (!times.some((t) => now - t < WINDOW_MS)) RECENT.delete(key);
    }
  }
  return hits.length > MAX_PER_WINDOW;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Send a POST request with a JSON body.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error:
        'The part identifier is not configured on this deployment. Set ANTHROPIC_API_KEY in the project environment variables to switch it on.',
    });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many photos in a short time. Give it a minute and try again.' });
  }

  const { image, mediaType } = req.body || {};

  if (typeof image !== 'string' || !image) {
    return res.status(400).json({ error: 'Include the photo as base64 in an "image" field.' });
  }
  if (!ALLOWED_TYPES.includes(mediaType)) {
    return res.status(400).json({ error: `Unsupported image type. Use one of: ${ALLOWED_TYPES.join(', ')}.` });
  }
  /* base64 inflates by about 4/3; check the decoded size. */
  if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'That photo is too large. Keep it under 5 MB.' });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: zodOutputFormat(PartIdentification),
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Identify this car part.' },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'The model declined to describe that image.' });
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return res.status(502).json({ error: 'The identification came back in an unexpected shape. Try another photo.' });
    }

    /* Fold a legible part number into the query — shop search boxes do far
     * better with the number than with a description. */
    const keywords = [...new Set([...(parsed.keywords || []), parsed.partNumber].filter(Boolean))];

    return res.status(200).json({
      part: parsed.partNumber ? `${parsed.part} ${parsed.partNumber}` : parsed.part,
      model: parsed.model,
      category: parsed.category,
      partNumber: parsed.partNumber,
      keywords,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'The identification service is rate limited right now. Try again shortly.' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ error: 'The identification service rejected its API key. Check ANTHROPIC_API_KEY on the deployment.' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(504).json({ error: 'Could not reach the identification service. Try again shortly.' });
    }
    console.error('identify failed:', err);
    return res.status(500).json({ error: 'The photo could not be identified. Try again, or describe the part instead.' });
  }
}

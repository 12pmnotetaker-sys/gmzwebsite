/**
 * The house style rules, as data, in one place.
 *
 * `content-lint.mjs` runs these over the built site. The portal's records
 * live in a database rather than in the build, so `src/data/portal/shapes.ts`
 * runs the same rules over every string in a record when it is written and
 * again when it is read. One home for the rules means the two cannot drift:
 * a word that fails the build fails a record too.
 *
 * Plain ES module with no imports, so both a Node script and a Vite bundle
 * can load it as it is.
 */

/**
 * Internal figures. Cost, margin, overhead, burdened rates and crew-day counts
 * are internal to GMZ and must never reach a client.
 *
 * Published prices are NOT this. The consultation fee, the maintenance walk and
 * the travel charge are prices to a client and belong on the site; what is
 * forbidden is the cost structure behind them. So this looks for the vocabulary
 * of internal costing, not for dollar signs.
 */
export const INTERNAL_TERMS =
  /\b(crew[-\s]?days?|truck[-\s]?days?|burdened|PMM|gross margin|profit margin|margin per day|overhead (?:rate|percent|percentage)|markup|cost[-\s]?plus|build[-\s]?up factor)\b/gi;

/** An hourly rate for labour. "$40/hr", "$45 per hour". */
export const HOURLY_RATE = /\$\s?\d{1,4}(?:\.\d{2})?\s*(?:\/\s*(?:hr|hour)|per\s+hour)\b/gi;

/**
 * Manufacturer and model names, which house style keeps out of prose: describe
 * the thing, not the SKU. A supplier logo strip is a deliberate, separate
 * exception and lives in markup rather than in a sentence.
 *
 * Deliberately excluded as too ambiguous to match on: Hunter, Vista, Toro.
 * They are ordinary words and a regex cannot tell which sense is meant.
 */
export const MANUFACTURERS =
  /\b(Belgard|Calstone|Rain\s?Bird|Netafim|Rachio|Irritrol|FX\s?Luminaire|Unilock|Techo-?Bloc|Smart\s?Rain)\b/g;

/** Em-dash. House style uses a comma, a semicolon or a colon instead. */
export const EM_DASH = /—/g;

/**
 * The rules that apply to a sentence a client reads, named as content-lint
 * names them so a report reads the same wherever it comes from.
 */
export const PROSE_RULES = [
  ['internal-figures', INTERNAL_TERMS],
  ['hourly-rate', HOURLY_RATE],
  ['em-dash', EM_DASH],
  ['manufacturer-in-prose', MANUFACTURERS],
];

/**
 * Every rule broken by one string, as `[rule, offending text]` pairs. Empty
 * when the string is clean.
 */
export function proseProblems(text) {
  const found = [];
  for (const [rule, pattern] of PROSE_RULES) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) found.push([rule, match[0]]);
  }
  return found;
}

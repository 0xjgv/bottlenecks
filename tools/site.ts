/**
 * The canonical origin, in one place.
 *
 * Fourteen strings across seven files named the host: the canonical link, the
 * Open Graph and Twitter URLs, the JSON-LD, the sitemap, robots.txt, llms.txt,
 * the generated glossary page and the README. Moving to a custom domain meant
 * finding all of them and missing one, and a stale canonical or an og:url
 * pointing at the old origin is the kind of mistake that survives for months
 * because nothing renders it visibly wrong.
 *
 * Build-time only, which is why it lives in tools/ rather than src/: the app
 * never needs to know its own address, only the metadata generated around it
 * does. Nothing here reaches the browser bundle.
 *
 * SITE_ORIGIN is the environment variable when set, so a deployment can name
 * itself. Otherwise the dev server's origin.
 */
export const DEFAULT_ORIGIN = 'http://localhost:5174';

export const SITE_ORIGIN = process.env.SITE_ORIGIN || DEFAULT_ORIGIN;

/** An absolute URL for a path, for metadata that cannot take a relative one. */
export function siteUrl(path = '/'): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Render the glossary as a static HTML page at build time.
 *
 * WHY THIS EXISTS. The glossary is a hundred plain-language explanations,
 * each written as a definition plus why it matters, which is exactly the
 * shape a search engine or an AI assistant quotes. All of it lived inside the
 * JS bundle, where no crawler reads it: the app renders it only after React
 * boots, and the page a crawler is served is an empty div.
 *
 * Generated from `src/content/glossary.ts` rather than written by hand, so
 * there is ONE source of truth. A second copy would drift the first time
 * somebody improved a definition in the app and forgot the page.
 *
 * Deliberately plain: no bundle, no hydration, no fonts to fetch. A reference
 * page's whole job is to be readable and quotable, and every kilobyte of
 * JavaScript on it works against that.
 */

import { CATEGORY_LABEL, GLOSSARY } from '../src/content/glossary.ts';
import type { GlossaryCategory, GlossaryEntry } from '../src/content/glossary.ts';
import { SITE_ORIGIN as SITE } from './site.ts';

/** Escape for HTML text and attribute values. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ORDER: GlossaryCategory[] = [
  'latency',
  'throughput',
  'failure',
  'capacity',
  'component',
  'unit',
];

function byCategory(): Array<[GlossaryCategory, GlossaryEntry[]]> {
  return ORDER.map((c) => [c, GLOSSARY.filter((e) => e.category === c)] as const)
    .filter(([, es]) => es.length > 0)
    .map(([c, es]) => [c, [...es]] as [GlossaryCategory, GlossaryEntry[]]);
}

/**
 * DefinedTermSet, which is the schema.org type that actually describes a
 * glossary. Marking it up as an Article would be a lie about the shape of
 * the content and would not earn the richer treatment a term set can get.
 */
function jsonLd(): string {
  const terms = GLOSSARY.map((e) => ({
    '@type': 'DefinedTerm',
    '@id': `${SITE}/glossary#${e.id}`,
    name: e.term,
    description: `${e.short}. ${e.why}`,
    inDefinedTermSet: `${SITE}/glossary`,
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${SITE}/glossary`,
    name: 'Flow of work glossary',
    description:
      'Plain-language definitions of the terms for how work flows through a startup and where it gets stuck, each with why it matters.',
    url: `${SITE}/glossary`,
    hasDefinedTerm: terms,
  });
}

function entryHtml(e: GlossaryEntry): string {
  const seeAlso =
    e.see && e.see.length > 0
      ? `\n        <p class="see">See also: ${e.see
          .map((id) => {
            const t = GLOSSARY.find((g) => g.id === id);
            return t ? `<a href="#${esc(id)}">${esc(t.term)}</a>` : null;
          })
          .filter(Boolean)
          .join(', ')}</p>`
      : '';
  return `      <div class="entry" id="${esc(e.id)}">
        <dt>${esc(e.term)}</dt>
        <dd>
          <p class="short">${esc(e.short)}</p>
          <p class="why">${esc(e.why)}</p>${seeAlso}
        </dd>
      </div>`;
}

export function renderGlossaryPage(): string {
  const sections = byCategory()
    .map(
      ([c, entries]) => `    <section aria-labelledby="cat-${c}">
      <h2 id="cat-${c}">${esc(CATEGORY_LABEL[c])}</h2>
      <dl>
${entries.map(entryHtml).join('\n')}
      </dl>
    </section>`,
    )
    .join('\n\n');

  const contents = byCategory()
    .map(([c]) => `<a href="#cat-${c}">${esc(CATEGORY_LABEL[c])}</a>`)
    .join('\n        ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flow of work glossary | Bottlenecks</title>
    <meta
      name="description"
      content="Plain-language definitions of ${GLOSSARY.length} terms for how work flows through a startup: the constraint, cycle time, throughput, backlogs, work in progress and more. Each explains what it means and why it matters."
    />
    <link rel="canonical" href="${SITE}/glossary" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <meta property="og:type" content="article" />
    <meta property="og:url" content="${SITE}/glossary" />
    <meta property="og:site_name" content="Bottlenecks" />
    <meta property="og:title" content="Flow of work glossary" />
    <meta
      property="og:description"
      content="${GLOSSARY.length} terms for how work flows through a startup, explained in plain language, each with why it matters."
    />
    <meta name="twitter:card" content="summary" />

    <script type="application/ld+json">
${jsonLd()}
    </script>

    <style>
      /* Inlined rather than linked: this page is one request, and a
         reference nobody has to wait for is the whole point. */
      :root {
        color-scheme: light dark;
        --bg: #faf7f3;
        --surface: #fffdfa;
        --text: #1e242e;
        --dim: #525862;
        --line: #e8e2da;
        --accent: #325cbd;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #16151a;
          --surface: #1d1c22;
          --text: #eceaf2;
          --dim: #a8a5b4;
          --line: #302f38;
          --accent: #6f9bf0;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 2.5rem 1.25rem 4rem;
        background: var(--bg);
        color: var(--text);
        font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
          Roboto, sans-serif;
      }
      main { max-width: 46rem; margin: 0 auto; }
      h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; }
      .lede { color: var(--dim); margin: 0 0 1.5rem; }
      nav { display: flex; flex-wrap: wrap; gap: .75rem; margin-bottom: 2.5rem; }
      nav a, .see a { color: var(--accent); }
      h2 {
        font-size: 1.15rem;
        margin: 2.5rem 0 .75rem;
        padding-bottom: .4rem;
        border-bottom: 1px solid var(--line);
      }
      dl { margin: 0; }
      .entry {
        padding: 1rem 0;
        border-bottom: 1px solid var(--line);
        scroll-margin-top: 1rem;
      }
      dt { font-weight: 600; margin-bottom: .25rem; }
      dd { margin: 0; }
      .short { margin: 0 0 .4rem; }
      .why, .see { margin: 0 0 .4rem; color: var(--dim); font-size: .95rem; }
      footer { margin-top: 3rem; color: var(--dim); font-size: .95rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Flow of work glossary</h1>
      <p class="lede">
        ${GLOSSARY.length} terms for how work flows through a startup, each
        explained in plain language with why it matters. From
        <a href="/">Bottlenecks</a>, where you map how work moves through your
        team, push more in, and find the one step that limits your output.
      </p>

      <nav aria-label="Categories">
        ${contents}
      </nav>

${sections}

      <footer>
        <p>
          These definitions are the same ones the app shows on hover.
          <a href="/">Open Bottlenecks</a> to see them against a flow of work
          that is actually running.
        </p>
      </footer>
    </main>
  </body>
</html>
`;
}

/**
 * Render the privacy policy as a static HTML page at build time, beside the
 * glossary and in the same plain style.
 *
 * Static for the same reason the glossary is: a policy has to be readable by
 * anyone who follows the link without the app booting first. Every claim here
 * describes code in this repository (local storage, the share store in
 * src/share/store.ts, the star count in src/useGithubStars.ts), so a change to
 * what any of those send has to change this page too.
 */

const UPDATED = '12 November 2026';

export function renderPrivacyPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy | Bottlenecks</title>
    <meta
      name="description"
      content="Bottlenecks runs in your browser. No accounts, no cookies, no analytics. Your maps of how work flows stay on your device."
    />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <style>
      :root {
        color-scheme: light dark;
        --bg: #faf7f3;
        --text: #1e242e;
        --dim: #525862;
        --line: #e8e2da;
        --accent: #325cbd;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #16151a;
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
      .lede { color: var(--dim); margin: 0 0 2rem; }
      h2 {
        font-size: 1.15rem;
        margin: 2.5rem 0 .75rem;
        padding-bottom: .4rem;
        border-bottom: 1px solid var(--line);
      }
      p, li { margin: 0 0 .75rem; }
      ul { padding-left: 1.25rem; margin: 0 0 .75rem; }
      a { color: var(--accent); }
      code { font-size: .92em; }
      footer { margin-top: 3rem; color: var(--dim); font-size: .95rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Privacy</h1>
      <p class="lede">
        Bottlenecks runs entirely in your browser. It has no accounts, sets no
        cookies, shows no ads, and loads no analytics or tracking. Last updated
        ${UPDATED}.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>
          The maps you build of how work flows through your team, your progress
          on the learning path, and your preferences are kept in this browser's
          local storage. They are never sent anywhere.
        </li>
        <li>
          The simulation runs on your device. No part of a design leaves it to
          be simulated.
        </li>
        <li>
          Clearing this site's data in your browser deletes all of it. Nobody
          else has a copy.
        </li>
      </ul>

      <h2>Share links</h2>
      <ul>
        <li>
          A share link carries the whole design in the part of the address
          after the <code>#</code>, which browsers never send to a server.
        </li>
        <li>
          Short share links exist only if whoever runs this copy of
          Bottlenecks has set up their own link store. Then a short link stores
          the design in that operator's store, encrypted in your browser
          first. The key stays in the <code>#</code> part of the link, so the
          store holds data it cannot read. Without a link store, short links
          are switched off and nothing is uploaded.
        </li>
      </ul>

      <h2>The one outside request</h2>
      <ul>
        <li>
          To show the source project's star count, the page asks GitHub's
          public API for it, so GitHub receives that request and your IP
          address. The count is cached in local storage, so this happens at
          most once every five minutes.
        </li>
      </ul>
      <p>Nothing is shared for advertising, and no data is sold.</p>

      <h2>Contact</h2>
      <p>
        Bottlenecks is run by whoever hosts this copy. Questions about it go to
        them. If this policy changes, this page changes with it, and the date
        at the top says when.
      </p>

      <footer>
        <p><a href="/">Back to Bottlenecks</a></p>
      </footer>
    </main>
  </body>
</html>
`;
}

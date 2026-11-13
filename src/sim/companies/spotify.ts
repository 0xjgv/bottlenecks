import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Spotify: autonomous squads still ship through one shared release.
 *
 * Sourced steps, by source:
 * - Spotify engineering, 2025: teams develop, test, review and merge their
 *   own code; once a week a release is branched off ("Once a release has
 *   been branched off, it is regarded as the current release"); teams run
 *   regression testing on the features they own; release-blocking bugs
 *   are fixed on the release branch; the build goes to the app stores only
 *   when "No blocking bug tickets remain open" and "All teams have signed
 *   off and approved"; the full-time Release Manager coordinates; once the
 *   app is approved it rolls out in phases.
 * - Spotify engineering, 2026: the Release Manager tracks "which teams have
 *   not completed their regression testing", moves the release between its
 *   states (branched, final release candidate, submitted for review, rolled
 *   out), and manually advancing a release caused delays until automation
 *   cut them. Waiting for app store approval is one of the time sinks.
 * "Squad" is Spotify's older word for such a team; the posts say "teams".
 *
 * Typical, not sourced: where product ideas come from, and listener support
 * passing listeners' reports on to a squad. In this model one squad takes
 * product ideas and the other the reports support passes on.
 *
 * Not drawn: tribes, chapters and guilds, the 2012 paper and the 2023
 * reorganisation: other lessons, or older. The weekly cadence itself is not
 * modelled: the release is drawn as a steady step, and that finished
 * changes wait there is the model's reading, not the posts' claim. The
 * order (regression testing, then blocking bugs, then sign-off, then the
 * release manager) is assembled from the release criteria; every change
 * passes each step in this model, so a step's time is an average over
 * changes that need much and changes that need little there.
 *
 * Every step is a `service`, so a change holds its place until it ships and
 * waiting at the release shows in cycle time, which is the lesson. A cron
 * would drop its own batch and refuse the squads' work; a backlog would let
 * the squad move on at the hand-over, so the wait would not show.
 *
 *   ideas       30/wk product ideas
 *   listeners   20/wk listener reports
 *   support     60 at once, 1h each                     -> 2400/wk (typical)
 *   squadA/B    4 people x 16 at once, half a day each  -> 640/wk own work
 *   branch      80 at once, 30 min each                 -> 6400/wk
 *   regression  80 at once, 1h each                     -> 3200/wk
 *   bugs        80 at once, 1h each                     -> 3200/wk
 *   signoff     6 teams x 16 at once, 30 min each       -> 7680/wk
 *               (every step above the release manager holds its slot while
 *               the release goes on, so most slots are changes blocked on
 *               it, which is why they get so many)
 *   release     1 release manager, 14 at once, 3h each, held through app
 *               store review and rollout (another 1.5h) -> 124/wk <- constraint
 *               load: 50/wk at 1x, 100 at 2x, 150 at 3x
 *   appstore    40 at once, 1h each                     -> 1600/wk
 *   rollout     40 at once, 30 min each                 -> 3200/wk
 *   Measured (seed 1): the release manager is 33% busy at 1x and nothing is
 *   dropped, slowest 1 in 100 at 2.4 days (2.5 and 2.4 on seeds 2 and 3);
 *   2x still holds. At 3x it is full: 124/wk ship, 17.0% is dropped at its
 *   full backlog and the slowest take 4.0 days, while the squads are 13%
 *   and 10% busy and every other step under 10%. Seeds 2 and 3 break at 3x
 *   too, at 17.5% and 18.2%. Doubling the people in both squads at 3x:
 *   15.8% dropped. Halving the release manager's hands-on time to 1.5h
 *   instead: nothing dropped on seeds 1 to 3, slowest 2.2 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('ideas', 'client', 'Product ideas', COL(0), LROW(0, 0), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('squadA', 'service', 'Squad A', COL(1), LROW(0, 0), {
      instances: 4,
      capacity: 16,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('squadB', 'service', 'Squad B', COL(1), LROW(1, 0), {
      instances: 4,
      capacity: 16,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('branch', 'service', 'Release branch', COL(2), LROW(0, 0), {
      capacity: 80,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('regression', 'service', 'Regression tests', COL(3), LROW(0, 0), {
      capacity: 80,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('bugs', 'service', 'Fix blocking bugs', COL(4), LROW(0, 0), {
      capacity: 80,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('signoff', 'service', 'Team sign-off', COL(4), LROW(1, 0), {
      instances: 6,
      capacity: 16,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('release', 'service', 'Release manager', COL(3), LROW(1, 0), {
      capacity: 14,
      serviceMs: 75,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('appstore', 'service', 'App store review', COL(2), LROW(1, 0), {
      capacity: 40,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('listeners', 'client', 'Listener reports', COL(0), LROW(2, 1), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('support', 'service', 'Listener support', COL(1), LROW(2, 1), {
      capacity: 60,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('rollout', 'service', 'Phased rollout', COL(2), LROW(2, 1), {
      capacity: 40,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('ideas', 'squadA'),
    edge('listeners', 'support'),
    edge('support', 'squadB'),
    edge('squadA', 'branch'),
    edge('squadB', 'branch'),
    edge('branch', 'regression'),
    edge('regression', 'bugs'),
    edge('bugs', 'signoff'),
    edge('signoff', 'release'),
    edge('release', 'appstore'),
    edge('appstore', 'rollout'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Product ideas are Spotify's own work, not output; listener reports are.
     App store review is the stores, not Spotify's people. */
  measures: {
    notOutput: ['ideas'],
    notPeople: ['appstore'],
  },
  annotations: [
    sectionOver('spt-sec-build', 'Building changes', 0, 0, 1, 0, 1, 0),
    sectionOver('spt-sec-release', 'Releasing the app every week', 1, 2, 4, 0, 1, 0),
    sectionOver('spt-sec-rollout', 'To listeners', 1, 2, 2, 2, 2, 1),
    sectionOver(
      'spt-sec-support',
      'Listener support (typical, not sourced)',
      2,
      0,
      1,
      2,
      2,
      1,
    ),
    note(
      'spt-note-lesson',
      40,
      504,
      "A squad is Spotify's word for a small product team. Each finishes changes on its own, but in this model every change then waits for the shared weekly release. Drag incoming work to 3x: the release manager is full, about 124 changes a week ship, 17 percent is dropped and the slowest take 4 days instead of 2.4. The squads stay under 15 percent busy.",
      360,
    ),
    note(
      'spt-note-fix',
      432,
      504,
      'More people in the squads do not help: double both at 3x and 16 percent is still dropped. A faster release step does; the blog says automating the hand-offs cut delays. In this model, select the release manager and halve the hands-on time per change from 3 hours to 1.5: at 3x nothing is dropped and the slowest change ships in 2.2 days, not 4.',
      320,
    ),
    note(
      'spt-note-source',
      784,
      504,
      "From Spotify's engineering blog: a weekly release is branched off, each team runs regression tests and signs off, blocking bugs are fixed, the release manager moves it on, and after app store review it rolls out in phases. Product ideas and listener support are typical, not from a source. Every number here is the model's, not Spotify's.",
      360,
    ),
  ],
};

export const spotify: CompanyPreset = {
  id: 'spotify',
  name: 'Spotify',
  tagline: 'Autonomous teams still share one release',
  description:
    'A simplified model of the whole company from public sources, with product ideas and listener support as typical steps where the sources are silent. Turn up incoming work and watch finished changes queue at the release manager while the product teams and every other release step still have room.',
  sources: [
    {
      title: 'Spotify engineering, 2025',
      url: 'https://engineering.atspotify.com/2025/4/how-we-release-the-spotify-app-part-1',
    },
    {
      title: 'Spotify engineering, 2026',
      url: 'https://engineering.atspotify.com/2026/2/how-we-release-the-spotify-app-part-2',
    },
  ],
  constraint: 'release',
  typical: ['support'],
  topology,
};

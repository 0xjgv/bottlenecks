import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Stripe: coding agents write in parallel, people review every change.
 *
 * Sourced steps, by source:
 * - Stripe blog, coding agents, 2026: developers still plan and work with
 *   agents, but developer attention is one of the most constrained
 *   resources, so unattended agents run tasks in parallel. A run ends in a
 *   pull request that passes its checks and is ready for human review.
 *   That gives engineers, coding agents and human review, and makes review
 *   the constraint: it is where agent work meets developer attention. That
 *   reading is the model's; the blog names attention.
 * - Stripe blog, part 2, 2026: each change goes back to its human operator
 *   for scrutiny, and merged agent changes are human-reviewed. That gives
 *   merge after review, for every change.
 * - Stripe blog, API releases, 2024: since October 2024 API changes go out
 *   on a schedule, twice-yearly major releases and monthly updates. That is
 *   the scheduled release, which pulls from a backlog.
 * - Stripe blog, API to SDKs, 2026: at release time the API description is
 *   passed on and the reference docs, libraries (SDKs, software
 *   development kits) and command line tool are regenerated, and keeping
 *   them in sync is a significant challenge. That is "SDKs and docs".
 * - Stripe Sessions keynote, 2025: API Review is a standing institution
 *   that reviews API changes, hundreds a year. That gives API Review.
 *
 * Typical, not sourced: businesses signing up, being sold to and asking
 * for help. One frontline step stands for sales and support; it settles
 * three in four asks itself and turns the rest into engineering tasks.
 *
 * The order is assembled. No current source says where API Review sits in
 * the flow; in the model it is a gate after merge that only API changes
 * pass, before the scheduled release. So "API change?" sorts reviewed
 * changes into two merge steps, one for API changes and one for the rest;
 * both are the same merge at Stripe, drawn twice only so that API changes
 * alone go on to API Review. The share of API changes, one in three, is
 * the model's. Other changes end at merge: how they reach businesses is
 * not drawn. The sources describe human review for agent changes, so engineers' own
 * changes are left out rather than drawn skipping review. The people who
 * review are a step of their own, though at the company they are the same
 * engineers; the engineers box is their planning and hand-off to agents.
 * Not drawn: the product architects' pre-release review of merged API
 * changes (API to SDKs post), for room; written proposals, whose sources
 * may be stale; the gradual rollout, whose only source is a paywalled
 * secondary piece.
 *
 * Engineers hold a task while their agent runs and the change is
 * reviewed, and an agent holds its slot while its change waits for review
 * and merge, so most of their slots are tasks blocked waiting, which is
 * why they get so many. Review holds its slot while the change merges and,
 * for an API change, passes API Review, which is why those are kept short.
 *
 *   planned    28/wk planned engineering tasks
 *   businesses 80/wk asks from businesses
 *   frontline  64 at once, 30 min each, settles 3 in 4 -> 5120/wk
 *              (60 of 80 settled; 20/wk become engineering tasks)
 *   engineers  10 people x 16 at once, 1h each          -> 6400/wk own work
 *   agents     up to 100 at once, 2h a run, 1h to ramp up a new one, an
 *              idle one stays 2 weeks
 *   review     6 people x 3 at once, 1 day each       ->   90/wk <- constraint
 *              (less the time each slot is held while the change merges
 *              and passes API Review: measured, it finishes 85.6/wk at 2x)
 *              load: 28 + 20 = 48/wk at 1x, 72 at 1.5x, 96 at 2x
 *              (18 slots rather than 3, so the step does not read red on
 *              the canvas at normal load)
 *   kind       sends 1 in 3 reviewed changes on as API changes
 *   merge      16 at once, 6 min each                   -> 6400/wk (32/wk)
 *   mergeApi   16 at once, 6 min each                   -> 6400/wk (16/wk)
 *   apiReview  32 at once, 1h each                      -> 1280/wk
 *   release    pulls from its backlog, 8 at once, 30 min ->  640/wk
 *   sdks       16 at once, 1h each                      ->  640/wk
 *   Measured (seed 1): nothing dropped at 1x or 1.5x, slowest 1 in 100 at
 *   2.7 and 2.8 days (1x: 2.7, 2.8, 2.6 days on seeds 1, 2, 3). At 2x
 *   review is 93% busy and full, 4.8% is dropped and the slowest take 4.8
 *   days; engineers are 1 to 2% busy and the agents hold 54 to 56 changes
 *   blocked on review (seeds 1 to 3). Seeds 2 and 3 break at 2x too, at
 *   2.4% and 5.0%. Raising the agents' cap to 200 at 2x: 4.8, 2.4, 5.0%
 *   dropped, unchanged. Eight reviewers at 2x: nothing dropped on seeds 1
 *   to 3, slowest 2.6 days on seed 1. Review in 6h instead of a day
 *   (smaller changes) at 2x: nothing dropped on seeds 1 to 3, 2.3 days on
 *   seed 1.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('planned', 'client', 'Planned work', COL(0), LROW(0, 0), {
      rps: 28,
      timeoutMs: 3000,
    }),
    node('engineers', 'service', 'Engineers', COL(1), LROW(0, 0), {
      instances: 10,
      capacity: 16,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('agents', 'lambda', 'Coding agents', COL(2), LROW(0, 0), {
      serviceMs: 50,
      serviceCv: 0.5,
      coldStartMs: 25,
      keepWarmMs: 2000,
      maxConcurrency: 100,
    }),
    node('review', 'service', 'Human review', COL(3), LROW(0, 0), {
      instances: 6,
      capacity: 3,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('kind', 'lb', 'API change?', COL(4), LROW(0, 0)),
    node('merge', 'service', 'Merge', COL(3), LROW(1, 1), {
      capacity: 16,
      serviceMs: 2.5,
      serviceCv: 0.3,
      queueLimit: 60,
    }),
    node('businesses', 'client', 'Businesses', COL(0), LROW(1, 1), {
      rps: 80,
      timeoutMs: 3000,
    }),
    node('frontline', 'edgecompute', 'Sales and support', COL(1), LROW(1, 1), {
      capacity: 64,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
      edgeShare: 0.75,
      cpuMsCap: 0,
    }),
    node('mergeApi', 'service', 'Merge API change', COL(4), LROW(1, 1), {
      capacity: 16,
      serviceMs: 2.5,
      serviceCv: 0.3,
      queueLimit: 60,
    }),
    node('sdks', 'service', 'SDKs and docs', COL(1), LROW(2, 2), {
      capacity: 16,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('release', 'worker', 'Scheduled release', COL(2), LROW(2, 2), {
      capacity: 8,
      serviceMs: 12.5,
      serviceCv: 0.3,
    }),
    node('next', 'queue', 'Next API release', COL(3), LROW(2, 2), {
      queueLimit: 500,
    }),
    node('apiReview', 'service', 'API Review', COL(4), LROW(2, 2), {
      capacity: 32,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('planned', 'engineers'),
    edge('businesses', 'frontline'),
    edge('frontline', 'engineers'),
    edge('engineers', 'agents'),
    edge('agents', 'review'),
    edge('review', 'kind'),
    edge('kind', 'merge', 2),
    edge('kind', 'mergeApi', 1),
    edge('mergeApi', 'apiReview'),
    edge('apiReview', 'next'),
    edge('next', 'release'),
    edge('release', 'sdks'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Planned work is Stripe's own, not output; businesses are. Coding agents
     are contractors, never counted as people. */
  measures: {
    notOutput: ['planned'],
  },
  annotations: [
    sectionOver(
      'stp-sec-build',
      'Engineers plan, agents write, people review',
      0,
      1,
      4,
      0,
      0,
      0,
    ),
    sectionOver(
      'stp-sec-business',
      'Sales and support (typical, not sourced)',
      2,
      0,
      1,
      1,
      1,
      1,
    ),
    sectionOver('stp-sec-merge', 'Merging reviewed changes', 1, 3, 4, 1, 1, 1),
    sectionOver(
      'stp-sec-release',
      'Releasing API changes on a schedule',
      3,
      1,
      4,
      2,
      2,
      2,
    ),
    note(
      'stp-note-lesson',
      40,
      568,
      'Engineers hand tasks to coding agents, which run many at once, and every change they write comes back to a person for review. Drag incoming work to 2x: in this model review fills, the agents sit blocked on it, 4.8 percent of work is dropped and the slowest change takes 4.8 days instead of 2.7.',
      400,
    ),
    note(
      'stp-note-fix',
      480,
      568,
      'More agents do not fix it: raise their cap from 100 to 200 at 2x and 4.8 percent is still dropped. More review does: add two reviewers, from 6 to 8, or make changes small enough to review in 6 hours instead of a day, and at 2x nothing is dropped.',
      360,
    ),
    note(
      'stp-note-source',
      880,
      568,
      "Stripe's blog calls developer attention one of its most constrained resources and sends every change its coding agents write back to a person for review. Changes to its API, the interface businesses build on, pass API Review, described in its 2025 Sessions keynote, then go out on a schedule and into its SDKs (software development kits) and docs. Sales and support are typical, not from a source. Every number here is the model's, not Stripe's.",
      360,
    ),
  ],
};

export const stripe: CompanyPreset = {
  id: 'stripe',
  name: 'Stripe',
  tagline: 'Agents write more, people review it all',
  description:
    'A simplified model of the whole company from public sources, with sales and support as a typical step where the sources are silent. Turn up incoming work and watch human review fill while engineers and their coding agents sit waiting on it.',
  sources: [
    {
      title: 'Stripe blog, coding agents, 2026',
      url: 'https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents',
    },
    {
      title: 'Stripe blog, part 2, 2026',
      url: 'https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2',
    },
    {
      title: 'Stripe blog, API releases, 2024',
      url: 'https://stripe.com/blog/introducing-stripes-new-api-release-process',
    },
    {
      title: 'Stripe blog, API to SDKs, 2026',
      url: 'https://stripe.dev/blog/how-api-changes-flow-into-stripes-developer-products',
    },
    {
      title: 'Stripe Sessions keynote, 2025',
      url: 'https://stripe.com/sessions/2025/developer-keynote',
    },
  ],
  constraint: 'review',
  typical: ['frontline'],
  topology,
};

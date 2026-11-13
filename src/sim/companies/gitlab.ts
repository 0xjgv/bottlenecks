import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * GitLab: any engineer can review a change, only a maintainer accepts it.
 *
 * Sourced steps, by source:
 * - Handbook, product development flow: product managers and designers
 *   validate a problem before engineering picks it up, and aim to stay
 *   about two months ahead of the build. An issue then moves through the
 *   statuses ready for development, in development and in review. The
 *   engineers' backlog is "ready for development", the engineers are "in
 *   development" and the reviewers "in review".
 * - Handbook, code review: all engineers can review merge requests but
 *   only maintainers can accept them, and as engineers and merge requests
 *   grow, reviews per maintainer become unsustainable. It aims to keep the
 *   engineer to maintainer ratio under 6. That makes maintainers the
 *   constraint.
 * - Docs, code review: after the reviewer approves, a maintainer reviews
 *   and merges, and at least one maintainer must approve. A bot picks a
 *   reviewer and maintainer for each area a change touches, and specialist
 *   approvers (database, frontend, design, security, technical writing)
 *   are added by what it touches. "What it touches" is that routing.
 * - Handbook, releases: merged work ships in the monthly release, which
 *   release managers own. A change that misses the deadline waits for the
 *   next one.
 * - Handbook, handbook first: work, process and policy are written down so
 *   team members do not ask and re-ask for the same answers.
 *
 * Typical, not sourced: customers asking for help, and support. Who asks
 * the handbook and where an unanswered ask goes are the model's: a support
 * person looks there first, what it answers ends there, and the rest
 * becomes a problem for product managers to validate.
 *
 * Not drawn: directly responsible individuals decide, but no work queues
 * at them. The option of handing approval to a review agent is new and
 * left out.
 *
 * The order is assembled; no single page gives it end to end. Reviewer
 * then maintainer is an order, so it is a chain. In the model the
 * specialist review sits between reviewer and maintainer, and 2 in 5
 * changes pass it: neither the place nor the share is sourced. Validation
 * runs ahead of the build at GitLab, but here product managers hold an item
 * until it merges, so cycle time runs from the ask to the merge; their
 * slots are mostly tasks blocked waiting, which is why they get so many.
 * The release pulls from a backlog, so a maintainer merges and moves on;
 * the monthly cadence itself is not modelled and never shows in cycle time.
 *
 *   problems    30/wk problems to validate
 *   customers   80/wk asks for help
 *   support     4 people x 25 at once, 30 min each     -> 8000/wk own work
 *   handbook    32 at once, 30 min, answers 3 in 4     -> 2560/wk
 *               (60 of 80 asks answered; 20/wk go on to validation)
 *   validation  6 people x 20 at once, 1h each         -> 4800/wk own work
 *   engineers   10 people x 10 at once, 2h each        -> 2000/wk own work
 *   reviewers   10 people x 10 at once, 1h each        -> 4000/wk own work
 *   touches     sends 2 in 5 changes to specialist review
 *   specialists 64 at once, 1h each                    -> 2560/wk (20/wk)
 *               (every step above maintainers holds its slot while they
 *               work, so most of those slots are tasks blocked waiting on
 *               them, which is why the teams get so many)
 *   maintainers 9 people x 2 at once, 1 day each       ->   90/wk <- constraint
 *               load: 30 + 20 = 50/wk at 1x, 75 at 1.5x, 100 at 2x
 *               (18 slots rather than a few long ones, so the step does
 *               not read red at normal load; hands-on times are short so
 *               the slowest 1 in 100 at 1x stays under 3.5 days)
 *   release     pulls from its backlog, 8 at once, 30 min -> 640/wk
 *   Measured (seed 1): nothing dropped at 1x or 1.5x, slowest 1 in 100 at
 *   2.7 and 3 days (1x: 2.7, 2.9, 3 days on seeds 1, 2, 3). At 2x
 *   maintainers are 100% busy and finish 90/wk, 4.8% is dropped and the
 *   slowest take 4.8 days; engineers are 5% busy and reviewers 2%, with 45 and 44 tasks
 *   blocked waiting on a maintainer. Seeds 2 and 3 break at 2x too, at
 *   5.4% and 4.0%. Doubling engineers and reviewers to 20 each at 2x: 4.8,
 *   5.4, 4.0% dropped, unchanged. Eleven maintainers at 2x: nothing dropped
 *   on seeds 1 to 3, slowest 3 days on seed 1.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('problems', 'client', 'Problems to solve', COL(0), LROW(0, 0), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('validation', 'service', 'Validation', COL(1), LROW(0, 0), {
      instances: 6,
      capacity: 20,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('engineers', 'service', 'Engineers', COL(2), LROW(0, 0), {
      instances: 10,
      capacity: 10,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('reviewers', 'service', 'Reviewers', COL(3), LROW(0, 0), {
      instances: 10,
      capacity: 10,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('touches', 'lb', 'What it touches', COL(4), LROW(0, 0)),
    node('handbook', 'cache', 'Handbook', COL(1), LROW(1, 1), {
      capacity: 32,
      serviceMs: 12.5,
      serviceCv: 0.4,
      hitRate: 0.75,
      queueLimit: 40,
    }),
    node('specialists', 'service', 'Specialist review', COL(3), LROW(1, 1), {
      capacity: 64,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('maintainers', 'service', 'Maintainers', COL(4), LROW(1, 1), {
      instances: 9,
      capacity: 2,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('customers', 'client', 'Customers', COL(0), LROW(2, 2), {
      rps: 80,
      timeoutMs: 3000,
    }),
    node('support', 'service', 'Support', COL(1), LROW(2, 2), {
      instances: 4,
      capacity: 25,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('release', 'worker', 'Monthly release', COL(3), LROW(2, 2), {
      capacity: 8,
      serviceMs: 12.5,
      serviceCv: 0.3,
    }),
    node('merged', 'queue', 'Merged changes', COL(4), LROW(2, 2), {
      queueLimit: 500,
    }),
  ],
  edges: [
    edge('problems', 'validation'),
    edge('customers', 'support'),
    edge('support', 'handbook'),
    edge('handbook', 'validation'),
    edge('validation', 'engineers'),
    edge('engineers', 'reviewers'),
    edge('reviewers', 'touches'),
    edge('touches', 'specialists', 2),
    edge('touches', 'maintainers', 3),
    edge('specialists', 'maintainers'),
    edge('maintainers', 'merged'),
    edge('merged', 'release'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Problems to solve are GitLab's own work, not output; customers are. The
     handbook is a document, not people. */
  measures: {
    notOutput: ['problems'],
    notPeople: ['handbook'],
  },
  annotations: [
    sectionOver(
      'gtl-sec-validate',
      'Product managers and designers validating problems',
      0,
      0,
      1,
      0,
      0,
      0,
    ),
    sectionOver(
      'gtl-sec-build',
      'Building: ready for development, in development, in review',
      1,
      2,
      4,
      0,
      0,
      0,
    ),
    sectionOver('gtl-sec-handbook', 'Asking the handbook first', 3, 0, 1, 1, 1, 1),
    sectionOver('gtl-sec-accept', 'Accepting changes', 1, 3, 4, 1, 1, 1),
    sectionOver(
      'gtl-sec-support',
      'Customers and support (typical, not sourced)',
      2,
      0,
      1,
      2,
      2,
      2,
    ),
    sectionOver('gtl-sec-ship', 'Shipping each month', 3, 3, 4, 2, 2, 2),
    note(
      'gtl-note-lesson',
      40,
      568,
      'Every merge request, a proposed change to the code, is reviewed by an engineer and then needs a maintainer, one of nine in this model, to approve and merge it. Drag incoming work to 2x: maintainers are 100 percent busy, 4.8 percent of work is dropped and the slowest take 4.8 days instead of 2.7. Engineers and reviewers stay under 10 percent busy, their tasks blocked waiting on a maintainer.',
      400,
    ),
    note(
      'gtl-note-fix',
      480,
      568,
      'More engineers do not help: double the engineers and the reviewers at 2x and 4.8 percent is still dropped. More maintainers do: select maintainers, add two, from 9 to 11, and at 2x dropped work falls from 4.8 percent to nothing and the slowest change takes 3 days.',
      360,
    ),
    note(
      'gtl-note-source',
      880,
      568,
      "GitLab's handbook says all engineers can review merge requests but only maintainers can accept them, that reviews per maintainer become unsustainable as engineers grow, and aims for fewer than six engineers per maintainer. The other steps follow its handbook and docs; customers and support are typical, not from a source. Every number here is the model's, not GitLab's.",
      360,
    ),
  ],
};

export const gitlab: CompanyPreset = {
  id: 'gitlab',
  name: 'GitLab',
  tagline: 'Anyone can review, only maintainers accept',
  description:
    'A simplified model of the whole company from public sources, with customers and support as typical steps where the sources are silent. Turn up incoming work and watch the maintainers fill while product managers, engineers and reviewers wait on them.',
  sources: [
    {
      title: 'GitLab handbook, code review',
      url: 'https://handbook.gitlab.com/handbook/engineering/workflow/code-review/',
    },
    {
      title: 'GitLab docs, code review',
      url: 'https://docs.gitlab.com/development/code_review/',
    },
    {
      title: 'GitLab handbook, releases',
      url: 'https://handbook.gitlab.com/handbook/engineering/releases/',
    },
    {
      title: 'GitLab handbook, product flow',
      url: 'https://handbook.gitlab.com/handbook/product-development/how-we-work/product-development-flow/',
    },
    {
      title: 'GitLab handbook, handbook-first',
      url: 'https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/',
    },
  ],
  constraint: 'maintainers',
  typical: ['support'],
  topology,
};

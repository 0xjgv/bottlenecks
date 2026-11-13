import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * GitLab: any engineer can review a change, only a maintainer accepts it.
 *
 * Shape, from the sources: all engineers can review merge requests but
 * only maintainers can accept them, and as engineers and merge requests
 * grow, reviews per maintainer become unsustainable; the handbook aims to
 * keep the engineer to maintainer ratio under 6 [handbook, code review].
 * After the reviewer approves, a maintainer reviews and merges [docs, code
 * review]. Merged work ships in the monthly release [handbook, releases].
 * No single page gives the order end to end; the chain is assembled from
 * those three.
 *
 * Reviewer then maintainer is an order. The engine calls every step a team
 * points at in parallel, so the order is drawn as a chain: engineers ->
 * reviewers -> maintainers. Reviewers are engineers too; they are a separate
 * step only so the order holds. The release pulls from a backlog, so a
 * maintainer merges and moves on rather than holding the change until the
 * release. The monthly cadence itself is not modelled: the release takes
 * merged work as it comes, so it never shows in cycle time. Specialist
 * approvers, the review agent and the validation track are other lessons
 * and are left out.
 *
 *   work        45/wk merge requests
 *   engineers   10 people x 8 at once, 2h each         -> 1600/wk own work
 *   reviewers   10 people x 8 at once, 1h each         -> 3200/wk own work
 *               (most of those slots are tasks blocked waiting on a
 *               maintainer, which is why the teams get so many)
 *   maintainers 8 people x 2 at once, 1 day each       ->  80/wk <- constraint
 *               load: 45/wk at 1x, 68 at 1.5x, 90 at 2x
 *               (16 slots rather than 3 at about the same ceiling: with
 *               only 3, all were often taken at once at 1x and the step
 *               read red on the canvas at normal load. Hands-on times are
 *               kept short enough that the slowest 1 in 100 at 1x stays
 *               under the 4 days the app marks amber.)
 *   release     pulls from its backlog, 8 at once, 30 min -> 640/wk
 *   Measured (seed 1): nothing dropped at 1x or 1.5x, slowest 1 in 100 at
 *   2.7 and 3.1 days (1x: 2.7, 2.9, 2.7 days on seeds 1, 2, 3). At 2x
 *   maintainers are full, finish 79.5/wk, 8.7% is dropped and the slowest
 *   take 1.1 weeks; engineers are 6% busy and reviewers 3%, with 54 and 51
 *   tasks blocked waiting on a maintainer. Doubling engineers and
 *   reviewers to 20 each at 2x, seeds 1, 2, 3: 8.7, 11.6, 9.2% dropped,
 *   unchanged. Ten maintainers at 2x: nothing dropped on any seed, slowest
 *   3.1 days on seed 1.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('work', 'client', 'Planned work', COL(0), ROW(0), {
      rps: 45,
      timeoutMs: 3000,
    }),
    node('engineers', 'service', 'Engineers', COL(1), ROW(0), {
      instances: 10,
      capacity: 8,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('reviewers', 'service', 'Reviewers', COL(2), ROW(0), {
      instances: 10,
      capacity: 8,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('maintainers', 'service', 'Maintainers', COL(3), ROW(0), {
      instances: 8,
      capacity: 2,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('merged', 'queue', 'Merged changes', COL(4), ROW(0), {
      queueLimit: 500,
    }),
    node('release', 'worker', 'Monthly release', COL(5), ROW(0), {
      capacity: 8,
      serviceMs: 12.5,
      serviceCv: 0.3,
    }),
  ],
  edges: [
    edge('work', 'engineers'),
    edge('engineers', 'reviewers'),
    edge('reviewers', 'maintainers'),
    edge('maintainers', 'merged'),
    edge('merged', 'release'),
  ],
  annotations: [
    sectionOver('gtl-sec-write', 'Writing and reviewing changes', 0, 1, 2, 0, 0),
    sectionOver('gtl-sec-accept', 'Accepting changes', 1, 3, 3, 0, 0),
    sectionOver('gtl-sec-ship', 'Shipping each month', 2, 4, 5, 0, 0),
    note(
      'gtl-note-lesson',
      40,
      200,
      'Every merge request, a proposed change to the code, is reviewed by an engineer and then needs a maintainer, one of eight in this model, to approve and merge it. Drag incoming work to 2x: maintainers are 100 percent busy, 8.7 percent of changes are dropped and the slowest take 1.1 weeks instead of 2.7 days. Engineers and reviewers stay under 10 percent busy, their tasks blocked waiting on a maintainer.',
      400,
    ),
    note(
      'gtl-note-fix',
      480,
      200,
      'More engineers do not help: double the engineers and the reviewers at 2x and 8.7 percent is still dropped. More maintainers do: select maintainers, add two, from 8 to 10, and at 2x dropped work falls from 8.7 percent to nothing and the slowest change takes 3.1 days.',
      360,
    ),
    note(
      'gtl-note-source',
      880,
      200,
      "GitLab's handbook says all engineers can review merge requests but only maintainers can accept them, and that reviews per maintainer become unsustainable as engineers grow; it aims for fewer than six engineers per maintainer. Every number here is the model's, not GitLab's.",
      360,
    ),
  ],
};

export const gitlab: CompanyPreset = {
  id: 'gitlab',
  name: 'GitLab',
  tagline: 'Anyone can review, only maintainers accept',
  description:
    'A simplified model from public sources: engineers open merge requests, any engineer reviews them, and only a maintainer can approve and merge one before the monthly release. Turn up incoming work and watch the maintainers fill while engineers and reviewers wait on them.',
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
  ],
  constraint: 'maintainers',
  topology,
};

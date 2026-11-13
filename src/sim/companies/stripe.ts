import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Stripe: coding agents write in parallel, people review every change.
 *
 * Shape, from the sources: developers still plan and work with agents
 * themselves, but developer attention is one of the most constrained
 * resources, so unattended agents run tasks in parallel, and a run ends in
 * a pull request that passes its checks and is ready for human review
 * [blog, part 1]. Each change goes back to its human operator for scrutiny,
 * and the merged agent changes are human-reviewed [blog, part 2]. That
 * review is where agent work waits is the model's reading, not the blog's;
 * the blog names attention.
 *
 * Choices no source makes: the agents are drawn as contractors (they
 * scale on demand up to a cap, with ramp-up); that framing is the model's.
 * The people who review are a step of their own, though at the company
 * they are the same engineers. API Review, release batching and planning
 * are other lessons and are left out.
 *
 * An agent holds its slot while its change waits for review and merge, and
 * a reviewer holds theirs while the change merges, which is why merge is
 * kept short.
 *
 *   tasks      48/wk engineering tasks handed to agents
 *   agents     up to 60 at once, 2h a run, 1h to ramp up a new one, an
 *              idle one stays 2 weeks; each holds its change through
 *              review, so at the cap it is ~60 changes waiting, not 60 runs
 *   review     6 people x 3 at once, 1 day each, plus 6 min held while the
 *              change merges                         ->  ~89/wk <- constraint
 *              load: 48/wk at 1x, 72 at 1.5x, 96 at 2x
 *              (18 slots rather than 3: with only 3, all were often taken
 *              at once at 1x and the step read red on the canvas at
 *              normal load)
 *   merge      16 at once, 6 min each                  -> 6400/wk
 *   Measured (seed 1): nothing dropped at 1x or 1.5x, slowest 1 in 100 at
 *   2.7 and 3 days. At 2x review is 99% busy, the agents hold 27 changes
 *   blocked on it, 88.5/wk finish, 9.0% is dropped and the slowest take
 *   4.7 days. Raising the agents' cap to 120 at 2x, seeds 1, 2, 3: work
 *   finished 88.5 -> 89.7, 89.3 -> 89.8, 88.1 -> 87.0 a week; slowest
 *   4.7 -> 4.9 days on every seed; dropped 9.0 -> 10.1, 8.0 -> 7.6,
 *   7.9 -> 8.2%. Still broken at every seed. Eight reviewers at 2x: nothing
 *   dropped on any seed, 2.9 days on seed 1. Review in 6h instead of a day
 *   (smaller changes) at 2x: nothing dropped on any seed, 2.2 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('tasks', 'client', 'Engineering tasks', COL(0), ROW(0), {
      rps: 48,
      timeoutMs: 3000,
    }),
    node('agents', 'lambda', 'Coding agents', COL(1), ROW(0), {
      serviceMs: 50,
      serviceCv: 0.5,
      coldStartMs: 25,
      keepWarmMs: 2000,
      maxConcurrency: 60,
    }),
    node('review', 'service', 'Human review', COL(2), ROW(0), {
      instances: 6,
      capacity: 3,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('merge', 'service', 'Merge', COL(3), ROW(0), {
      capacity: 16,
      serviceMs: 2.5,
      serviceCv: 0.3,
      queueLimit: 60,
    }),
  ],
  edges: [edge('tasks', 'agents'), edge('agents', 'review'), edge('review', 'merge')],
  annotations: [
    sectionOver('stp-sec-review', 'Checking agent work', 0, 2, 2, 0, 0),
    note(
      'stp-note-lesson',
      40,
      200,
      'Engineering tasks go to coding agents, which run many at once, and every change they write comes back to a person for review. Drag incoming work to 2x: in this model review is 99 percent busy, the agents sit blocked on it, 9 percent of work is dropped and the slowest change takes 4.7 days instead of 2.7.',
      400,
    ),
    note(
      'stp-note-fix',
      480,
      200,
      'More agents do not fix it: raise their cap from 60 to 120 at 2x and work finished stays near 89 a week, while the slowest change takes 4.9 days instead of 4.7. More review does: add two reviewers, from 6 to 8, or make changes small enough to review in 6 hours instead of a day, and at 2x nothing is dropped.',
      360,
    ),
    note(
      'stp-note-source',
      880,
      200,
      "Stripe's blog calls developer attention one of its most constrained resources, and sends each change from its coding agents, which it calls Minions, back to a person for review. Every number here is the model's, not Stripe's.",
      360,
    ),
  ],
};

export const stripe: CompanyPreset = {
  id: 'stripe',
  name: 'Stripe',
  tagline: 'Agents write more, people review it all',
  description:
    'A simplified model from public sources: engineering tasks go to unattended coding agents, and every change an agent writes goes back to a person for review before it merges. Turn up incoming work and watch human review fill while the agents sit waiting on it.',
  sources: [
    {
      title: 'Stripe blog, coding agents, 2026',
      url: 'https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents',
    },
    {
      title: 'Stripe blog, part 2, 2026',
      url: 'https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2',
    },
  ],
  constraint: 'review',
  topology,
};

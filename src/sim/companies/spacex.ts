import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * SpaceX, in its 2024 shape: fast teams wait on an outside licence.
 *
 * Shape, from the sources: SpaceX builds by rapid, iterative testing
 * [National Geographic, not linked], and each part has a responsible
 * engineer who owns it [Reuters]. In 2024
 * SpaceX said its rocket was ready weeks before the regulator's licence;
 * the regulator said SpaceX was still changing the flight [SpacePolicy
 * Online]. Both sides fit one unit of work: a flight change, built and
 * tested inside the company, reviewed by the regulator when it affects
 * the licence. The order is assembled from those sources. The regulator
 * raised its yearly launch cap in 2025 [Satnews] and no 2025 or 2026
 * source names today's limit, so this is the 2024 shape, not today's.
 *
 * The licence is a decision maker (`db`): one approver every change that
 * needs it waits on, and the company cannot hire into it. "Affects
 * licence?" is a dispatcher (`lb`) that sends 2 in 5 changes to the
 * review and the rest straight to the flight. No source names a sorting
 * step or the share; the engine needs a dispatcher to send only some work
 * down one path, because a team calls every step it points at.
 *
 *   changes     50/wk flight changes
 *   engineering 6 people x 25 at once, half a day each -> 1500/wk own work
 *   testing     4 people x 25 at once, half a day each -> 1000/wk own work
 *               (most of those slots are changes blocked waiting on the
 *               licence, which is why the teams get so many)
 *   licence     10 at once, 1 day each               ->  50/wk <- constraint
 *               load: 20/wk at 1x, 40 at 2x, 60 at 3x
 *   flight      20 at once, 1h each                  -> 800/wk
 *   Measured (seeds 1, 2, 3): nothing dropped up to 2x; at 3x the licence
 *   is full, 5.5 to 6.1% dropped, the slowest 1 in 100 at 1.4 to 1.5
 *   weeks against 3.4 to 3.5 days at 1x, and engineering and testing are
 *   8 to 16% busy with 50 to 63 changes each blocked on the review.
 *   Doubling engineering, or engineering and testing, at 3x: the same
 *   5.5 to 6.1% dropped. Sending 1 in 5 changes to the review instead of
 *   2 in 5: nothing dropped at 3x or 4x, slowest 3.1 to 3.8 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('changes', 'client', 'Flight changes', COL(0), ROW(1), {
      rps: 50,
      timeoutMs: 3000,
    }),
    node('engineering', 'service', 'Engineering', COL(1), ROW(1), {
      instances: 6,
      capacity: 25,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('testing', 'service', 'Testing', COL(2), ROW(1), {
      instances: 4,
      capacity: 25,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('sort', 'lb', 'Affects licence?', COL(3), ROW(1), { capacity: 256 }),
    node('licence', 'db', 'Licence review', COL(4), ROW(0), {
      capacity: 10,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
    node('flight', 'service', 'Flight', COL(5), ROW(1), {
      capacity: 20,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('changes', 'engineering'),
    edge('engineering', 'testing'),
    edge('testing', 'sort'),
    edge('sort', 'licence', 2),
    edge('sort', 'flight', 3),
    edge('licence', 'flight'),
  ],
  annotations: [
    sectionOver('spx-sec-build', 'Building and testing', 0, 1, 2, 1, 1),
    sectionOver('spx-sec-licence', 'Licensing the flight', 1, 4, 4, 0, 0),
    note(
      'spx-note-source',
      40,
      336,
      "In 2024 SpaceX said its rocket was ready weeks before its licence; the regulator said SpaceX was still changing the flight. This is the 2024 shape: the regulator raised its yearly launch cap in 2025. Every number here is the model's, not SpaceX's.",
      340,
    ),
    note(
      'spx-note-lesson',
      416,
      336,
      'Each part has a responsible engineer, and changes are built and tested fast; those that affect the licence wait for the regulator. Drag incoming work to 3x: the licence review is full, 6 percent of changes are dropped and the slowest take 1.4 weeks instead of 3.5 days, while engineering and testing are under 20 percent busy.',
      340,
    ),
    note(
      'spx-note-fix',
      792,
      336,
      'You cannot add people at the regulator: double engineering at 3x and 6 percent is still dropped. What the company controls is how many changes need a new review. In this model, when 1 in 5 changes needs one instead of 2 in 5, nothing is dropped at 3x and the slowest take 3.3 days.',
      320,
    ),
  ],
};

export const spacex: CompanyPreset = {
  id: 'spacex',
  name: 'SpaceX',
  tagline: 'Fast teams wait on an outside gate',
  description:
    'A simplified model from public sources, in its 2024 shape: flight changes are built and tested inside the company, and those that affect the licence wait for the regulator before they fly. Turn up incoming work and watch the licence review fill while engineering and testing still have room.',
  sources: [
    {
      title: 'SpacePolicyOnline, 2024',
      url: 'https://spacepolicyonline.com/news/spacex-complains-of-starship-licensing-delay-as-house-committee-questions-faa-regs/',
    },
    {
      title: 'Reuters special report, 2023',
      url: 'https://www.insurancejournal.com/news/national/2023/11/13/747927.htm',
    },
    {
      title: 'Satnews on the launch cap, 2025',
      url: 'https://satnews.com/2025/05/06/spacex-finally-receives-faa-approval-for-up-to-25-starship-launches-annually/',
    },
  ],
  constraint: 'licence',
  topology,
};

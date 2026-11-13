import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * SpaceX, in its 2024 shape: fast teams wait on an outside licence.
 *
 * Only the Starship development line is drawn. The sources mix three
 * programmes (Starship, Falcon 9 reuse, NASA crew flights), and only
 * Starship has a source for each step, so this map is narrower than the
 * whole company: 7 boxes, no typical steps.
 *
 * Sourced steps, by source:
 * - Reuters special report, 2023: current and former workers say the
 *   company is split into three teams, engineering, manufacturing and
 *   testing, and that its site near Brownsville, Texas, combines
 *   manufacturing, testing and launching. Each part has a responsible
 *   engineer who owns it, inside engineering.
 * - National Geographic, 2023: SpaceX says a rapid iterative development
 *   approach is the basis of its advances; the magazine sums it up as
 *   build, test, break, repeat. So each change ends in a flight test.
 * - SpacePolicyOnline, 2024: SpaceX said its rocket was ready weeks before
 *   the regulator's licence; the regulator said SpaceX was still changing
 *   the flight. Both sides fit one unit of work: a flight change, built
 *   and tested inside the company and reviewed by the regulator when it
 *   affects the licence.
 * - Satnews, 2025: the regulator raised the yearly launch cap. No 2025 or
 *   2026 source names today's limit, so this is the 2024 shape, not
 *   today's. The cap is not drawn: no source says it bound in 2024.
 *
 * Not drawn: the 2021 material (requirements, production and engine
 * problems) may be stale, and NASA crew reviews and booster reuse belong
 * to other programmes. The order is assembled from the sources above;
 * none gives it end to end.
 *
 * The licence is a decision maker (`db`): one approver every change that
 * needs it waits on, and the company cannot hire into it. "Affects
 * licence?" is a dispatcher (`lb`) that sends 2 in 5 changes to the
 * review and the rest straight to the flight test. No source names a
 * sorting step or the share; the engine needs a dispatcher to send only
 * some work down one path, because a team calls every step it points at.
 *
 *   changes       50/wk flight changes
 *   engineering   6 people x 25 at once, 2h each  -> 3000/wk own work
 *   manufacturing 4 people x 25 at once, 2h each  -> 2000/wk own work
 *   testing       4 people x 25 at once, 2h each  -> 2000/wk own work
 *                 (each holds its slot until the steps after it finish,
 *                 including the wait for the licence, which is why the
 *                 teams get so many)
 *   licence       10 at once, 1 day each          ->   50/wk <- constraint
 *                 load: 20/wk at 1x, 40 at 2x, 60 at 3x
 *   flight        20 at once, 1h each             ->  800/wk
 *   Measured (seeds 1, 2, 3): nothing dropped up to 2x, slowest 1 in 100
 *   at 3.1 to 3.2 days at 1x. At 3x the licence is full, 5.5 to 8.9%
 *   dropped (6.6% on seed 1), the slowest at 6.9 to 7.1 days, and the
 *   three teams 5 to 7% busy on average (seed 1). Doubling engineering,
 *   or all three teams, at 3x: the same 5.5 to 8.9% dropped. Sending 1 in
 *   5 changes to the review instead of 2 in 5: nothing dropped at 3x or
 *   4x, slowest 2.9 to 3.1 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('changes', 'client', 'Flight changes', COL(0), LROW(0, 0), {
      rps: 50,
      timeoutMs: 3000,
    }),
    node('engineering', 'service', 'Engineering', COL(1), LROW(0, 0), {
      instances: 6,
      capacity: 25,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('manufacturing', 'service', 'Manufacturing', COL(2), LROW(0, 0), {
      instances: 4,
      capacity: 25,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('testing', 'service', 'Testing', COL(3), LROW(0, 0), {
      instances: 4,
      capacity: 25,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('sort', 'lb', 'Affects licence?', COL(4), LROW(0, 0), {
      capacity: 256,
    }),
    node('licence', 'db', 'Licence review', COL(3), LROW(1, 1), {
      capacity: 10,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
    node('flight', 'service', 'Flight test', COL(4), LROW(1, 1), {
      capacity: 20,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('changes', 'engineering'),
    edge('engineering', 'manufacturing'),
    edge('manufacturing', 'testing'),
    edge('testing', 'sort'),
    edge('sort', 'licence', 2),
    edge('sort', 'flight', 3),
    edge('licence', 'flight'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Licence review is the regulator, not SpaceX's people. Flight changes are
     its only source, so they count as output. */
  measures: {
    notPeople: ['licence'],
  },
  annotations: [
    sectionOver(
      'spx-sec-build',
      'Building and testing inside the company',
      0,
      1,
      4,
      0,
      0,
      0,
    ),
    sectionOver('spx-sec-licence', 'Licensing and flying', 1, 3, 4, 1, 1, 1),
    note(
      'spx-note-lesson',
      40,
      400,
      'Each part has a responsible engineer, and changes are built and tested fast; those that affect the licence wait for the regulator. Drag incoming work to 3x: the licence review is full, 6.6 percent of changes are dropped and the slowest take 7 days instead of 3.1, while the three teams are under 10 percent busy.',
      360,
    ),
    note(
      'spx-note-fix',
      432,
      400,
      'You cannot add people at the regulator: double engineering at 3x and 6.6 percent is still dropped. What the company controls is how many changes need a new review. In this model, when 1 in 5 changes needs one instead of 2 in 5, nothing is dropped at 3x and the slowest take 2.9 days.',
      320,
    ),
    note(
      'spx-note-source',
      784,
      400,
      "In 2024 SpaceX said its rocket was ready weeks before its licence; the regulator said SpaceX was still changing the flight. The three teams follow a 2023 Reuters report. This is the 2024 shape of the Starship work: the regulator raised its yearly launch cap in 2025. Every number here is the model's, not SpaceX's.",
      360,
    ),
  ],
};

export const spacex: CompanyPreset = {
  id: 'spacex',
  name: 'SpaceX',
  tagline: 'Fast teams wait on an outside gate',
  description:
    'A simplified model of the Starship work from public sources, in its 2024 shape: flight changes are engineered, made and tested inside the company, and those that affect the licence wait for the regulator before they fly. Turn up incoming work and watch the licence review fill while the three teams still have room.',
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
    {
      title: 'National Geographic, 2023',
      url: 'https://www.nationalgeographic.com/science/article/spacex-starship-rocket-reaches-key-milestone-then-explodes',
    },
  ],
  constraint: 'licence',
  typical: [],
  topology,
};

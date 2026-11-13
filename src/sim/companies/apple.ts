import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Apple: functions meet only at the top, so the top settles the stalemates.
 *
 * Shape, from one source, a 2020 Harvard Business Review article by two of
 * Apple's own educators [HBR]: the company is organised by function (its
 * exhibit lists design, hardware engineering, software and more), a product
 * needs many specialist teams across functions, leaders of the functions
 * debate the cross-function questions, and "when debates reach an impasse",
 * higher managers up to the chief executive weigh in as tiebreakers. Its
 * named limit: "even the executive team can resolve only a limited number
 * of stalemates". Three functions stand for the many. Where each function
 * raises its questions, and what share peers settle, are the model's.
 * The company may have changed since 2020.
 *
 * This is not the founder who approves everything (seed-saas): here only
 * the disputes peers cannot settle go up, a tenth of them, and the top
 * still sets the pace.
 *
 * Peer debate is a first-touch fix (`edgecompute`): it settles a share of
 * the disputes itself and passes the rest up, and it frees its seat as soon
 * as it has done so. The functions are teams (`service`): a function holds
 * the work while its dispute is settled above it. The executive team is a
 * decision maker (`db`, all decisions, 24 minutes of lock wait per other
 * stalemate in progress), so stalemates queue behind each other.
 *
 *   product     40/wk, each item needs all three functions
 *   hardware,   4 people x 6 at once, 2h each               -> 480/wk own work
 *   software,   (most of those slots are work blocked waiting on a tiebreak
 *   design      when the top is full)
 *   peers       16 at once, 1h each                         -> 640/wk
 *               load: 3 disputes per item, 120/wk at 1x; settles 90%
 *   executives  2 at once, 2.2h each                        ->  36/wk on paper;
 *               lock wait brings it to 33/wk measured at 3x
 *               load: 12/wk at 1x, 24 at 2x, 36 at 3x       <- constraint
 *   Measured (seed 1): nothing dropped up to 2x, slowest 1.3d at 1x and
 *   2.1d at 2x. At 3x the executive team is full, 5.6% is dropped, the
 *   slowest take 1.7wk, peers are 67% busy and the functions 23 to 26%.
 *   Doubling every function's people at 3x: 4.1% dropped, slowest 1.5wk
 *   (undisputed work no longer waits behind blocked work, median 1.1d to
 *   4.3h, but disputes still queue at the top). Peers settling 95% instead
 *   of 90% at 3x: nothing dropped, slowest 1.2d.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('product', 'client', 'Product work', COL(0), ROW(1), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('hardware', 'service', 'Hardware', COL(1), ROW(0), {
      instances: 4,
      capacity: 6,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('software', 'service', 'Software', COL(1), ROW(1), {
      instances: 4,
      capacity: 6,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('design', 'service', 'Design', COL(1), ROW(2), {
      instances: 4,
      capacity: 6,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('peers', 'edgecompute', 'Peer debate', COL(2), ROW(1), {
      capacity: 16,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 60,
      edgeShare: 0.9,
      cpuMsCap: 0,
    }),
    node('executives', 'db', 'Executive team', COL(3), ROW(1), {
      capacity: 2,
      serviceMs: 55,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 10,
    }),
  ],
  edges: [
    edge('product', 'hardware'),
    edge('product', 'software'),
    edge('product', 'design'),
    edge('hardware', 'peers'),
    edge('software', 'peers'),
    edge('design', 'peers'),
    edge('peers', 'executives'),
  ],
  annotations: [
    sectionOver('apl-sec-work', 'Doing the work', 0, 1, 1, 0, 2),
    sectionOver('apl-sec-settle', 'Settling disputes', 1, 2, 3, 1, 1),
    note(
      'apl-note-source',
      1056,
      16,
      "A 2020 article by two of its own educators says Apple is organised by function, so the functions meet only at the top, where even the executive team can settle only so many stalemates. The company may have changed since. Every number here is the model's, not Apple's.",
      360,
    ),
    note(
      'apl-note-lesson',
      536,
      336,
      'Each piece of product work needs hardware engineering, software and design. In this model peers settle nine disputes in ten; only the rest go up. Drag incoming work to 3x: the executive team fills, 6 percent of work is dropped and the slowest take 1.7 weeks instead of 1.3 days, while the functions are a quarter busy, holding work that waits on a tiebreak.',
      440,
    ),
    note(
      'apl-note-fix',
      1056,
      208,
      'More people do not fix it: double the people in every function at 3x and 4 percent is still dropped. Fewer escalations do: select peer debate, raise the share resolved at first contact from 90 to 95 percent, and dropped work at 3x falls from 6 percent to nothing.',
      320,
    ),
  ],
};

export const apple: CompanyPreset = {
  id: 'apple',
  name: 'Apple',
  tagline: 'Only disputes go up, yet set the pace',
  description:
    'A simplified model from public sources: product work needs hardware, software and design, peers settle most disputes between them, and the rest go up to the executive team. Turn up incoming work and watch the executive team fill while the functions still have room.',
  sources: [
    {
      title: 'Harvard Business Review, 2020',
      url: 'https://www.apple.com/careers/pdf/HBR_How_Apple_Is_Organized_For_Innovation-4.pdf',
    },
  ],
  constraint: 'executives',
  topology,
};

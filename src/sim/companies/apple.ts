import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Apple: functions meet only at the top, so the top settles the stalemates.
 *
 * Sourced steps, all from one source, a 2020 Harvard Business Review
 * article by two of Apple's own educators [HBR]. The company may have
 * changed since 2020.
 * - Ideas start with an expert inside a function (its worked example is a
 *   camera feature).
 * - The company is organised by function. Its exhibit lists design,
 *   hardware engineering, software, operations, marketing, retail and
 *   more, and a product needs specialist teams across many of them. Four
 *   stand for the many here: hardware engineering, software and design,
 *   and marketing, whose leaders the engineering teams invited to debate
 *   the feature.
 * - Function leaders debate the questions between them as peers.
 * - "When debates reach an impasse", higher managers up to the chief
 *   executive weigh in as tiebreakers. Its named limit: "even the
 *   executive team can resolve only a limited number of stalemates".
 *
 * Not drawn: the article does not say how a product reaches customers, or
 * in what order the functions work; it describes functions converging, not
 * stages. So every function works on every item at once in this model. A
 * typical step for customers would have to come after every function, but
 * the engine calls every step a service points at in parallel, so nothing
 * can be ordered after them; none is added. Where each function raises its
 * questions, and what share peers settle, are the model's. With every edge
 * kept to one column, four functions fill the column (the canvas allows
 * four rows), so the map has 7 nodes, not 9.
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
 *   product     32/wk, each item needs all four functions
 *   hardware,   4 people x 6 at once, 2h each               -> 480/wk own work
 *   software,   (most of those slots are work blocked waiting on a tiebreak
 *   design,     when the top is full)
 *   marketing
 *   peers       16 at once, 1h each                         -> 640/wk
 *               load: 4 disputes per item, 128/wk at 1x; settles 90%
 *   executives  2 at once, 2h each                          ->  40/wk on paper;
 *               lock wait brings it to 34.2/wk measured at 3x
 *               load: 12.8/wk at 1x, 25.6 at 2x, 38.4 at 3x <- constraint
 *   Measured (seed 1): nothing dropped up to 2x, slowest 1.3d at 1x and
 *   2.2d at 2x. At 3x the executive team is full, 3.2% is dropped, the
 *   slowest take 1.4wk, peers are 58% busy and the functions 19 to 20%.
 *   Seeds 2 and 3 break at 3x too, at 5.8% and 7.4%. Doubling every
 *   function's people at 3x: 5.2%, 3.0% and 6.7% dropped on seeds 1 to 3.
 *   Peers settling 95% instead of 90% at 3x: nothing dropped on seeds 1 to
 *   3, slowest 1.2d.
 * ------------------------------------------------------------------ */

const fn = {
  instances: 4,
  capacity: 6,
  serviceMs: 50,
  serviceCv: 0.5,
  queueLimit: 40,
};

const topology: Topology = {
  nodes: [
    node('product', 'client', 'Product ideas', COL(0), ROW(1), {
      rps: 32,
      timeoutMs: 3000,
    }),
    node('hardware', 'service', 'Hardware', COL(1), ROW(0), fn),
    node('software', 'service', 'Software', COL(1), ROW(1), fn),
    node('design', 'service', 'Design', COL(1), ROW(2), fn),
    node('marketing', 'service', 'Marketing', COL(1), ROW(3), fn),
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
      serviceMs: 50,
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
    edge('product', 'marketing'),
    edge('hardware', 'peers'),
    edge('software', 'peers'),
    edge('design', 'peers'),
    edge('marketing', 'peers'),
    edge('peers', 'executives'),
  ],
  /* No measures field: product ideas are Apple's only source, so they count
     as output (or Delivered would read zero), and every step is Apple's own
     people. */
  annotations: [
    sectionOver('apl-sec-work', 'Doing the work, by function', 0, 1, 1, 0, 3),
    sectionOver('apl-sec-settle', 'Settling disputes', 1, 2, 3, 1, 1),
    note(
      'apl-note-lesson',
      40,
      576,
      'Each piece of product work needs hardware engineering, software, design and marketing, and their disputes go to peer debate first. In this model peers settle nine in ten; only the rest go up. Drag incoming work to 3x: the executive team fills, 3 to 7 percent of work is dropped, depending on the run, and the slowest take 1.4 weeks instead of 1.3 days, while the functions are a fifth busy.',
      360,
    ),
    note(
      'apl-note-fix',
      432,
      576,
      'More people do not fix it: double the people in every function at 3x and 3 to 7 percent is still dropped, the same range as before. Settling more between peers does: select peer debate, raise the share resolved at first contact from 90 to 95 percent, and dropped work at 3x falls to nothing.',
      320,
    ),
    note(
      'apl-note-source',
      784,
      576,
      "A 2020 article by two of its own educators says Apple is organised by function: function leaders debate as peers, and when they reach an impasse, higher managers break the tie, yet even the executive team can settle only so many stalemates. The company may have changed since. Every number here is the model's, not Apple's.",
      360,
    ),
  ],
};

export const apple: CompanyPreset = {
  id: 'apple',
  name: 'Apple',
  tagline: 'Only disputes go up, yet set the pace',
  description:
    'A simplified model of how its functions work together, from one public source: product work needs every function, peers settle most disputes between them, and the rest go up to the executive team. Turn up incoming work and watch the executive team fill while the functions still have room.',
  sources: [
    {
      title: 'Harvard Business Review, 2020',
      url: 'https://www.apple.com/careers/pdf/HBR_How_Apple_Is_Organized_For_Innovation-4.pdf',
    },
  ],
  constraint: 'executives',
  typical: [],
  topology,
};

import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Tesla, early 2025: cars and energy storage wait on one part.
 *
 * Sourced steps, by source:
 * - Annual report, 2024: it generally sells its products directly to
 *   customers, through its website and company-owned stores; it relies on
 *   suppliers for battery cells and has developed its own cell; vehicles
 *   and energy storage products both depend on the supply of those cells;
 *   its factories manufacture and assemble vehicles; and it services its
 *   vehicles at company-owned service locations.
 * - Earnings call, January 2025: the chief executive calls battery packs
 *   the current constraint, and battery production the constraint on
 *   output "as opposed to demand"; the finance chief says the storage
 *   products are supply constrained. The chief executive also says cell
 *   output goes to stationary or mobile uses and "can't go both", so they
 *   make that trade-off: the step labelled "Cars or storage".
 *
 * Typical, not sourced: storage assembly (no source in the research says
 * how storage products are assembled) and delivery.
 *
 * Not drawn: in-house design and test engineering, because no order
 * passes through it and no source gives a stream of new designs. No
 * design review or sign-off body is sourced. The 2018 and Cybertruck ramp
 * problems are other years and other lessons.
 *
 * The order is assembled; no source gives it end to end, or which
 * factory builds what. Two dispatchers route work: "Cell supply" sends 2
 * in 3 items to suppliers and 1 in 3 to its own cells, and "Cars or
 * storage" sends 7 in 11 to vehicle assembly and 4 in 11 to storage
 * assembly, matching the two order streams. Both shares are the model's.
 * A dispatcher does not know which order an item came from, so in the
 * model the two streams mix after sales. Service requests from owners are
 * a separate line that never touches batteries.
 *
 * Every step before battery packs is a `service` that holds its slot
 * while packs are built, so those steps get many slots: they are orders
 * blocked on packs, not spare hands, and utilisation leaves them out.
 * Each holds more than its share of the 56 packs running plus 40
 * waiting, so work is only ever dropped at battery packs.
 *
 *   vorders    70/wk vehicle orders
 *   sorders    40/wk energy storage orders
 *   owners     60/wk service requests
 *   sales      4 people x 45 at once, 1h each -> 7200/wk own work
 *   suppliers  120 at once, 1h each           -> 4800/wk
 *   owncells   80 at once, 1h each            -> 3200/wk
 *   battery    56 at once, 1 day each         ->  280/wk own work;
 *              it also holds the slot through assembly and delivery, so
 *              about 204/wk in practice       <- constraint
 *              load: 110/wk at 1x, 165 at 1.5x, 220 at 2x
 *   vehicles   40 at once, 2h each            ->  800/wk
 *   energy     30 at once, 2h each            ->  600/wk
 *   delivery   30 at once, 1h each            -> 1200/wk
 *   service    40 at once, 2h each            ->  800/wk
 *   Measured (seed 1): battery packs 40% busy at 1x and 59% at 1.5x with
 *   nothing dropped, slowest 1 in 100 at 2.8 days. At 2x they finish
 *   203.2/wk, 5.1% of all work is dropped (all of it orders, all at
 *   battery packs), the slowest take 3.5 days, and vehicle assembly and
 *   delivery are 17% busy, storage assembly 12%, service 15%. Seeds 2 and 3
 *   break at 2x too, at battery packs, with 5.4% and 4.2% dropped.
 *   Doubling what both assembly steps take at once at 2x: 5.1% dropped,
 *   unchanged. Doubling battery packs to 112 at once at 2x: nothing
 *   dropped on seeds 1 to 3.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('vorders', 'client', 'Vehicle orders', COL(0), LROW(0, 0), {
      rps: 70,
      timeoutMs: 3000,
    }),
    node('sorders', 'client', 'Storage orders', COL(0), LROW(1, 0), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('sales', 'service', 'Direct sales', COL(1), LROW(0, 0), {
      instances: 4,
      capacity: 45,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('cells', 'lb', 'Cell supply', COL(2), LROW(0, 0)),
    node('suppliers', 'service', 'Cell suppliers', COL(3), LROW(0, 0), {
      capacity: 120,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('owncells', 'service', 'Own cells', COL(3), LROW(1, 0), {
      capacity: 80,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('battery', 'service', 'Battery packs', COL(4), LROW(0, 0), {
      capacity: 56,
      serviceMs: 200,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('owners', 'client', 'Service requests', COL(0), LROW(2, 1), {
      rps: 60,
      timeoutMs: 3000,
    }),
    node('service', 'service', 'Service locations', COL(1), LROW(2, 1), {
      capacity: 40,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('split', 'lb', 'Cars or storage', COL(4), LROW(2, 1)),
    node('vehicles', 'service', 'Vehicle assembly', COL(3), LROW(2, 1), {
      capacity: 40,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('energy', 'service', 'Storage assembly', COL(3), LROW(3, 2), {
      capacity: 30,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('delivery', 'service', 'Delivery', COL(2), LROW(3, 2), {
      capacity: 30,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('vorders', 'sales'),
    edge('sorders', 'sales'),
    edge('sales', 'cells'),
    edge('cells', 'suppliers', 2),
    edge('cells', 'owncells', 1),
    edge('suppliers', 'battery'),
    edge('owncells', 'battery'),
    edge('battery', 'split'),
    edge('split', 'vehicles', 7),
    edge('split', 'energy', 4),
    edge('vehicles', 'delivery'),
    edge('energy', 'delivery'),
    edge('owners', 'service'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Cell suppliers are outside companies. Every source is customers. */
  measures: {
    notPeople: ['suppliers'],
  },
  annotations: [
    sectionOver('tsl-sec-sell', 'Selling directly', 0, 0, 1, 0, 1, 0),
    sectionOver('tsl-sec-battery', 'Making battery packs', 1, 2, 4, 0, 1, 0),
    sectionOver('tsl-sec-service', 'Servicing its cars', 3, 0, 1, 2, 2, 1),
    sectionOver('tsl-sec-build', 'Assembly at its factories', 4, 3, 4, 2, 2, 1),
    sectionOver(
      'tsl-sec-typical',
      'Delivering (typical, not sourced)',
      2,
      2,
      3,
      3,
      3,
      2,
    ),
    note(
      'tsl-note-lesson',
      40,
      704,
      'Vehicle and storage orders are sold directly, then wait on cells and battery packs before either factory line can finish them. Drag incoming work to 2x: battery packs fill, 5 percent of work is dropped, all of it orders, and the slowest take 3.5 days instead of 2.8, while vehicle assembly is 17 percent busy.',
      360,
    ),
    note(
      'tsl-note-fix',
      432,
      704,
      'More assembly does not help: double what both assembly steps take at once at 2x and 5 percent is still dropped. More battery production does: select battery packs, double the packs it builds at once from 56 to 112, and dropped work at 2x falls from 5 percent to nothing.',
      320,
    ),
    note(
      'tsl-note-source',
      784,
      704,
      "In early 2025 Tesla's chief executive called battery packs, not demand, the constraint, and said cells are split between cars and storage. Its annual report names direct sales, cell supply, vehicle assembly and service. Storage assembly and delivery are typical, not from a source. Every number here is the model's, not Tesla's.",
      360,
    ),
  ],
};

export const tesla: CompanyPreset = {
  id: 'tesla',
  name: 'Tesla',
  tagline: 'Two products wait on one part',
  description:
    'A simplified model of the whole company from public sources as it stood in early 2025, with storage assembly and delivery as typical steps where the sources are silent. Turn up incoming work and watch battery packs fill and hold up both cars and energy storage while sales, assembly and service still have room.',
  sources: [
    {
      title: 'Tesla earnings call, January 2025',
      url: 'https://www.fool.com/earnings/call-transcripts/2025/01/29/tesla-tsla-q4-2024-earnings-call-transcript/',
    },
    {
      title: 'Tesla annual report, 2024',
      url: 'https://www.sec.gov/Archives/edgar/data/1318605/000162828025003063/tsla-20241231.htm',
    },
  ],
  constraint: 'battery',
  typical: ['energy', 'delivery'],
  topology,
};

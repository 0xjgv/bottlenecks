import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Nvidia: orders and its own road map wait on outside suppliers.
 *
 * Sourced steps, by source:
 * - Annual report, 2026: a new product and architecture cadence that
 *   seeks to complete new computing solutions each year (the road map);
 *   one programmable architecture its engineers build on; it builds
 *   finished products and keeps inventory "in advance of anticipated
 *   demand" (the step labelled "Building ahead"); wafers from foundries;
 *   CoWoS packaging; memory bought from outside makers; assembly by
 *   contract manufacturers; and a partner network of cloud providers and
 *   system makers that delivers to customers.
 * - Earnings call, August 2026: the finance chief calls the outlook
 *   supply-constrained and points to memory: its pricing, and the
 *   supplier capacity "our road map requires". No management quote names
 *   packaging as the bottleneck, so memory is the scarce step and
 *   packaging has room.
 *
 * Typical, not sourced: sales. The research quotes the partner network,
 * not how Nvidia takes an order.
 *
 * Not drawn: customers building out their data centres after delivery
 * (from the call) happens outside the company. The chief executive's
 * flat structure is a different lesson. Nvidia's internal engineering
 * flow beyond one step is not sourced, so it is one box.
 *
 * The order is assembled; the report names the steps but not their
 * order. Putting "building ahead" in every order's path is this model's
 * choice. In this model a road map item is a new product put into
 * production, and it takes the same path through suppliers as an order;
 * the 80 and 20 split between them is the model's.
 *
 * Every step is a `service` that holds its slot while it waits on the
 * next, so the steps before memory get many slots: those are orders
 * blocked on a supplier, not spare hands, and utilisation leaves them
 * out. Each holds more than memory's 44 running plus 40 waiting, so
 * work is only ever dropped at memory.
 *
 *   orders       80/wk customer orders
 *   roadmap      20/wk road map items
 *   sales        4 people x 50 at once, 1h each -> 8000/wk own work
 *   engineering  4 teams x 45 at once, 1h each  -> 7200/wk own work
 *   building     160 at once, 1h each           -> 6400/wk
 *   wafers       140 at once, 1h each           -> 5600/wk
 *   packaging    120 at once, 1h each           -> 4800/wk
 *   memory       44 at once, 1 day each         ->  220/wk own work;
 *                it also holds the slot through assembly and partners, so
 *                about 185/wk in practice       <- constraint
 *                load: 100/wk at 1x, 150 at 1.5x, 200 at 2x
 *   assembly     30 at once, 1h each            -> 1200/wk
 *   partners     30 at once, 30 min each        -> 2400/wk
 *   Measured (seed 1): memory 43% busy at 1x and 66% at 1.5x with nothing
 *   dropped, slowest 1 in 100 at 2.6 days. At 2x memory finishes 185.3/wk
 *   of 203.3, 8.5% is dropped (all of it at memory), the slowest take 3.6
 *   days, and engineering is 3% busy, wafers and packaging 4%. Seeds 2 and
 *   3 break at 2x too, at memory, with 8.4% and 5.8% dropped. Doubling
 *   engineering to 8 teams at 2x: 8.5% dropped, unchanged. Doubling memory
 *   to 88 at once at 2x: nothing dropped on seeds 1 to 3.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('orders', 'client', 'Customer orders', COL(0), LROW(0, 0), {
      rps: 80,
      timeoutMs: 3000,
    }),
    node('sales', 'service', 'Sales', COL(1), LROW(0, 0), {
      instances: 4,
      capacity: 50,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('roadmap', 'client', 'Annual road map', COL(0), LROW(1, 1), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('engineering', 'service', 'Engineering', COL(1), LROW(1, 1), {
      instances: 4,
      capacity: 45,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('building', 'service', 'Building ahead', COL(2), LROW(1, 1), {
      capacity: 160,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('partners', 'service', 'Partners', COL(4), LROW(1, 1), {
      capacity: 30,
      serviceMs: 12.5,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('wafers', 'service', 'Foundry wafers', COL(1), LROW(2, 2), {
      capacity: 140,
      serviceMs: 25,
      serviceCv: 0.3,
      queueLimit: 40,
    }),
    node('packaging', 'service', 'Packaging', COL(2), LROW(2, 2), {
      capacity: 120,
      serviceMs: 25,
      serviceCv: 0.3,
      queueLimit: 40,
    }),
    node('memory', 'service', 'Memory', COL(3), LROW(2, 2), {
      capacity: 44,
      serviceMs: 200,
      serviceCv: 0.3,
      queueLimit: 40,
    }),
    node('assembly', 'service', 'System assembly', COL(4), LROW(2, 2), {
      capacity: 30,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('orders', 'sales'),
    edge('sales', 'engineering'),
    edge('roadmap', 'engineering'),
    edge('engineering', 'building'),
    edge('building', 'wafers'),
    edge('wafers', 'packaging'),
    edge('packaging', 'memory'),
    edge('memory', 'assembly'),
    edge('assembly', 'partners'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     The road map is Nvidia's own work, not output; orders are. Foundry
     wafers, packaging, memory, assembly and the partner network are outside
     companies. */
  measures: {
    notOutput: ['roadmap'],
    notPeople: ['partners', 'wafers', 'packaging', 'memory', 'assembly'],
  },
  annotations: [
    sectionOver('nvd-sec-sell', 'Selling (typical, not sourced)', 2, 0, 1, 0, 0, 0),
    sectionOver('nvd-sec-plan', 'Planning and engineering at Nvidia', 0, 0, 2, 1, 1, 1),
    sectionOver('nvd-sec-deliver', 'Delivered by partners', 3, 4, 4, 1, 1, 1),
    sectionOver('nvd-sec-supply', 'Built by outside suppliers', 1, 1, 4, 2, 2, 2),
    note(
      'nvd-note-lesson',
      40,
      568,
      "Orders and the road map pass through Nvidia's own engineering, then wait on outside makers for wafers, packaging, memory and assembly. Drag incoming work to 2x: memory fills, 8.5 percent of work is dropped and the slowest take 3.6 days instead of 2.6, while engineering is 3 percent busy.",
      360,
    ),
    note(
      'nvd-note-fix',
      432,
      568,
      'Hiring does not help: double the engineering teams at 2x and 8.5 percent is still dropped. More supplier capacity does: select memory, double the orders it takes at once from 44 to 88, and dropped work at 2x falls from 8.5 percent to nothing.',
      320,
    ),
    note(
      'nvd-note-source',
      784,
      568,
      "Nvidia's finance chief calls the outlook supply-constrained and points to memory. Its annual report names the other steps, from the yearly road map and building ahead of demand to assembly by contract manufacturers and partners. Selling is typical, not from a source. Every number here is the model's, not Nvidia's.",
      360,
    ),
  ],
};

export const nvidia: CompanyPreset = {
  id: 'nvidia',
  name: 'Nvidia',
  tagline: 'The constraint is a supplier',
  description:
    'A simplified model of the whole company from public sources, with selling as a typical step where the sources are silent. Turn up incoming work and watch memory fill while engineering and the other suppliers still have room, because outside capacity sets the pace.',
  sources: [
    {
      title: 'Nvidia earnings call, August 2026',
      url: 'https://s201.q4cdn.com/141608511/files/content_files/TRANSCRIPT_-NVIDIA-Corp-NVDA-US-Q2-2027-Earnings-Call-26-August-2026-5_00-PM-ET.pdf',
    },
    {
      title: 'Nvidia annual report, 2026',
      url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm',
    },
  ],
  constraint: 'memory',
  typical: ['sales'],
  topology,
};

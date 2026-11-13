import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Tesla, early 2025: two products wait on one part.
 *
 * Shape, from the sources, as it stood in early 2025: the chief executive
 * called battery packs the current constraint and battery production the
 * constraint on output, as opposed to demand; the finance chief said the
 * energy storage products were supply constrained [earnings call]. The
 * annual report says vehicles and energy storage products both depend on
 * battery cells, and that its factories manufacture and assemble vehicles
 * [annual report]. No source in the research describes how storage products
 * are assembled; the storage assembly step is the model's, there so both
 * order lines have the same shape. The order of steps and which factory
 * builds what are not sourced, so the chain stops at orders, assembly and
 * battery packs. No design review or sign-off body is sourced, so none is
 * drawn.
 *
 * Both assembly steps point at battery packs. A service holds its slot while
 * it waits, so the assembly slots are mostly orders waiting on packs, not
 * spare hands, and utilisation leaves them out.
 *
 *   cars      30/wk vehicle orders
 *   storage   20/wk energy storage orders
 *   vehicles  48 at once, 2h each        -> 960/wk own work
 *   energy    48 at once, 2h each        -> 960/wk own work
 *   battery   27 at once, 1.5 days each  ->  90/wk <- constraint
 *             load: 50/wk at 1x, 75 at 1.5x, 100 at 2x
 *   Measured (seed 1): battery packs 57% busy at 1x and 84% at 1.5x with
 *   nothing dropped, slowest orders 3.4 days. At 2x they are full, finish
 *   89.8/wk of 101.7, 12.4% is dropped, the slowest take 1.1 weeks, and the
 *   two assembly steps are 6% and 4% busy. Seeds 2 and 3 break at 2x too, at
 *   battery packs. Doubling both assembly steps to 96 at once at 2x: 11.3%
 *   dropped. Doubling battery packs to 54 at once at 2x: nothing dropped,
 *   100.8/wk finished.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('cars', 'client', 'Vehicle orders', COL(0), ROW(0), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('storage', 'client', 'Storage orders', COL(0), ROW(2), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('vehicles', 'service', 'Vehicle assembly', COL(1), ROW(0), {
      capacity: 48,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('energy', 'service', 'Storage assembly', COL(1), ROW(2), {
      capacity: 48,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('battery', 'service', 'Battery packs', COL(2), ROW(1), {
      capacity: 27,
      serviceMs: 300,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('cars', 'vehicles'),
    edge('storage', 'energy'),
    edge('vehicles', 'battery'),
    edge('energy', 'battery'),
  ],
  annotations: [
    sectionOver('tsl-sec-build', 'Building what was ordered', 0, 0, 1, 0, 2),
    note(
      'tsl-note-source',
      816,
      16,
      "In early 2025 Tesla's chief executive called battery packs the constraint on output, and its finance chief said energy storage was supply constrained. Its annual report says vehicles and energy storage both depend on battery cells. Every number here is the model's, not Tesla's.",
      340,
    ),
    note(
      'tsl-note-lesson',
      816,
      248,
      'Vehicle orders and energy storage orders each pass through their own assembly, and both need battery packs to finish. Drag incoming work to 2x: battery packs fill, 12 percent of orders are dropped and the slowest take 1.1 weeks instead of 3.4 days, while both assembly steps stay under 10 percent busy.',
      340,
    ),
    note(
      'tsl-note-fix',
      816,
      504,
      'More assembly does not help: double both assembly steps at 2x and 11 percent is still dropped. More battery production does: select battery packs, double the packs it builds at once from 27 to 54, and dropped work at 2x falls from 12 percent to nothing.',
      340,
    ),
  ],
};

export const tesla: CompanyPreset = {
  id: 'tesla',
  name: 'Tesla',
  tagline: 'Two products wait on one part',
  description:
    'A simplified model from public sources, as it stood in early 2025: vehicle orders and energy storage orders each pass through their own assembly, and both need battery packs to finish. Turn up incoming work and watch battery packs fill while both assembly lines still have room.',
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
  topology,
};

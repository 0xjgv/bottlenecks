import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Nvidia: the constraint sits outside the company.
 *
 * Shape, from the sources: its annual report names each step: its own
 * architecture and engineering, wafers from foundries, advanced packaging,
 * memory bought from outside makers, system assembly by contract
 * manufacturers, and partners who deliver to customers [annual report]. Its
 * finance chief calls the outlook supply-constrained and points to memory:
 * its pricing, and the supplier capacity the road map needs [earnings
 * call]. No management quote names packaging as the bottleneck, so memory is
 * the scarce step. The report names the steps but no source gives their
 * order; the chain below is the research's assembly, not sourced. Nvidia's
 * internal flow beyond one engineering step is not sourced, so it is one
 * box.
 *
 * Every step is a `service` that holds its slot while it waits on the next,
 * so the steps before memory get many slots: those are orders blocked on a
 * supplier, not spare hands, and utilisation leaves them out.
 *
 *   orders       80/wk customer orders
 *   engineering  4 teams x 32 at once, 2h each -> 2560/wk own work
 *   wafers       100 at once, 2h each          -> 2000/wk
 *   packaging    90 at once, 1h each           -> 3600/wk
 *   memory       36 at once, 1 day each        ->  180/wk own work;
 *                it also holds the slot through assembly and partners, so
 *                about 150/wk in practice      <- constraint
 *                load: 80/wk at 1x, 120 at 1.5x, 160 at 2x, 240 at 3x
 *   assembly     20 at once, 1h each           ->  800/wk
 *   partners     20 at once, 30 min each       -> 1600/wk
 *   Measured (seed 1): memory 39% busy at 1x and 64% at 1.5x with nothing
 *   dropped, slowest orders 2.7 days. At 2x 6.8% is dropped. At 3x memory
 *   finishes 151.8/wk of 240.4, 36.8% is dropped, the slowest take 4 days,
 *   and engineering is 9% busy. Seeds 2 and 3 break at 2x too, at memory.
 *   Doubling engineering to 8 teams at 3x: still 36.8% dropped. Doubling
 *   memory to 72 at once at 3x: nothing dropped, 241.8/wk finished.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('orders', 'client', 'Customer orders', COL(0), ROW(0), {
      rps: 80,
      timeoutMs: 3000,
    }),
    node('engineering', 'service', 'Engineering', COL(1), ROW(0), {
      instances: 4,
      capacity: 32,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('wafers', 'service', 'Foundry wafers', COL(2), ROW(0), {
      capacity: 100,
      serviceMs: 50,
      serviceCv: 0.3,
      queueLimit: 40,
    }),
    node('packaging', 'service', 'Packaging', COL(3), ROW(0), {
      capacity: 90,
      serviceMs: 25,
      serviceCv: 0.3,
      queueLimit: 40,
    }),
    node('memory', 'service', 'Memory', COL(4), ROW(0), {
      capacity: 36,
      serviceMs: 200,
      serviceCv: 0.3,
      queueLimit: 40,
    }),
    node('assembly', 'service', 'System assembly', COL(5), ROW(0), {
      capacity: 20,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('partners', 'service', 'Partners', COL(6), ROW(0), {
      capacity: 20,
      serviceMs: 12.5,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('orders', 'engineering'),
    edge('engineering', 'wafers'),
    edge('wafers', 'packaging'),
    edge('packaging', 'memory'),
    edge('memory', 'assembly'),
    edge('assembly', 'partners'),
  ],
  annotations: [
    sectionOver('nvd-sec-plan', 'Planning the work', 0, 0, 1, 0, 0),
    sectionOver('nvd-sec-supply', 'Built by outside suppliers', 1, 2, 5, 0, 0),
    note(
      'nvd-note-source',
      40,
      232,
      "Nvidia's finance chief calls the outlook supply-constrained and points to memory pricing and supplier capacity. Its annual report names each step: architecture and engineering, foundry wafers, advanced packaging, memory, assembly by contract manufacturers, and partners. Every number here is the model's, not Nvidia's.",
      360,
    ),
    note(
      'nvd-note-lesson',
      560,
      232,
      "Every order passes through Nvidia's own engineering, then waits on outside makers for wafers, packaging, memory and assembly. Drag incoming work to 3x: memory fills, 37 percent of orders are dropped and the slowest take 4 days instead of 2.7, while engineering is 9 percent busy.",
      360,
    ),
    note(
      'nvd-note-fix',
      1080,
      232,
      'Hiring does not help: double the engineering teams at 3x and 37 percent is still dropped. More supplier capacity does: select memory, double the orders it takes at once from 36 to 72, and dropped work at 3x falls from 37 percent to nothing.',
      320,
    ),
  ],
};

export const nvidia: CompanyPreset = {
  id: 'nvidia',
  name: 'Nvidia',
  tagline: 'The constraint is a supplier',
  description:
    'A simplified model from public sources: orders pass through its own engineering, then wait on outside makers for wafers, packaging, memory and assembly before partners deliver them. Turn up incoming work and watch memory fill while engineering still has room, because outside capacity sets the pace.',
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
  topology,
};

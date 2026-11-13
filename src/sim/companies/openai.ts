import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * OpenAI: research and product draw on one pool of compute.
 *
 * Shape, from the sources: compute is split between research and applied
 * teams [Business Insider], its executives say compute is scarce and its
 * allocation the most intense internal conversation [interview], and the
 * Safety Advisory Group recommends safeguards that leadership approves or
 * rejects [Preparedness Framework]. The framework covers models, so only
 * research passes the safety steps. No source gives the order end to end;
 * the chain below is assembled from those steps. The board's Safety and
 * Security Committee only oversees those decisions, so no work passes
 * through it and it is not drawn. Who sets the split today is not sourced,
 * so it is not drawn either.
 *
 * Research teams point at both compute and the Safety Advisory Group. The
 * engine calls every step a service points at in parallel and waits for
 * all of them, so in the model the review runs alongside the run, not
 * after it. That keeps product work off the safety steps; the order is not
 * modelled.
 *
 * Compute is a `service`, not a `websocket`. Both hold a slot for the
 * length of a job, but a websocket refuses outright when full and lets the
 * item move on once its handshake is done, so the run would never show in
 * cycle time and nothing would ever wait for compute. Measured as a
 * websocket with the same 27 slots: cycle time flat at every load, 5.5 to
 * 7.5% dropped already at 1.5x. A backlog with a crew pulling from it would
 * add a step no source names. A service queues for a free slot and holds it
 * for the length of the run.
 *
 *   research    20/wk research projects
 *   product     30/wk product work
 *   researchers 4 people x 12 at once, half a day each -> 480/wk own work
 *   applied     4 people x 12 at once, 2h each          -> 960/wk own work
 *               (most of those slots are tasks blocked waiting on compute,
 *               which is why the teams get so many)
 *   compute     27 runs at once, 1.5 days each          ->  90/wk <- constraint
 *               load: 50/wk at 1x, 75 at 1.5x, 100 at 2x
 *   sag         one group, 12 at once, 30 min each      -> 960/wk
 *               (the Safety Advisory Group; the box holds about 19
 *               characters, so its label is shortened)
 *               load: research only, 20/wk at 1x
 *   leadership  6 at once, 30 min each                  -> 480/wk
 *   Measured (seed 1): compute 52% busy at 1x and 82% at 1.5x with nothing
 *   dropped; at 2x it is full, finishes 90/wk, 10.3% is dropped, research
 *   and product cycle times both rise, and the safety steps are under 10%
 *   busy. The Safety Advisory Group sees only research: 40/wk at 2x against
 *   56/wk of product work finished. Doubling compute to 54 at 2x: nothing
 *   dropped. Doubling both teams instead: 11.3% dropped.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('research', 'client', 'Research projects', COL(0), ROW(0), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('product', 'client', 'Product work', COL(0), ROW(2), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('researchers', 'service', 'Research teams', COL(1), ROW(0), {
      instances: 4,
      capacity: 12,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('applied', 'service', 'Applied teams', COL(1), ROW(2), {
      instances: 4,
      capacity: 12,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('compute', 'service', 'Shared compute', COL(2), ROW(1), {
      capacity: 27,
      serviceMs: 300,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('sag', 'service', 'Safety advisers', COL(2), ROW(0), {
      capacity: 12,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('leadership', 'db', 'Leadership sign-off', COL(3), ROW(0), {
      capacity: 6,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
  ],
  edges: [
    edge('research', 'researchers'),
    edge('product', 'applied'),
    edge('researchers', 'compute'),
    edge('applied', 'compute'),
    edge('researchers', 'sag'),
    edge('sag', 'leadership'),
  ],
  annotations: [
    sectionOver('oai-sec-prepare', 'Getting work ready', 0, 1, 1, 0, 2),
    sectionOver('oai-sec-release', 'Deciding what is safe to release', 1, 2, 3, 0, 0),
    note(
      'oai-note-source',
      1056,
      16,
      "OpenAI's own executives say compute is what limits them, and that allocating it is their most intense internal conversation. The safety steps follow its Preparedness Framework. Every number here is the model's, not OpenAI's.",
      360,
    ),
    note(
      'oai-note-lesson',
      760,
      184,
      'Research and product work each pass through their own team, then wait for the same compute; only research also needs the safety sign-off. Drag incoming work to 2x: shared compute fills, 10 percent of work is dropped and the slowest items take 1.1 weeks instead of 3.6 days. Research and product slow down together, while the Safety Advisory Group and leadership stay under 10 percent busy.',
      320,
    ),
    note(
      'oai-note-fix',
      1104,
      192,
      'More people do not help: double the research and applied teams at 2x and 11 percent is still dropped. More compute does: select shared compute, double the tasks it juggles at once from 27 to 54, and dropped work at 2x falls from 10 percent to nothing.',
      300,
    ),
  ],
};

export const openai: CompanyPreset = {
  id: 'openai',
  name: 'OpenAI',
  tagline: 'Research and product share one compute pool',
  description:
    'A simplified model from public sources: research projects and product work pass through their own teams, then share one pool of compute, and research also needs the safety sign-off. Turn up incoming work and watch shared compute fill while the Safety Advisory Group and leadership still have room.',
  sources: [
    {
      title: 'Interview with its president, 2026',
      url: 'https://taekim.substack.com/p/an-interview-with-openai-president',
    },
    {
      title: 'Business Insider, 2025',
      url: 'https://www.aol.com/articles/openai-president-greg-brockman-explains-033816833.html',
    },
    {
      title: 'Preparedness Framework, 2025',
      url: 'https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf',
    },
  ],
  constraint: 'compute',
  topology,
};

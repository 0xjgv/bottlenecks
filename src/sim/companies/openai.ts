import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * OpenAI: research, product and customers draw on one pool of compute.
 *
 * Sourced steps, by source:
 * - Business Insider, 2025: compute is split between research and applied
 *   teams, so research projects pass through a research team and product
 *   work through an applied team, and both draw on the same compute.
 * - Interview with its president, 2026: compute has been scarce for years
 *   and its allocation is the most intense internal conversation. That
 *   makes compute the constraint.
 * - Preparedness Framework, 2025: a capability evaluation goes into a
 *   Capabilities Report, planned safeguards into a Safeguards Report, the
 *   Safety Advisory Group recommends, and leadership approves or rejects.
 *   The framework covers models, so only research passes these steps.
 * - TechCrunch, 2025: a new model went out tier by tier because compute
 *   was short ("We will add tens of thousands of GPUs next week and roll
 *   it out to the Plus tier then"). That is the rollout step, and why it
 *   draws on compute.
 *
 * Typical, not sourced: customers arriving and signing up. Their usage
 * reaching compute is sourced in spirit: the rollout quote above ties what
 * customers get to compute, and Business Insider quotes its product chief:
 * "Every time we get more GPUs, they immediately get used". In this model a
 * customer's sign-up goes through the rollout to compute.
 *
 * Not drawn: the board's Safety and Security Committee only oversees the
 * decisions, so no work passes through it. Who sets the research and
 * applied split today is not sourced. The split within research is
 * sourced for 2025, but it is a decision about compute, not a step work
 * passes through. Product work ends at compute: no source says how it
 * ships.
 *
 * The order is assembled; no source gives it end to end. The research team
 * points at both compute and the capability report. The engine calls every
 * step a service points at in parallel and waits for all of them, so in
 * the model training and evaluation run side by side, not one after the
 * other. Chaining evaluation after compute would send product work and
 * customers through the safety steps. A released model then draws on
 * compute again through the rollout, so each research project uses compute
 * twice in this model.
 *
 * Compute is a `service`, not a `websocket`. Both hold a slot for the
 * length of a job, but a websocket refuses outright when full and lets the
 * item move on once its handshake is done, so the run would never show in
 * cycle time and nothing would ever wait for compute. Measured as a
 * websocket with the same 40 slots: slowest cycle time flat at every load,
 * 3.4 to 6.5% dropped already at 1.5x. A service queues for a free slot and
 * holds it for the length of the run.
 *
 *   research    20/wk research projects
 *   product     30/wk product work
 *   customers   40/wk sign-ups and the usage that follows
 *   researchers 4 people x 20 at once, half a day each -> 800/wk own work
 *   applied     4 people x 16 at once, 2h each          -> 1280/wk own work
 *   evaluation  40 at once, 1h each                     -> 1600/wk
 *   sag         40 at once, 30 min each                 -> 3200/wk
 *               (the Safety Advisory Group; the box holds 17 characters,
 *               so its label is shortened)
 *   leadership  40 at once, 30 min each                 -> 3200/wk
 *   rollout     80 at once, 30 min each                 -> 6400/wk
 *   signup      60 at once, 1h each                     -> 2400/wk
 *               (every step above compute holds its slot while compute
 *               runs, so most of those slots are tasks blocked waiting on
 *               it, which is why they get so many)
 *   compute     40 runs at once, 1 day each             ->  200/wk <- constraint
 *               load: 20 training + 20 rollout + 30 product + 40 customers
 *               = 110/wk at 1x, 165 at 1.5x, 220 at 2x
 *   Measured (seed 1): compute 55% busy at 1x and 71% at 1.5x with nothing
 *   dropped, slowest 1 in 100 at 2.7 days. At 2x it is full, finishes
 *   200/wk, 12.0% is dropped from all three sources and the slowest take
 *   3.7 days, while the capability report is 3% busy and the safety
 *   advisers and leadership 1%. Seeds 2 and 3 break at 2x too, at 10.8% and
 *   10.3%. Doubling compute to 80 at 2x: nothing dropped on seeds 1 to 3.
 *   Doubling both teams instead: 12.0% dropped, unchanged.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('research', 'client', 'Research projects', COL(0), LROW(0, 0), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('product', 'client', 'Product work', COL(0), LROW(1, 1), {
      rps: 30,
      timeoutMs: 3000,
    }),
    node('customers', 'client', 'Customers', COL(0), LROW(2, 2), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('researchers', 'service', 'Research team', COL(1), LROW(0, 0), {
      instances: 4,
      capacity: 20,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('evaluation', 'service', 'Capability report', COL(2), LROW(0, 0), {
      capacity: 40,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('sag', 'service', 'Safety advisers', COL(3), LROW(0, 0), {
      capacity: 40,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('leadership', 'service', 'Leadership', COL(4), LROW(0, 0), {
      capacity: 40,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('applied', 'service', 'Applied team', COL(1), LROW(1, 1), {
      instances: 4,
      capacity: 16,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('compute', 'service', 'Shared compute', COL(2), LROW(1, 1), {
      capacity: 40,
      serviceMs: 200,
      serviceCv: 0.4,
      queueLimit: 40,
    }),
    node('rollout', 'service', 'Rollout by tier', COL(4), LROW(1, 1), {
      capacity: 80,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('signup', 'service', 'Sign-up and sales', COL(1), LROW(2, 2), {
      capacity: 60,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('research', 'researchers'),
    edge('researchers', 'compute'),
    edge('researchers', 'evaluation'),
    edge('evaluation', 'sag'),
    edge('sag', 'leadership'),
    edge('leadership', 'rollout'),
    edge('product', 'applied'),
    edge('applied', 'compute'),
    edge('customers', 'signup'),
    edge('signup', 'rollout'),
    edge('rollout', 'compute'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Research projects and product work are OpenAI's own work, not output;
     customers are. Shared compute is machines, not people. */
  measures: {
    notOutput: ['research', 'product'],
    notPeople: ['compute'],
  },
  annotations: [
    sectionOver(
      'oai-sec-research',
      'Researching and deciding what is safe to release',
      1,
      1,
      4,
      0,
      0,
      0,
    ),
    sectionOver('oai-sec-build', 'Building and serving on one pool', 0, 1, 4, 1, 1, 1),
    sectionOver(
      'oai-sec-customers',
      'Customers and sign-up (typical, not sourced)',
      2,
      0,
      1,
      2,
      2,
      2,
    ),
    note(
      'oai-note-lesson',
      40,
      568,
      'Research, product work and customers all wait for the same compute; only research also passes the safety steps. Drag incoming work to 2x: shared compute fills, 12 percent of work is dropped from all three sources and the slowest items take 3.7 days instead of 2.7. The capability report, safety advisers and leadership stay under 5 percent busy.',
      360,
    ),
    note(
      'oai-note-fix',
      432,
      568,
      'More people do not help: double the research and applied teams at 2x and 12 percent is still dropped. More compute does: select shared compute, double the tasks it juggles at once from 40 to 80, and dropped work at 2x falls from 12 percent to nothing.',
      320,
    ),
    note(
      'oai-note-source',
      784,
      568,
      "OpenAI's own executives say compute is what limits them. The safety steps follow its Preparedness Framework (the safety advisers are its Safety Advisory Group); the rollout by tier follows a 2025 launch. Customers and sign-up are typical, not from a source. Every number here is the model's, not OpenAI's.",
      360,
    ),
  ],
};

export const openai: CompanyPreset = {
  id: 'openai',
  name: 'OpenAI',
  tagline: 'Research, product and customers share compute',
  description:
    'A simplified model of the whole company from public sources, with customers and sign-up as typical steps where the sources are silent. Turn up incoming work and watch shared compute fill and slow research, product and customers together while the safety steps still have room.',
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
    {
      title: 'TechCrunch, 2025',
      url: 'https://techcrunch.com/2025/02/27/openai-ceo-sam-altman-says-the-company-is-out-of-gpus/',
    },
  ],
  constraint: 'compute',
  typical: ['signup'],
  topology,
};

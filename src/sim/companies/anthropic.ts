import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, LROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Anthropic: usage limits are set by what serving compute can serve.
 *
 * Sourced steps, by source:
 * - Transparency hub, 2026: a model is pretrained, then post-trained,
 *   then its capabilities are assessed by the Responsible Scaling Policy
 *   evaluation process, and it is deployed with matching safeguards; when
 *   capability is high, only to a limited set of partners. Deployment is
 *   one step here, covering both: drawing the partner release apart would
 *   need a split with a share no source gives.
 * - Responsible Scaling Policy, 2026: the chief executive and the
 *   Responsible Scaling Officer make the ultimate determination on the
 *   risk assessment. That is the determination step.
 * - Chief executive on compute, 2026: demand grew far faster than planned,
 *   and that is why it has had difficulties with compute.
 * - Anthropic on higher limits, 2026: new compute deals are what let it
 *   raise its usage limits. So customer usage passes a usage limit, then
 *   serving compute, and the limit is the lesson.
 *
 * Typical, not sourced: customers arriving and signing up, or buying
 * through sales. In this model a sign-up and the usage that follows go
 * through the usage limit to serving compute.
 *
 * Not drawn: the Board and the Long-Term Benefit Trust approve only in
 * specific cases, so no work passes through them. The Risk Reports come
 * every few months about the company's models as a whole, not per item,
 * so they are not a step. No source routes model releases through serving
 * compute, or says the policy slows releases, so the release line ends at
 * deployment and stays lightly loaded. Training compute is not drawn: no
 * source says it is the same compute that serves customers.
 *
 * The order of the release line is assembled from the two sources; none
 * gives it end to end. Every step on it is a chain, so each holds its
 * slot until the steps after it are done, which is why the early steps
 * get the most slots.
 *
 * The usage limit is an intake limit (`ratelimiter`): it refuses at the
 * door and never queues, which is what a usage limit does to a customer.
 * It sits below what compute can serve, so as usage grows it refuses on
 * purpose before compute fills.
 *
 *   models        20/wk model versions
 *   customers     32/wk sign-ups and the usage that follows
 *   pretraining   40 at once, half a day each      -> 400/wk own work
 *   posttraining  30 at once, 3h each              -> 400/wk own work
 *   evaluation    20 at once, 2h each              -> 400/wk own work
 *   determination 10 at once, 1h each              -> 400/wk own work
 *   release       10 at once, 1h each              -> 400/wk
 *                 (held per item: 11h, 7h, 4h, 2h, 1h down the chain, so
 *                 the ceilings with waiting are 145, 171, 200, 200 and
 *                 400/wk, against 80/wk at 4x)
 *   signup        40 at once, 1h each, held 9h     -> 178/wk with waiting
 *   limits        72/wk admitted, 20 at once       <- constraint
 *   compute       17 at once, 1 day each           ->  85/wk
 *                 load: 32/wk at 1x, 64 at 2x, capped at 72 from 3x
 *   Measured (seed 1): nothing dropped at 1x to 2x, slowest 1 in 100 at
 *   2.5 days, compute 40% busy at 1x. At 3x the limit turns work away on
 *   purpose: 13.5% dropped, slowest 2.5 days, compute 85% busy, every
 *   release step 15% and sign-up 6%. Seeds 2 and 3 break at 3x too, at
 *   14.4% and 15.0%, slowest at 1x 2.4 days. Limit doubled to 144 alone at
 *   3x: 6.8% dropped (6.7 to 7.5% on seeds 1 to 3), compute full and named,
 *   slowest 5.8 days. Compute doubled to 34 and the limit to 144: nothing
 *   dropped on seeds 1 to 3, slowest 2.5 to 2.6 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('models', 'client', 'Model versions', COL(0), LROW(0, 0), {
      rps: 20,
      timeoutMs: 3000,
    }),
    node('pretraining', 'service', 'Pretraining', COL(1), LROW(0, 0), {
      capacity: 40,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('posttraining', 'service', 'Post-training', COL(2), LROW(0, 0), {
      capacity: 30,
      serviceMs: 75,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('evaluation', 'service', 'Evaluation', COL(3), LROW(0, 0), {
      capacity: 20,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('determination', 'service', 'Determination', COL(4), LROW(0, 0), {
      capacity: 10,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('release', 'service', 'Deployment', COL(4), LROW(1, 1), {
      capacity: 10,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('customers', 'client', 'Customers', COL(0), LROW(1, 1), {
      rps: 32,
      timeoutMs: 3000,
    }),
    node('signup', 'service', 'Sign-up and sales', COL(1), LROW(1, 1), {
      capacity: 40,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('limits', 'ratelimiter', 'Usage limits', COL(2), LROW(1, 1), {
      rateLimitRps: 72,
      burst: 20,
    }),
    node('compute', 'service', 'Serving compute', COL(3), LROW(1, 1), {
      capacity: 17,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('models', 'pretraining'),
    edge('pretraining', 'posttraining'),
    edge('posttraining', 'evaluation'),
    edge('evaluation', 'determination'),
    edge('determination', 'release'),
    edge('customers', 'signup'),
    edge('signup', 'limits'),
    edge('limits', 'compute'),
  ],
  /* What the measures count: model documentation, the engine never reads it.
     Model versions are Anthropic's own work, not output; customers are.
     Serving compute is machines, not people. */
  measures: {
    notOutput: ['models'],
    notPeople: ['compute'],
  },
  annotations: [
    sectionOver(
      'ant-sec-model',
      'Training and assessing a new model',
      1,
      1,
      4,
      0,
      0,
      0,
    ),
    sectionOver(
      'ant-sec-customers',
      'Customers and sign-up (typical, not sourced)',
      2,
      0,
      1,
      1,
      1,
      1,
    ),
    sectionOver(
      'ant-sec-serve',
      'Deploying models and serving customers',
      0,
      2,
      4,
      1,
      1,
      1,
    ),
    note(
      'ant-note-lesson',
      40,
      400,
      'The usage limit is set by what compute can serve: it turns some work away at the door so what gets in stays fast. Drag incoming work to 3x: the limit turns away 13.5 percent of all work, compute is about 85 percent busy and the slowest items still take 2.5 days, as at 1x. The release steps stay under 20 percent busy.',
      360,
    ),
    note(
      'ant-note-fix',
      432,
      400,
      'Raising the limit alone moves the pile onto compute: at 3x, double it to 144 a week and 6.8 percent is still dropped, now by compute, and the slowest items take nearly 6 days. Double compute from 17 to 34 tasks at once, then raise the limit: nothing is dropped and the slowest take 2.6 days.',
      320,
    ),
    note(
      'ant-note-source',
      784,
      400,
      "Anthropic says compute deals let it raise usage limits. Training, evaluation and deployment follow its transparency hub; the chief executive and the Responsible Scaling Officer make the determination. Customers and sign-up are typical, not from a source. Every number here is the model's, not Anthropic's.",
      360,
    ),
  ],
};

export const anthropic: CompanyPreset = {
  id: 'anthropic',
  name: 'Anthropic',
  tagline: 'Usage limits ration what compute can serve',
  description:
    'A simplified model of the whole company from public sources, with customers and sign-up as typical steps where the sources are silent. Turn up incoming work and watch the usage limit turn work away so serving compute stays fast, while the release steps still have room.',
  sources: [
    {
      title: 'Anthropic on higher limits, 2026',
      url: 'https://www.anthropic.com/news/higher-limits-spacex',
    },
    {
      title: 'Chief executive on compute, 2026',
      url: 'https://officechai.com/ai/had-planned-for-10x-growth-but-saw-80x-annualized-growth-this-quarter-anthropic-ceo-dario-amodei/',
    },
    {
      title: 'Responsible Scaling Policy, 2026',
      url: 'https://www-cdn.anthropic.com/files/4zrzovbb/website/0bacdc8440ea96e62a8766d99ebe1d4eea6d5f3a.pdf',
    },
    {
      title: 'Transparency hub, 2026',
      url: 'https://www.anthropic.com/transparency',
    },
  ],
  constraint: 'limits',
  typical: ['signup'],
  topology,
};

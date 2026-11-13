import type { Topology } from '../types';
import type { CompanyPreset } from '../presets.companies';
import { COL, ROW, edge, node, note, sectionOver } from '../presetKit';

/* ------------------------------------------------------------------ *
 * Anthropic: usage limits are set by what serving compute can serve.
 *
 * Shape, from the sources: its chief executive says demand grew far
 * faster than planned and that this is why it has had difficulties with
 * compute [interview], and Anthropic says new compute deals are what let
 * it raise usage limits [higher limits]. So customer usage passes a usage
 * limit, then serving compute. New models pass a capability evaluation,
 * then the determination by the chief executive and the Responsible
 * Scaling Officer [Responsible Scaling Policy]; the order of those two is
 * assembled from the policy, not stated end to end. The Board and the
 * Long-Term Benefit Trust approve only in specific cases, so they are not
 * drawn. No source routes model releases through serving compute or says
 * the policy slows releases, so the two lines do not meet.
 *
 * The usage limit is an intake limit (`ratelimiter`): it refuses at the
 * door and never queues, which is what a usage limit does to a customer.
 * It sits below what compute can serve, so as usage grows it refuses on
 * purpose before compute fills.
 *
 *   usage       32/wk customer usage
 *   limits      72/wk admitted, 20 at once           <- constraint
 *   compute     17 at once, 1 day each               ->  85/wk
 *               load: 32/wk at 1x, 64 at 2x, capped at 72 from 3x
 *   models      10/wk new models
 *   evaluation  12 at once, half a day each          -> 120/wk
 *   determination 4 at once, 1h each                 -> 160/wk
 *   Measured (seeds 1, 2, 3): nothing dropped at 1x and 1.5x, at most
 *   0.1% at 2x; at 3x the limit turns work away on purpose, 16.9 to 19.5%
 *   dropped, the slowest 1 in 100 at 2.3 to 2.5 days as at 1x, compute 75
 *   to 86% busy. Seed 1 at 3x, limit doubled to 144 alone: 5.0% dropped,
 *   compute full and named, slowest 4.5 days. Compute doubled to 34 and
 *   the limit to 144: nothing dropped, slowest 2.4 days.
 * ------------------------------------------------------------------ */

const topology: Topology = {
  nodes: [
    node('usage', 'client', 'Customer usage', COL(0), ROW(0), {
      rps: 32,
      timeoutMs: 3000,
    }),
    node('limits', 'ratelimiter', 'Usage limits', COL(1), ROW(0), {
      rateLimitRps: 72,
      burst: 20,
    }),
    node('compute', 'service', 'Serving compute', COL(2), ROW(0), {
      capacity: 17,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('models', 'client', 'New models', COL(0), ROW(2), {
      rps: 10,
      timeoutMs: 3000,
    }),
    node('evaluation', 'service', 'Evaluation', COL(1), ROW(2), {
      capacity: 12,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('determination', 'db', 'Determination', COL(2), ROW(2), {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 40,
      readFraction: 0,
      lockMs: 0,
    }),
  ],
  edges: [
    edge('usage', 'limits'),
    edge('limits', 'compute'),
    edge('models', 'evaluation'),
    edge('evaluation', 'determination'),
  ],
  annotations: [
    sectionOver('ant-sec-serve', 'Serving customers', 0, 0, 2, 0, 0),
    sectionOver('ant-sec-release', 'Assessing a new model', 1, 0, 2, 2, 2),
    note(
      'ant-note-source',
      808,
      16,
      "Anthropic says new compute deals let it raise its usage limits; its chief executive says demand grew far faster than planned. The release steps follow its Responsible Scaling Policy: a capability evaluation, then a determination by the chief executive and the Responsible Scaling Officer. Every number here is the model's, not Anthropic's.",
      360,
    ),
    note(
      'ant-note-lesson',
      40,
      464,
      'The usage limit is set by what compute can serve: it turns some work away at the door so what gets in stays fast. Drag incoming work to 3x: the limit turns away 17 percent of work, compute is 75 percent busy, and the slowest items take 2.5 days, against 2.3 at 1x.',
      340,
    ),
    note(
      'ant-note-fix',
      432,
      464,
      'Raising the limit alone moves the pile onto compute: at 3x, double it to 144 a week and only 5 percent is turned away, but compute fills and the slowest items take 4.5 days. Double compute from 17 to 34 tasks at once, then raise the limit: nothing is dropped and the slowest take 2.4 days.',
      340,
    ),
  ],
};

export const anthropic: CompanyPreset = {
  id: 'anthropic',
  name: 'Anthropic',
  tagline: 'Usage limits ration what compute can serve',
  description:
    'A simplified model from public sources: customer usage passes a usage limit set by what serving compute can handle, and new models pass their own release steps. Turn up incoming work and watch the limit turn work away so compute stays fast.',
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
  ],
  constraint: 'limits',
  topology,
};

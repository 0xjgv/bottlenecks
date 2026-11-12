import type { Topology } from './types';
import type { Preset } from './presets';
import { COL, ROW, edge, node, note, sectionOver } from './presetKit';

/*
 * Startup-stage org maps. Units (docs/STARTUP_MODEL.md): one sim second is
 * one working week, 25ms is an hour, 200ms a day; `rps` is items a week.
 * A step's ceiling is capacity * instances * (1000 / serviceMs) items a
 * week. A service holds its slot while it waits on the step after it, so
 * upstream steps get more slots than their own work needs: those slots are
 * work in progress, not extra hands, and utilisation leaves them out.
 *
 * Every figure quoted in a note is from `bun tools/measure-examples.ts`
 * (seed 1, 5 week warm-up, 20 weeks counted) or the same runner on a
 * modified copy, never from the arithmetic.
 */

/* ------------------------------------------------------------------ *
 * Seed SaaS: three founders, four engineers, one inbox.
 *
 *   customers   60/wk: 30% sales, 20% onboarding, 50% support
 *   sales       1 founder x 12 deals at once, 2h each       -> 480/wk own work
 *   onboarding  2 people x 8 at once, 4h each                -> 160/wk own work
 *   support     2 people x 6 at once, 1h each                -> 480/wk
 *   playbook    answers 60% of support tickets alone
 *   eng         4 engineers x 2 tasks, 3h each               -> 107/wk
 *               load: 12 onboarding + 12 support misses = 24/wk
 *   founders    one decision maker, 2 at once, 1h each      ->  80/wk on paper;
 *               half the asks are decisions, and a decision waits 1h for
 *               each other decision in progress, so ~60/wk in practice.
 *               load: 18 sales + 12 onboarding = 30/wk      <- the constraint
 *   Measured: founders 54% busy at 1x, pinned at 3x with engineering at 69%.
 *   Doubling engineering at 3x leaves 15% dropped; asks that are 90%
 *   questions instead of 50% bring it to 5%.
 * ------------------------------------------------------------------ */

const seedSaas: Topology = {
  nodes: [
    node('customers', 'client', 'Customers and leads', COL(0), ROW(1), {
      rps: 60,
      timeoutMs: 3000,
    }),
    node('inbox', 'lb', 'Shared inbox', COL(1), ROW(1), { capacity: 256 }),
    node('sales', 'service', 'Founder-led sales', COL(2), ROW(0), {
      capacity: 12,
      serviceMs: 50,
      serviceCv: 0.6,
      queueLimit: 60,
    }),
    node('onboarding', 'service', 'Onboarding', COL(2), ROW(1), {
      instances: 2,
      capacity: 8,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 60,
    }),
    node('support', 'service', 'Support', COL(2), ROW(2), {
      instances: 2,
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 60,
    }),
    node('founders', 'db', "Founders' sign-off", COL(3), ROW(0), {
      capacity: 2,
      serviceMs: 25,
      serviceCv: 0.7,
      queueLimit: 40,
      readFraction: 0.5,
      lockMs: 25,
    }),
    node('eng', 'service', 'Engineering', COL(3), ROW(1), {
      instances: 4,
      capacity: 2,
      serviceMs: 75,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('playbook', 'cache', 'Help docs and macros', COL(3), ROW(2), {
      hitRate: 0.6,
      serviceMs: 1,
    }),
  ],
  edges: [
    edge('customers', 'inbox'),
    edge('inbox', 'sales', 3),
    edge('inbox', 'onboarding', 2),
    edge('inbox', 'support', 5),
    edge('sales', 'founders'),
    edge('onboarding', 'founders'),
    edge('onboarding', 'eng'),
    edge('support', 'playbook'),
    edge('playbook', 'eng'),
  ],
  annotations: [
    sectionOver('seed-sec-team', 'Talking to customers', 0, 2, 2, 0, 2),
    sectionOver('seed-sec-founders', 'Waiting for a yes', 3, 3, 3, 0, 0),
    note(
      'seed-note-lesson',
      1088,
      40,
      "Every deal and every new customer needs a founder's yes, and half of those asks are real decisions that queue behind each other. Drag incoming work to 3x: the founders' sign-off is pinned at 100 percent, 15 percent of work is dropped and the slowest items take 2.7 weeks instead of 1.5 days, while engineering sits at 69 percent.",
      300,
    ),
    note(
      'seed-note-fix',
      1088,
      328,
      'Doubling the engineers changes nothing. Turning decisions into questions the team can answer does: select the sign-off and raise the share of quick questions from half to 90 percent, and at 3x the dropped work falls from 15 to 5 percent.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Series A SaaS: two ways work comes in, one delivery line.
 *
 *   customers  24/wk -> product triage (2.5% turn out to be out of scope)
 *   sales      12/wk -> solutions engineering (only deals go here)
 *   both       -> design review -> engineering -> QA -> release backlog
 *
 *   triage     2 PMs x 20 at once, 30 min each      -> 3200/wk own work
 *   solutions  2 SEs x 6 at once, 4h each           ->  120/wk own work
 *   design     2 designers x 20 at once, 1h each    -> 1600/wk
 *   eng        6 engineers x 8 at once, 4h each     ->  480/wk
 *   qa         2 testers x 2 at once, 2h each       ->   80/wk <- constraint
 *   release    pulls from its own backlog, 8 at once, 30 min -> 640/wk
 *   QA hands off to the release backlog and moves on, so testers never sit
 *   waiting on a release.
 *   Measured: QA 51% at 1x; at 3x QA is pinned, 80/wk come out, 22% is
 *   dropped. A third tester at 3x: 1.6% dropped.
 * ------------------------------------------------------------------ */

const seriesASaas: Topology = {
  nodes: [
    node('customers', 'client', 'Customer requests', COL(0), ROW(0), {
      rps: 24,
      timeoutMs: 3000,
    }),
    node('sales', 'client', 'Sales deals', COL(0), ROW(2), {
      rps: 12,
      timeoutMs: 3000,
    }),
    node('triage', 'service', 'Product triage', COL(1), ROW(0), {
      instances: 2,
      capacity: 20,
      serviceMs: 12.5,
      serviceCv: 0.5,
      errorRate: 0.025,
      queueLimit: 60,
    }),
    node('solutions', 'service', 'Solutions engineering', COL(1), ROW(2), {
      instances: 2,
      capacity: 6,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 30,
    }),
    node('design', 'service', 'Design review', COL(2), ROW(1), {
      instances: 2,
      capacity: 20,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 60,
    }),
    node('eng', 'service', 'Engineering', COL(3), ROW(1), {
      instances: 6,
      capacity: 8,
      serviceMs: 100,
      serviceCv: 0.6,
      queueLimit: 60,
    }),
    node('qa', 'service', 'QA', COL(4), ROW(1), {
      instances: 2,
      capacity: 2,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('releaseq', 'queue', 'Release backlog', COL(5), ROW(1), {
      queueLimit: 500,
    }),
    node('release', 'worker', 'Release', COL(6), ROW(1), {
      capacity: 8,
      serviceMs: 12.5,
      serviceCv: 0.3,
    }),
  ],
  edges: [
    edge('customers', 'triage'),
    edge('sales', 'solutions'),
    edge('triage', 'design'),
    edge('solutions', 'design'),
    edge('design', 'eng'),
    edge('eng', 'qa'),
    edge('qa', 'releaseq'),
    edge('releaseq', 'release'),
  ],
  annotations: [
    sectionOver('sa-sec-scope', 'Scoping', 0, 1, 1, 0, 2),
    sectionOver('sa-sec-build', 'Building and testing', 1, 2, 4, 1, 1),
    sectionOver('sa-sec-ship', 'Shipping', 2, 5, 6, 1, 1),
    note(
      'sa-note-lesson',
      560,
      312,
      'Customers and sales both feed one line, and the narrowest part of it is two testers. Drag incoming work to 3x: QA is pinned at 100 percent, the line still finishes only 80 a week, 22 percent of work is dropped and the slowest items wait 2.6 weeks. Hiring engineers changes none of that; a third tester brings the dropped work down to under 2 percent.',
      340,
    ),
    note(
      'sa-note-routes',
      936,
      312,
      'Select solutions engineering and press Slow down. Deals stop coming through while customer requests keep flowing, because only deals pass through that team.',
      280,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Marketplace ops: new sellers, trust and safety, payouts.
 *
 *   sellers      40/wk applying
 *   onboarding   3 people x 10 at once, 2h each           -> 600/wk own work
 *   rules        auto-approve rules clear 50% of sellers  -> 20/wk to review
 *   payrun       every Friday 40 payouts go out at once
 *   payouts      1 person x 10 at once, 30 min each       -> 800/wk
 *   payoutrules  risk rules clear 80% of payouts          ->  8/wk to review
 *   tns          3 reviewers x 1 at once, 2h each         ->  60/wk <- constraint
 *                load: 20 sellers + 8 payouts = 28/wk
 *   3x: 60 sellers + 8 payouts = 68/wk, past its 60. The payout run is not
 *   scaled with growth: it is the same Friday run.
 *   Measured: tns 45% at 1x, pinned at 3x with 14% dropped. Auto-approving
 *   70% instead of 50% at 3x: nothing dropped.
 * ------------------------------------------------------------------ */

const marketplaceOps: Topology = {
  nodes: [
    node('sellers', 'client', 'New sellers', COL(0), ROW(0), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('onboarding', 'service', 'Supply onboarding', COL(1), ROW(0), {
      instances: 3,
      capacity: 10,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 60,
    }),
    node('rules', 'cache', 'Auto-approve rules', COL(2), ROW(0), {
      hitRate: 0.5,
      serviceMs: 1,
    }),
    node('tns', 'service', 'Trust and safety', COL(3), ROW(1), {
      instances: 3,
      capacity: 1,
      serviceMs: 50,
      serviceCv: 0.6,
      queueLimit: 60,
    }),
    node('payrun', 'cron', 'Friday payout run', COL(0), ROW(2), {
      intervalMs: 1000,
      batchSize: 40,
    }),
    node('payouts', 'service', 'Payouts', COL(1), ROW(2), {
      capacity: 10,
      serviceMs: 12.5,
      serviceCv: 0.4,
      queueLimit: 60,
    }),
    node('payoutrules', 'cache', 'Payout risk rules', COL(2), ROW(2), {
      hitRate: 0.8,
      serviceMs: 1,
    }),
  ],
  edges: [
    edge('sellers', 'onboarding'),
    edge('onboarding', 'rules'),
    edge('rules', 'tns'),
    edge('payrun', 'payouts'),
    edge('payouts', 'payoutrules'),
    edge('payoutrules', 'tns'),
  ],
  annotations: [
    sectionOver('mk-sec-supply', 'Bringing sellers on', 0, 1, 2, 0, 0),
    sectionOver('mk-sec-review', 'Every risky case', 3, 3, 3, 1, 1),
    sectionOver('mk-sec-pay', 'Paying sellers', 1, 1, 2, 2, 2),
    note(
      'mk-note-lesson',
      1088,
      40,
      'Three reviewers check every seller the rules cannot approve and every flagged payout, so new supply waits behind Friday payouts. Drag incoming work to 3x: trust and safety is pinned at 100 percent and 14 percent of new sellers give up. Teach the rules to approve 70 percent instead of 50 and the same 3x drops nothing.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Devtools OSS: issues, docs, contributors, two maintainers.
 *
 *   community    80/wk issues and questions
 *   docs         the docs site answers 60%             -> 32/wk get through
 *   triage       3 contributors x 10 at once, 30 min   -> 2400/wk own work
 *   known        half are duplicates or known answers  -> 16/wk need a fix
 *   contrib      10 contributors x 2 at once, 1.5 days ->   67/wk
 *   review       2 maintainers x 1 at once, 2h each    ->   40/wk <- constraint
 *   1x: review 16/wk; 3x: 48/wk, past its 40, contributors ~60%.
 *   Measured: review 55% at 1x, pinned at 3x with 6.6% dropped. A third
 *   maintainer, or docs answering 75%, drops nothing at 3x.
 * ------------------------------------------------------------------ */

const devtoolsOss: Topology = {
  nodes: [
    node('community', 'client', 'Issues and questions', COL(0), ROW(1), {
      rps: 80,
      timeoutMs: 4000,
    }),
    node('docs', 'cdn', 'Docs site', COL(1), ROW(1), { hitRate: 0.6 }),
    node('triage', 'service', 'Issue triage', COL(2), ROW(1), {
      instances: 3,
      capacity: 10,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 60,
    }),
    node('known', 'cache', 'Known issues', COL(3), ROW(1), {
      hitRate: 0.5,
      serviceMs: 1,
    }),
    node('contrib', 'service', 'Contributors', COL(4), ROW(1), {
      instances: 10,
      capacity: 2,
      serviceMs: 300,
      serviceCv: 0.6,
      queueLimit: 40,
    }),
    node('review', 'service', 'PR review', COL(5), ROW(1), {
      instances: 2,
      capacity: 1,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('community', 'docs'),
    edge('docs', 'triage'),
    edge('triage', 'known'),
    edge('known', 'contrib'),
    edge('contrib', 'review'),
  ],
  annotations: [
    sectionOver('oss-sec-sort', 'Sorting what comes in', 0, 1, 3, 1, 1),
    sectionOver('oss-sec-merge', 'Fixing and merging', 1, 4, 5, 1, 1),
    note(
      'oss-note-lesson',
      1080,
      312,
      'Every fix waits for one of two maintainers. Drag incoming work to 3x: PR review is pinned at 100 percent, finished pull requests pile up in front of it, and the slowest issues take 1.8 weeks instead of 4 days. Add a third maintainer and the same 3x drops nothing.',
      340,
    ),
    note(
      'oss-note-docs',
      304,
      312,
      'The docs site answers 6 in 10 questions before a person sees them. Raise that to 75 percent and at 3x the two maintainers keep up again: better docs buy review time.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * AI agency: briefs, contractors on demand, QA that sends work back.
 *
 *   briefs     15/wk
 *   account    2 account leads x 6 at once, 2h scoping  -> 240/wk
 *   rework     says yes to the account lead at once, then hands the job
 *              to contractors, and again each time QA rejects it, up to 2
 *              more tries before the job is abandoned
 *   contract   up to 12 contractors at once, 1 day each, 2 days to ramp a
 *              new one, an idle one stays 2 weeks. A contractor holds the
 *              job through QA: ~1.2 days -> ~50/wk at the cap
 *   qa         3 reviewers x 1, 2h each, reject 25%     ->  60/wk
 *   1x: 15 briefs become ~20 jobs (1 / 0.75); 3x: ~60 against ~50.
 *   Measured (rework queue's own counters, 20 weeks): 1x 1.7% of briefs
 *   abandoned; 3x contractors at their cap, 30% abandoned. The client
 *   still hears yes within a day, so the growth table shows no drops.
 * ------------------------------------------------------------------ */

const aiAgency: Topology = {
  nodes: [
    node('briefs', 'client', 'Client briefs', COL(0), ROW(0), {
      rps: 15,
      timeoutMs: 3000,
    }),
    node('account', 'service', 'Account leads', COL(1), ROW(0), {
      instances: 2,
      capacity: 6,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 40,
    }),
    node('rework', 'retryqueue', 'Rework loop', COL(2), ROW(0), {
      capacity: 10,
      serviceMs: 1,
      queueLimit: 30,
      timeoutMs: 2000,
      retries: 2,
    }),
    node('contract', 'lambda', 'Contractors', COL(3), ROW(0), {
      serviceMs: 200,
      serviceCv: 0.5,
      coldStartMs: 400,
      keepWarmMs: 2000,
      maxConcurrency: 12,
    }),
    node('qa', 'service', 'QA review', COL(4), ROW(0), {
      instances: 3,
      capacity: 1,
      serviceMs: 50,
      serviceCv: 0.5,
      errorRate: 0.25,
      queueLimit: 40,
    }),
  ],
  edges: [
    edge('briefs', 'account'),
    edge('account', 'rework'),
    edge('rework', 'contract'),
    edge('contract', 'qa'),
  ],
  annotations: [
    sectionOver('ai-sec-deliver', 'Delivering, until QA says yes', 0, 2, 4, 0, 0),
    note(
      'ai-note-lesson',
      40,
      184,
      'QA sends 1 in 4 deliverables back, so 15 briefs a week become 20 jobs for the contractors. Drag incoming work to 3x: all 12 contractor seats are taken, new jobs are turned away and come back through the rework loop, and 30 percent of briefs are abandoned after three tries, against under 2 percent today. The client was told yes on day one.',
      340,
    ),
    note(
      'ai-note-fix',
      424,
      184,
      'Watch the given up count on the rework loop, not the briefs: the account leads look fine the whole time. Cutting the rejection rate gives back contractor time; so does raising the contractor cap.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Fintech compliance: a check on every item, paperwork filed later.
 *
 *   applicants  50/wk
 *   ops         3 people x 10 at once, 30 min each        -> 2400/wk own work
 *   kyc         compliance check on EVERY application:
 *               3 analysts x 1 at once, 1h each          ->  120/wk <- constraint
 *   risk        3 people x 4 at once, 2h each             ->  240/wk
 *   paperwork   files each yes 2 days later, up to 100 held
 *   records     the compliance file, 4 at once, 30 min    ->  320/wk
 *   1x: the check sees 50/wk; 3x: 150/wk, past its 120.
 *   Measured: check 44% at 1x, pinned at 3x with 22% dropped and the risk
 *   team at 52%. Five analysts at 3x: nothing dropped. About 20 approvals
 *   sit unfiled at any moment at 1x (mean 21, max 36 over 20 weeks).
 * ------------------------------------------------------------------ */

const fintechCompliance: Topology = {
  nodes: [
    node('applicants', 'client', 'Account applications', COL(0), ROW(0), {
      rps: 50,
      timeoutMs: 3000,
    }),
    node('ops', 'service', 'Onboarding ops', COL(1), ROW(0), {
      instances: 3,
      capacity: 10,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 60,
    }),
    node('kyc', 'sidecar', 'Compliance check', COL(2), ROW(0), {
      instances: 3,
      capacity: 1,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 60,
      timeoutMs: 2000,
      retries: 1,
      outlierAfter: 50,
      openMs: 1000,
    }),
    node('risk', 'service', 'Risk decision', COL(3), ROW(0), {
      instances: 3,
      capacity: 4,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 60,
    }),
    node('paperwork', 'writebehind', 'Deferred paperwork', COL(4), ROW(0), {
      capacity: 100,
      serviceMs: 1,
      queueLimit: 100,
      flushDelayMs: 400,
    }),
    node('records', 'db', 'Compliance file', COL(5), ROW(0), {
      capacity: 4,
      serviceMs: 12.5,
      serviceCv: 0.5,
      queueLimit: 60,
      readFraction: 0,
      lockMs: 0,
    }),
  ],
  edges: [
    edge('applicants', 'ops'),
    edge('ops', 'kyc'),
    edge('kyc', 'risk'),
    edge('risk', 'paperwork'),
    edge('paperwork', 'records'),
  ],
  annotations: [
    sectionOver('fc-sec-decide', 'Saying yes or no', 0, 1, 3, 0, 0),
    sectionOver('fc-sec-file', 'Filing it', 1, 4, 5, 0, 0),
    note(
      'fc-note-lesson',
      40,
      184,
      'Every application pays the compliance check, an hour with one of three analysts. Drag incoming work to 3x: the check is pinned at 100 percent, 22 percent of applicants give up, and the risk team after it is only half busy. Add two analysts and the same 3x drops nothing.',
      340,
    ),
    note(
      'fc-note-paperwork',
      1080,
      184,
      'Approvals are filed two days after the yes, so about 20 sit unfiled at any moment. Select deferred paperwork and press Take out: those approvals are lost, and the customer was already told yes.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Drum-buffer-rope (The Goal).
 *
 *   roadmap   16/wk feature requests, the requester waits up to 4 weeks
 *   rope      intake limit: 21 a week, up to 8 at once   <- the rope
 *   spec      2 PMs x 4 at once, 2h each            -> 160/wk own work
 *   build     5 engineers x 2 at once, 1 day each   ->  50/wk
 *   review    1 design lead x 2 at once, 3.2h each  ->  25/wk on paper,
 *             ~22.5/wk measured                         <- the drum
 *             with room for 10 waiting in front        <- the buffer
 *   The rope sits just under what the drum really finishes, so the buffer
 *   stays short. Ropes of 20 to 22 were tried: 22 lets cycle time drift to
 *   1.1-1.2 weeks at 2x and 4x, 20 gives up 1 more item a week.
 *   Measured at 3x: with the rope 20.9 done/wk, p50 2.4 days, p99 4.1 days;
 *   rope raised to 1000 or deleted: 22.5 done/wk, p50 8.3 days, p99 2
 *   weeks (scratch script, same runner).
 * ------------------------------------------------------------------ */

const drumBufferRope: Topology = {
  nodes: [
    node('roadmap', 'client', 'Feature requests', COL(0), ROW(0), {
      rps: 16,
      timeoutMs: 4000,
    }),
    node('rope', 'ratelimiter', 'Intake limit', COL(1), ROW(0), {
      rateLimitRps: 21,
      burst: 8,
    }),
    node('spec', 'service', 'Spec writing', COL(2), ROW(0), {
      instances: 2,
      capacity: 4,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 30,
    }),
    node('build', 'service', 'Build', COL(3), ROW(0), {
      instances: 5,
      capacity: 2,
      serviceMs: 200,
      serviceCv: 0.5,
      queueLimit: 30,
    }),
    node('review', 'service', 'Design review', COL(4), ROW(0), {
      capacity: 2,
      serviceMs: 80,
      serviceCv: 0.5,
      queueLimit: 10,
    }),
  ],
  edges: [
    edge('roadmap', 'rope'),
    edge('rope', 'spec'),
    edge('spec', 'build'),
    edge('build', 'review'),
  ],
  annotations: [
    sectionOver('dbr-sec-rope', 'The rope', 0, 1, 1, 0, 0),
    sectionOver('dbr-sec-drum', 'The drum', 1, 4, 4, 0, 0),
    note(
      'dbr-note-lesson',
      40,
      184,
      'Design review is the slowest step, about 22 a week: the drum. The intake limit, the rope, lets in 21 a week, so only a short buffer waits in front of review. Drag incoming work to 3x: 21 a week still come out and the slowest item takes 4 days. Now drag the intake limit up to 1000: every backlog fills, the slowest item takes 2 weeks, and output rises by less than two a week.',
      380,
    ),
    note(
      'dbr-note-why',
      464,
      184,
      'Starting more work than the drum can finish does not finish more. It only makes everything wait longer.',
      260,
    ),
  ],
};

/** Startup-stage org maps: whole companies, each with one bottleneck lesson. */
export const STARTUP_PRESETS: Preset[] = [
  {
    id: 'seed-saas',
    name: 'Seed SaaS',
    tagline: 'Every yes waits on the founders',
    description:
      "Three founders, four engineers, one shared inbox. Sales and onboarding both need a founder's sign-off. Turn up incoming work and watch the sign-off fill while engineering stays calm.",
    topology: seedSaas,
  },
  {
    id: 'series-a-saas',
    name: 'Series A SaaS',
    tagline: 'Two front doors, one QA team',
    description:
      'Customer requests and sales deals flow through design, engineering and QA. Turn up incoming work and watch QA: it fills first, and adding engineers does not help.',
    topology: seriesASaas,
  },
  {
    id: 'marketplace-ops',
    name: 'Marketplace ops',
    tagline: 'Trust and safety caps supply growth',
    description:
      'New sellers and Friday payouts both land on three trust and safety reviewers. Turn up incoming work and watch new sellers wait behind payouts.',
    topology: marketplaceOps,
  },
  {
    id: 'devtools-oss',
    name: 'Devtools open source',
    tagline: 'Two maintainers review every pull request',
    description:
      'Docs answer most questions, contributors write the fixes, and two maintainers review every pull request. Turn up incoming work and watch PR review.',
    topology: devtoolsOss,
  },
  {
    id: 'ai-agency',
    name: 'AI agency',
    tagline: 'Rework quietly eats your contractors',
    description:
      'Account leads say yes, contractors deliver, QA sends a quarter back. Turn up incoming work and watch the contractors hit their cap and the rework loop abandon briefs.',
    topology: aiAgency,
  },
  {
    id: 'fintech-compliance',
    name: 'Fintech compliance',
    tagline: 'A check on every single item',
    description:
      'Every application passes a compliance check, and approvals are filed later. Turn up incoming work and watch the check fill while the risk team waits.',
    topology: fintechCompliance,
  },
  {
    id: 'drum-buffer-rope',
    name: 'Drum, buffer, rope',
    tagline: 'Pace intake to the slowest step',
    description:
      'An intake limit lets in only what design review can finish. Turn up incoming work, then raise the intake limit, and compare cycle time with output.',
    topology: drumBufferRope,
  },
];

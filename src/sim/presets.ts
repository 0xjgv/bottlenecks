import type { NodeKind, SimNode, Topology } from './types';
import { defaultConfig } from './defaults';
import { STARTUP_PRESETS } from './presets.startups';
import { COL, LROW, ROW, control, edge, node, note, sectionOver } from './presetKit';

export { defaultConfig };

export interface Preset {
  id: string;
  name: string;
  /**
   * One short line for the palette row, under the name.
   *
   * Separate from `description` because the two are read in different
   * places at different moments: this is the six-word promise a student
   * scans down a list of twenty-three, while `description` is the full
   * paragraph they get once the preset is loaded and they want to know
   * what to watch. Deriving one from the other was tried and does not
   * work — the company presets all open with the same sourcing boilerplate,
   * so their first sentences are indistinguishable from each other.
   *
   * Required, so a new preset cannot silently ship without one. The map
   * this replaced was keyed by id and hand-maintained, and by the time it
   * was found seven of twenty-three presets had no note at all.
   */
  tagline: string;
  description: string;
  topology: Topology;
}

const DEFAULT_LABEL: Record<NodeKind, string> = {
  client: 'Client',
  lb: 'Load Balancer',
  service: 'Service',
  cache: 'Cache',
  db: 'Database',
  queue: 'Queue',
  worker: 'Worker',
  replica: 'Read Replicas',
  shard: 'Sharded Store',
  cdn: 'CDN',
  ratelimiter: 'Rate Limiter',
  breaker: 'Circuit Breaker',
  autoscaler: 'Autoscaler',
  region: 'Region',
  objectstore: 'Object Storage',
  searchindex: 'Search Index',
  timeseriesdb: 'Time-Series DB',
  graphdb: 'Graph Database',
  coldstorage: 'Cold Storage',
  vectordb: 'Vector Database',
  streambroker: 'Stream Broker',
  pubsub: 'Pub/Sub Topic',
  websocket: 'WebSocket Gateway',
  apigateway: 'API Gateway',
  sidecar: 'Sidecar Proxy',
  lambda: 'Lambda',
  cron: 'Cron Job',
  bulkhead: 'Bulkhead',
  retryqueue: 'Retry Queue',
  transcoder: 'Transcoder',
  edgecompute: 'Edge Compute',
  writebehind: 'Write-Behind Cache',
  loadshedder: 'Load Shedder',
};

let nodeCounter = 0;

/**
 * Mint a node for the canvas.
 *
 * `taken` is the set of ids already on the canvas. It has to be consulted:
 * the counter above restarts at zero on every page load, while the ids it
 * minted in earlier sessions come back through localStorage, share links
 * and design files. Without the check the eleventh service added after a
 * reload is `service-1` again, and two nodes then share one id: selecting
 * either selects both, the inspector reads "2 components", edges drawn to
 * one land on both, and a config change applies to both. The paste path
 * already dedupes this way (clipboard.ts freshId); the add path did not.
 */
export function makeNode(
  kind: NodeKind,
  x: number,
  y: number,
  label?: string,
  taken?: ReadonlySet<string>,
): SimNode {
  let id: string;
  do {
    nodeCounter += 1;
    id = `${kind}-${nodeCounter}`;
  } while (taken !== undefined && taken.has(id));
  return {
    id,
    kind,
    label: label ?? DEFAULT_LABEL[kind],
    x,
    y,
    config: defaultConfig(kind),
  };
}

/* ------------------------------------------------------------------ *
 * 1. Founder approves everything (single-server)
 *    Time: 25ms is one working hour, 200ms one day, 1000ms one week.
 *    api (engineers): 4 people x 4 tasks / 200ms = 80 a week of their own
 *             work. Each task is also held while it waits for sign-off,
 *             so the 16 slots are sized to outlast the founder's line.
 *    db (founder):    1 person x 2 at once / 50ms = 40 a week <- bottleneck
 *    default 20 a week (founder half busy), knee near 2x.
 * ------------------------------------------------------------------ */

const singleServer: Topology = {
  nodes: [
    node('client', 'client', 'Feature requests', 40, 200, { rps: 20, timeoutMs: 4000 }),
    node('api', 'service', 'Engineers', 340, 200, {
      capacity: 4,
      instances: 4,
      serviceMs: 200,
      serviceCv: 0.6,
      queueLimit: 48,
    }),
    node('db', 'db', 'Founder sign-off', 660, 200, {
      capacity: 2,
      serviceMs: 50,
      serviceCv: 0.7,
      queueLimit: 24,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'db')],
  annotations: [
    note(
      'ss-note-db',
      40,
      320,
      'Four engineers, one founder who signs off on everything. The founder clears about 40 a week; the engineers could ship twice that. Drag the load past 2x and the wait builds at the founder while engineers sit blocked on finished work. Hiring engineers will not move it.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 2. More engineers, one reviewer (load-balanced)
 *    lb (tech lead): hands out work, effectively free.
 *    3 pods: 3 x (2 people x 3 tasks / 100ms) = 180 a week of their own
 *            work, plus slots for the wait on review.
 *    db (reviewer):  1 person x 2 reviews / 25ms = 80 a week on paper,
 *            less measured because reviews of the same code collide
 *            (lockMs) <- bottleneck anyway.
 *    default 40 a week, review bites near 2x.
 * ------------------------------------------------------------------ */

const loadBalanced: Topology = {
  nodes: [
    node('client', 'client', 'Roadmap tasks', 40, 220, { rps: 40, timeoutMs: 4000 }),
    node('lb', 'lb', 'Tech lead', 260, 220, { capacity: 512, serviceMs: 0.5 }),
    node('api1', 'service', 'Pod 1', 500, 80, {
      capacity: 3,
      instances: 2,
      serviceMs: 100,
      serviceCv: 0.6,
      queueLimit: 24,
    }),
    node('api2', 'service', 'Pod 2', 500, 220, {
      capacity: 3,
      instances: 2,
      serviceMs: 100,
      serviceCv: 0.6,
      queueLimit: 24,
    }),
    node('api3', 'service', 'Pod 3', 500, 360, {
      capacity: 3,
      instances: 2,
      serviceMs: 100,
      serviceCv: 0.6,
      queueLimit: 24,
    }),
    node('db', 'db', 'Code reviewer', 800, 220, {
      capacity: 2,
      serviceMs: 25,
      serviceCv: 0.7,
      queueLimit: 32,
    }),
  ],
  edges: [
    edge('client', 'lb'),
    edge('lb', 'api1'),
    edge('lb', 'api2'),
    edge('lb', 'api3'),
    edge('api1', 'db'),
    edge('api2', 'db'),
    edge('api3', 'db'),
  ],
  annotations: [
    note(
      'lb-note-db',
      40,
      480,
      'Three pods, one reviewer. Hiring a third pod tripled what engineering can build and did nothing for review, which still clears about 80 a week. Drag the load to 3x: the pods sit blocked waiting for review. More engineers only help when engineers were the constraint.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 3. Docs deflect support (cache-aside)
 *    cache (help docs): answers 80 in 100 questions, nobody involved.
 *    db (support lead): 1 person x 3 at once / 50ms = 60 a week, but only
 *             the questions the docs miss reach them.
 *    At 0.8 and 150 a week the lead sees ~30: half busy. Drop the docs'
 *    hit rate to 0.5 and the lead is offered 75 against 60, with no change
 *    in incoming work at all.
 * ------------------------------------------------------------------ */

const cacheAside: Topology = {
  nodes: [
    node('client', 'client', 'Customer questions', 40, 200, {
      rps: 150,
      timeoutMs: 3000,
    }),
    node('api', 'service', 'Support inbox', 280, 200, {
      capacity: 64,
      serviceMs: 5,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('cache', 'cache', 'Help docs', 550, 200, {
      capacity: 64,
      serviceMs: 2,
      serviceCv: 0.4,
      hitRate: 0.8,
      queueLimit: 512,
    }),
    node('db', 'db', 'Support lead', 820, 200, {
      capacity: 3,
      serviceMs: 50,
      serviceCv: 0.7,
      queueLimit: 32,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'cache'), edge('cache', 'db')],
  annotations: [
    note(
      'ca-note-miss',
      40,
      320,
      'The support lead only sees what the docs do not answer. At 80 in 100 answered, that is about 30 of the 150 questions a week, against the 60 they can handle. Drag the docs hit rate down to 0.5 and the lead is swamped with no change in incoming questions.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 4. Support backlog and the ticket crew (async-workers)
 *    api (front line): logs the ticket and says "got it", ~12 minutes.
 *    queue (backlog): holds up to 400 tickets.
 *    worker (crew):  4 people x 2 tickets, each held for 2h of work plus
 *             the refund approval call -> ~120 a week <- ceiling
 *    db (refund approvals): 4 at once / 15ms, rarely the problem.
 *    default 60 a week drains fine; past the crew's rate the backlog grows
 *    while every customer still gets an instant "got it".
 * ------------------------------------------------------------------ */

const asyncWorkers: Topology = {
  nodes: [
    node('client', 'client', 'Customers', 40, 200, { rps: 60, timeoutMs: 4000 }),
    node('api', 'service', 'Front line', 260, 200, {
      capacity: 16,
      serviceMs: 8,
      serviceCv: 0.5,
      queueLimit: 128,
    }),
    node('queue', 'queue', 'Ticket backlog', 500, 200, {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 400,
    }),
    node('worker', 'worker', 'Ticket crew', 730, 200, {
      capacity: 2,
      instances: 4,
      serviceMs: 50,
      serviceCv: 0.6,
    }),
    node('db', 'db', 'Refund approvals', 860, 380, {
      capacity: 4,
      serviceMs: 15,
      serviceCv: 0.7,
      queueLimit: 64,
    }),
  ],
  edges: [
    edge('client', 'api'),
    edge('api', 'queue'),
    edge('queue', 'worker'),
    edge('worker', 'db'),
  ],
  annotations: [
    note(
      'aw-note-queue',
      40,
      520,
      'The crew closes about 120 tickets a week. Push incoming work past that and customers still get an instant "got it", because the backlog absorbs the difference. Nothing looks wrong until the backlog fills, so watch how deep it is, not how many tickets fail.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 5. Customers chasing slow support (retry-storm)
 *    db (support engineer): 2 at once / 50ms = 40 a week.
 *    api (account managers) chase after 300ms (a day and a half) and
 *    resend up to twice, so once the engineer's line passes a day and a
 *    half every ask arrives three times, onto someone already full.
 *    default 18 a week. Over 120 weeks on seeds 1, 42, 7 and 2024: 25 a
 *    week loses nothing on every seed, 27-30 tips on some, and 33 loses
 *    90-97% on all of them. retryStorm.test.ts pins it.
 * ------------------------------------------------------------------ */

const retryStorm: Topology = {
  nodes: [
    node('client', 'client', 'Customer asks', 40, 200, { rps: 18, timeoutMs: 4000 }),
    node('api', 'service', 'Account managers', 340, 200, {
      capacity: 64,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 256,
      timeoutMs: 300,
      retries: 2,
    }),
    node('db', 'db', 'Support engineer', 680, 200, {
      capacity: 2,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'db')],
  annotations: [
    note(
      'rt-note-storm',
      40,
      320,
      'The support engineer handles about 40 asks a week. Account managers chase after a day and a half without an answer and resend the ask, up to twice. Once the wait passes that, every ask arrives three times, onto someone who was already full. Steady at 25 a week. From about 30 it can tip over, and by 33 it has, with almost nothing answered.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 6. Self-serve setup (cdn-origin)
 *    cdn (self-serve setup): 9 in 10 new accounts finish on their own.
 *    origin (onboarding team): 3 people x 2 calls, each held for 2h of
 *              work plus the solutions engineer's answer -> ~55 a
 *              week. At 300 signups a week it sees ~30.
 *    db (solutions engineer): 2 at once / 25ms = 80 a week.
 *    3x sends ~90 a week to a team sized for the 30 the setup flow lets
 *    through; the same collapse a reader gets at 1x by dragging the
 *    self-serve rate down.
 * ------------------------------------------------------------------ */

const cdnOrigin: Topology = {
  nodes: [
    node('client', 'client', 'New signups', COL(0), ROW(1), {
      rps: 300,
      timeoutMs: 3000,
    }),
    node('cdn', 'cdn', 'Self-serve setup', COL(1), ROW(1), {
      capacity: 256,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.9,
      queueLimit: 2048,
    }),
    node('origin', 'service', 'Onboarding team', COL(2), ROW(1), {
      capacity: 2,
      instances: 2,
      serviceMs: 50,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
    node('db', 'db', 'Solutions engineer', COL(3), ROW(1), {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
  ],
  edges: [edge('client', 'cdn'), edge('cdn', 'origin'), edge('origin', 'db')],
  annotations: [
    note(
      'co-note-miss',
      40,
      320,
      'The onboarding team only meets the accounts self-serve setup cannot finish. They handle about 55 a week, and setup is currently keeping 9 in 10 signups away from them. Drag the self-serve rate down and the team gets a load nobody ever hired for.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 7. WIP limit at sprint intake (rate-limited-api)
 *    limiter (intake limit): admits 28 a week, 28 of burst.
 *    api (engineering): 3 people x 2 tasks, each held for 6h of work plus
 *              review -> ~35 a week.
 *    db (code review): 4 at once / 25ms = 160 a week, never the problem.
 *    The limit sits just under what the team can finish, so at 1x (25 a
 *    week) nothing is refused. What it buys at 3x is not more output, it
 *    is a short cycle time for the work it lets in.
 * ------------------------------------------------------------------ */

const rateLimitedApi: Topology = {
  nodes: [
    node('client', 'client', 'Feature requests', COL(0), ROW(1), {
      rps: 25,
      timeoutMs: 3000,
    }),
    node('limiter', 'ratelimiter', 'Sprint intake limit', COL(1), ROW(1), {
      rateLimitRps: 28,
      burst: 28,
    }),
    node('api', 'service', 'Engineering team', COL(2), ROW(1), {
      capacity: 2,
      instances: 3,
      serviceMs: 150,
      serviceCv: 0.5,
      queueLimit: 48,
    }),
    node('db', 'db', 'Code review', COL(3), ROW(1), {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 64,
    }),
  ],
  edges: [edge('client', 'limiter'), edge('limiter', 'api'), edge('api', 'db')],
  annotations: [
    note(
      'rl-note-trade',
      40,
      320,
      'The intake limit does not add capacity. It says no to some work at the start of the sprint so the rest ships fast: at 3x it ships 28 a week and a typical task takes under a day, where without it the team ships 34 a week and a typical task takes a week and a half. Drag the limit up to see it.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 8. Stop sending to the agency that keeps failing (circuit-breaker)
 *    payments (design agency): 4 at once / 100ms = 40 a week, and it is
 *    the partner that goes bad. The rule trips once half the work in a
 *    4 week window fails, stops sending for 3 weeks, then tries a few.
 *    At 1x (18 a week) the agency is inside its ceiling and the rule never
 *    trips. At 3x it is overloaded, its backlog fills, refusals pass the
 *    threshold and the rule trips: work bounces at once instead of
 *    waiting a week for an answer that will not come.
 * ------------------------------------------------------------------ */

const circuitBreaker: Topology = {
  nodes: [
    node('client', 'client', 'Design requests', COL(0), ROW(1), {
      rps: 18,
      timeoutMs: 3000,
    }),
    node('api', 'service', 'Marketing team', COL(1), ROW(1), {
      capacity: 48,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 128,
      timeoutMs: 1000,
    }),
    node('breaker', 'breaker', 'Stop-the-line rule', COL(2), ROW(1), {
      errorThreshold: 0.5,
      windowMs: 4000,
      openMs: 3000,
      halfOpenProbes: 3,
    }),
    node('payments', 'service', 'Design agency', COL(3), ROW(1), {
      capacity: 4,
      serviceMs: 100,
      serviceCv: 0.6,
      queueLimit: 16,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'breaker'), edge('breaker', 'payments')],
  annotations: [
    note(
      'cb-note-trip',
      40,
      320,
      'Select the design agency and press Crash in the inspector. Once half the work sent in four weeks fails, the rule stops sending there, and new requests bounce at once instead of waiting a week for nothing. After three weeks it sends a few test jobs, and resumes only if they succeed.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 9. Deputies answer for the CTO (read-replicas)
 *    replicas: the CTO (primary) plus 3 deputies, each 2 at once / 50ms
 *              = 40 a week. 85 in 100 asks are questions a deputy can
 *              answer: 3 x 40 = 120 a week of answers. Decisions all go to
 *              the CTO: 40 a week.
 *    At 60 a week: 51 questions against 120, 9 decisions against 40. At 3x
 *    the questions pass 120 while decisions are still inside the CTO's
 *    ceiling, so another deputy fixes one and does nothing for the other.
 *    Deputies are two days behind on context (400ms of lag), which is what
 *    makes stale answers visible.
 * ------------------------------------------------------------------ */

const readReplicas: Topology = {
  nodes: [
    node('client', 'client', 'Engineering asks', COL(0), ROW(1), {
      rps: 60,
      timeoutMs: 3000,
    }),
    node('api', 'service', 'Engineers', COL(1), ROW(1), {
      capacity: 96,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 256,
    }),
    node('replicas', 'replica', 'CTO and deputies', COL(2), ROW(1), {
      capacity: 2,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 48,
      replicaCount: 3,
      replicationLagMs: 400,
      readFraction: 0.85,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'replicas')],
  annotations: [
    note(
      'rr-note-writes',
      40,
      320,
      'Deputies add room for questions and nothing else: about 120 answers a week across three of them, but decisions still go to the one CTO, who makes about 40. Another deputy fixes the first and does nothing for the second, and deputies two days behind give stale answers.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 10. One whale customer (sharded-database)
 *     4 account managers x 2 at once / 100ms = 20 a week EACH, 80 total.
 *     At 48 a week spread evenly each carries ~12 of their 20. The lesson
 *     is in hotKeyFraction: at 0.6 the whale's account manager alone is
 *     offered ~32 against 20, so they drown while the team-wide average
 *     still reads comfortable.
 * ------------------------------------------------------------------ */

const shardedDatabase: Topology = {
  nodes: [
    node('client', 'client', 'Customer asks', COL(0), ROW(1), {
      rps: 48,
      timeoutMs: 3000,
    }),
    node('api', 'service', 'Support desk', COL(1), ROW(1), {
      capacity: 96,
      serviceMs: 5,
      serviceCv: 0.4,
      queueLimit: 256,
    }),
    node('shards', 'shard', 'Account managers', COL(2), ROW(1), {
      serviceMs: 100,
      serviceCv: 0.6,
      queueLimit: 16,
      shardCount: 4,
      shardCapacity: 2,
      hotKeyFraction: 0,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'shards')],
  annotations: [
    note(
      'sd-note-hot',
      40,
      320,
      'Accounts are split across four account managers, about 20 asks a week each. Drag the hot key share to 0.6, one whale customer, and their account manager alone is offered about 32 a week against 20. They drown while the team average still looks comfortable.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 11. Hiring lags demand (autoscaling-service)
 *     api (delivery team): 3 people x 2 projects, each held for 100ms of
 *     work plus a short tooling call -> ~55 a week, against 40 offered.
 *     The hiring plan aims at 70% busy: 40 x 100 / 6000 = 67% at 1x.
 *     Raise the load and capacity does not follow: the plan waits out 4
 *     weeks of cooldown, decides, and each new hire takes 6 more weeks to
 *     ramp up. Work is dropped in that gap. Letting people go is
 *     instant, which is why the way down looks nothing like the way up.
 *     max 6 people -> ~110 a week, so 3x (120) outruns the plan however
 *     patient it is.
 * ------------------------------------------------------------------ */

const autoscalingService: Topology = {
  nodes: [
    node('client', 'client', 'Customer projects', COL(0), ROW(1), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('api', 'service', 'Delivery team', COL(1), ROW(1), {
      // Two projects per person; three people today.
      capacity: 2,
      instances: 3,
      serviceMs: 100,
      serviceCv: 0.5,
      queueLimit: 48,
    }),
    node('db', 'db', 'Project tooling', COL(2), ROW(1), {
      capacity: 24,
      serviceMs: 4,
      serviceCv: 0.6,
      queueLimit: 128,
    }),
    // The plan sits below the team it hires for, joined by a CONTROL edge
    // that carries no work.
    node('scaler', 'autoscaler', 'Hiring plan', COL(1), ROW(2), {
      targetUtil: 0.7,
      // In people: never fewer than 2, never more than 6.
      minCapacity: 2,
      maxCapacity: 6,
      cooldownMs: 4000,
      scaleStepPct: 0.5,
      warmupMs: 6000,
    }),
  ],
  edges: [edge('client', 'api'), edge('api', 'db'), control('scaler', 'api')],
  annotations: [
    note(
      'as-note-lag',
      40,
      456,
      'Raise the load and headcount does not follow. The hiring plan waits four weeks to be sure, opens roles, and each new hire takes six more weeks to ramp up. Work is dropped in that gap, and the gap is the point: hiring lags demand, it never leads it.',
      340,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 12. Backup on-call owner (multi-region)
 *     Two owners, each 3 at once, every escalation held for 50ms (2h) of
 *     work plus the specialist's answer -> ~40 a week. Only ONE owner
 *     is on duty at a time, so the pair buys cover, not capacity: at 3x
 *     the on-duty owner drowns while the backup sits idle.
 *     Crash `us-api` and escalations go to `eu-api` after a one week
 *     handover, during which every escalation fails.
 * ------------------------------------------------------------------ */

const multiRegion: Topology = {
  nodes: [
    node('client', 'client', 'Customer escalations', COL(0), ROW(1), {
      rps: 24,
      timeoutMs: 3000,
    }),
    node('router', 'region', 'Escalation owner', COL(1), ROW(1), {
      regions: 2,
      activeRegion: 0,
      failoverMs: 1000,
    }),
    node('us-api', 'service', 'Primary owner', COL(2), ROW(0), {
      capacity: 3,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 24,
    }),
    node('eu-api', 'service', 'Backup owner', COL(2), ROW(2), {
      capacity: 3,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 24,
    }),
    node('us-db', 'db', "Primary's specialist", COL(3), ROW(0), {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
    node('eu-db', 'db', "Backup's specialist", COL(3), ROW(2), {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
  ],
  // Edge ORDER is the owner index: the first edge out of the router is owner 0.
  edges: [
    edge('client', 'router'),
    edge('router', 'us-api'),
    edge('router', 'eu-api'),
    edge('us-api', 'us-db'),
    edge('eu-api', 'eu-db'),
  ],
  annotations: [
    sectionOver('mr-sec-us', 'On duty, taking escalations', 0, 2, 3, 0, 0),
    sectionOver('mr-sec-eu', 'Backup, idle until needed', 3, 2, 3, 2, 2),
    note(
      'mr-note-fail',
      1064,
      40,
      'Crash the primary owner. For a week every escalation fails while the handover happens, then the backup picks it all up. Only one owner is on duty at a time, so a backup buys cover, not capacity: at 3x the primary drowns while the backup sits idle.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 13. Series A company (full-stack)
 *     Every team in one picture, each sized so the first to run out is the
 *     one a real Series A runs out of first.
 *
 *     300 customer asks a week, and here is where they go:
 *       help center  answers 7 in 10 -> ~90 a week reach the support lead
 *       support lead -> 2 pods, ~45 a week each
 *       pods         2 x (2 people x 4 tickets), each held for 1h plus the
 *                    playbook and account manager -> never the constraint
 *       playbook     answers 6 in 10 -> ~36 a week reach account managers
 *       account mgrs 4 x 2 at once / 50ms -> 160 a week, 40 each
 *       feature asks  every ticket also logs a feature ask in the backlog
 *                    -> product engineers 8 x 2 / 100ms = 160 a week, ~90
 *                    offered: the first team to run out, at about 1.8x.
 *
 *     At 3x the backlog fills (1000 places) and its refusals are the
 *     dropped work, while the account managers run busy but refuse little.
 * ------------------------------------------------------------------ */

const fullStack: Topology = {
  nodes: [
    node('client', 'client', 'Customers', COL(0), ROW(1), {
      rps: 300,
      timeoutMs: 3000,
    }),
    node('cdn', 'cdn', 'Help center', COL(1), ROW(1), {
      capacity: 256,
      serviceMs: 2,
      serviceCv: 0.3,
      hitRate: 0.7,
      queueLimit: 2048,
    }),
    node('lb', 'lb', 'Support lead', COL(2), ROW(1), {
      capacity: 512,
      serviceMs: 0.5,
    }),
    node('api1', 'service', 'Support pod A', COL(3), ROW(0), {
      capacity: 4,
      instances: 2,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('api2', 'service', 'Support pod B', COL(3), ROW(2), {
      capacity: 4,
      instances: 2,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('cache', 'cache', 'Internal playbook', COL(4), ROW(0), {
      capacity: 64,
      serviceMs: 2,
      serviceCv: 0.4,
      hitRate: 0.6,
      queueLimit: 512,
    }),
    node('shards', 'shard', 'Account managers', COL(5), ROW(0), {
      serviceMs: 50,
      serviceCv: 0.6,
      queueLimit: 16,
      shardCount: 4,
      shardCapacity: 2,
      hotKeyFraction: 0,
    }),
    node('queue', 'queue', 'Feature backlog', COL(4), ROW(2), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 1000,
    }),
    node('workers', 'worker', 'Product engineers', COL(5), ROW(2), {
      capacity: 2,
      instances: 8,
      serviceMs: 100,
      serviceCv: 0.6,
    }),
  ],
  edges: [
    edge('client', 'cdn'),
    edge('cdn', 'lb'),
    edge('lb', 'api1'),
    edge('lb', 'api2'),
    // Each pod answers through the playbook AND logs a feature ask. Both
    // edges are taken for every ticket: a team fans out to all its handoffs.
    edge('api1', 'cache'),
    edge('api1', 'queue'),
    edge('api2', 'cache'),
    edge('api2', 'queue'),
    edge('cache', 'shards'),
    edge('queue', 'workers'),
  ],
  annotations: [
    // Only the two ends are framed. The point of this example is the
    // contrast between them, and boxing the middle would bury it.
    sectionOver('fs-sec-sync', 'Answered while the customer waits', 0, 4, 5, 0, 0),
    sectionOver('fs-sec-async', 'Promised for later', 3, 4, 5, 2, 2),
    note(
      'fs-note-cdn',
      1584,
      40,
      'Seven in ten customers find their answer in the help center and never reach a person. Only the rest reach anything below, which is why every team behind it looks so calm at rest.',
      236,
    ),
    // The lesson. The promised-for-later half runs out first, and quietly,
    // until the backlog fills and its refusals become customer-facing.
    note(
      'fs-note-lesson',
      16,
      336,
      'Take the load to 3x and watch the feature backlog. Product engineers fall behind and for weeks the backlog swallows the excess, so customers are still told their ask is logged. Then it fills, and the dropped work comes from there, while the account managers are busy but turn almost nothing away.',
      300,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 14. Where answers live (specialised-stores)
 *     Every question finds the tool built for it.
 *
 *     60 questions a week, split three ways by the ops lead (~20 each):
 *       sales ops    -> internal search (finding past deals is cheap;
 *                       writing them up costs more and shows up late)
 *       product team -> AI assistant + cross-team lookup. The assistant
 *                       answers by similarity; its ceiling is the knee.
 *       design team  -> shared drive: slow per lookup, never saturates.
 *       every team   -> metrics tracker: logging a number is cheap.
 *     A separate 4 a week of quarter-end cleanup is archived through a
 *     backlog: cheap to keep, slow to dig out.
 *
 *     At 3x the two paths fail in character: the AI assistant saturates
 *     LOUDLY (dropped questions) while the archive fails QUIETLY.
 * ------------------------------------------------------------------ */

const specialisedStores: Topology = {
  nodes: [
    node('client', 'client', 'Team questions', COL(0), ROW(1), {
      rps: 60,
      timeoutMs: 3000,
    }),
    node('batch', 'client', 'Quarter-end cleanup', COL(0), LROW(3, 1), {
      rps: 4,
      timeoutMs: 4000,
    }),
    node('lb', 'lb', 'Ops lead', COL(1), ROW(1), {
      capacity: 512,
      serviceMs: 0.5,
    }),
    node('archive-q', 'queue', 'Archive backlog', COL(1), LROW(3, 1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 500,
    }),
    node('search-api', 'service', 'Sales ops', COL(2), ROW(0), {
      capacity: 16,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    node('recs-api', 'service', 'Product team', COL(2), ROW(1), {
      capacity: 64,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    node('media-api', 'service', 'Design team', COL(2), ROW(2), {
      capacity: 32,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    node('archiver', 'worker', 'Archivist', COL(2), LROW(3, 1), {
      capacity: 40,
      serviceMs: 50,
      serviceCv: 0.4,
    }),
    node('search', 'searchindex', 'Internal search', COL(3), ROW(0)),
    node('vectors', 'vectordb', 'AI assistant', COL(3), ROW(1), { capacity: 2 }),
    node('blobs', 'objectstore', 'Shared drive', COL(3), ROW(2)),
    node('glacier', 'coldstorage', 'Archive', COL(3), LROW(3, 1)),
    node('social', 'graphdb', 'Cross-team lookup', COL(4), ROW(0)),
    node('metrics', 'timeseriesdb', 'Metrics tracker', COL(4), ROW(2)),
  ],
  edges: [
    edge('client', 'lb'),
    // Unequal on purpose: equal weights make the dispatcher route to the
    // least loaded team, and it would steer product questions elsewhere
    // once the assistant slows.
    edge('lb', 'search-api', 33),
    edge('lb', 'recs-api', 34),
    edge('lb', 'media-api', 33),
    edge('search-api', 'search'),
    edge('search-api', 'metrics'),
    edge('recs-api', 'vectors'),
    edge('recs-api', 'social'),
    edge('recs-api', 'metrics'),
    edge('media-api', 'blobs'),
    edge('media-api', 'metrics'),
    edge('batch', 'archive-q'),
    edge('archive-q', 'archiver'),
    edge('archiver', 'glacier'),
  ],
  annotations: [
    sectionOver('ss-sec-stores', 'A different tool for each question', 0, 2, 4, 0, 2),
    sectionOver('ss-sec-arch', 'Putting old work away', 2, 0, 3, 3, 3, 1),
    note(
      'ss-note-stores',
      1320,
      40,
      'One shared folder would answer all of this badly. Search, an AI assistant and a map of who knows what each answer a question the others are slow at, and the price is four tools to keep up instead of one.',
      300,
    ),
    note(
      'ss-note-lesson',
      1320,
      296,
      'Take the load to 3x. The AI assistant fills up and questions are dropped at once. The archive path fills too and says nothing: cleanup is still logged as done while the archive turns retrievals away behind the backlog.',
      300,
    ),
    note(
      'ss-note-cold',
      16,
      296,
      'The archive is slow on purpose, days to dig anything out, because almost nothing is ever looked at again. Keeping old work at hand costs more than it is worth.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 15. Launch announcement fans out (event-driven)
 *
 *   shipped features 20 a week -> front desk (80 a week limit, 1 in 200
 *     briefs bounced as incomplete)
 *     routes 3:1 -> product team (16 at once / 25ms = 640 a week) ~15
 *                -> contractors (2h warm, +2 days ramp-up when cold) ~5
 *   the product team posts every feature to two places:
 *     team channel (4 threads): each reader group reads at its own pace
 *       data team -> 4 threads x 1000/75 = ~53 a week; keeps up even at 3x
 *       finance   -> 4 x 1000/25 = 160 a week; never behind
 *     launch announcement: one post becomes one task for each of
 *       marketing (2 / 25ms = 80 a week), legal review (1 / 40ms = 25 a
 *       week, 60% busy at 1x and the first to drop work at 2x) and
 *       analytics (2 / 10ms = 200 a week).
 *   customer check-ins 12 a week -> standing meetings (20 seats, each held
 *     4 days -> ~10 held, half full at 1x; 3x wants ~29 and is refused past
 *     20) -> meeting notes step -> account team.
 *   weekly reporting: every week, 8 reports at once -> contractors ->
 *     finance lead (2 / 25ms = 80 a week).
 * ------------------------------------------------------------------ */

const eventDriven: Topology = {
  nodes: [
    node('client', 'client', 'Shipped features', 40, 140, { rps: 20, timeoutMs: 3000 }),
    node('gw', 'apigateway', 'Front desk', 250, 140, {
      capacity: 64,
      serviceMs: 2,
      rateLimitRps: 80,
      burst: 80,
      authFailRate: 0.005,
    }),
    node('api', 'service', 'Product team', 470, 140, {
      capacity: 16,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 64,
    }),
    node('broker', 'streambroker', 'Team channel', 700, 60, {
      serviceMs: 1,
      partitions: 4,
      queueLimit: 400,
    }),
    node('indexer', 'service', 'Data team', 930, 20, {
      capacity: 4,
      serviceMs: 75,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
    node('billing', 'service', 'Finance', 930, 130, {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('topic', 'pubsub', 'Launch announcement', 700, 230, { serviceMs: 0.5 }),
    node('push', 'service', 'Marketing', 930, 240, {
      capacity: 2,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 16,
    }),
    node('audit', 'service', 'Legal review', 930, 350, {
      capacity: 1,
      serviceMs: 40,
      serviceCv: 0.6,
      queueLimit: 8,
    }),
    node('metrics', 'service', 'Analytics', 930, 460, {
      capacity: 2,
      serviceMs: 10,
      serviceCv: 0.4,
      queueLimit: 16,
    }),
    node('chat', 'client', 'Customer check-ins', 40, 420, { rps: 12, timeoutMs: 3000 }),
    node('ws', 'websocket', 'Standing meetings', 250, 420, {
      capacity: 20,
      serviceMs: 5,
      connectionMs: 800,
    }),
    node('mesh', 'sidecar', 'Meeting notes step', 470, 420, {
      capacity: 32,
      serviceMs: 5,
      timeoutMs: 500,
      retries: 2,
      outlierAfter: 5,
      openMs: 3000,
    }),
    node('chatsvc', 'service', 'Account team', 690, 420, {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.5,
      queueLimit: 32,
    }),
    node('cron', 'cron', 'Weekly reporting', 40, 560, {
      intervalMs: 1000,
      batchSize: 8,
    }),
    node('fn', 'lambda', 'Contractors', 300, 560, {
      serviceMs: 50,
      serviceCv: 0.5,
      coldStartMs: 400,
      keepWarmMs: 2000,
      maxConcurrency: 12,
    }),
    node('db', 'db', 'Finance lead', 560, 560, {
      capacity: 2,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 32,
    }),
  ],
  edges: [
    edge('client', 'gw'),
    // The front desk's routing: 3 parts product team, 1 part contractors.
    edge('gw', 'api', 3),
    edge('gw', 'fn', 1),
    edge('api', 'broker'),
    edge('api', 'topic'),
    // Each channel edge is an independent reader group.
    edge('broker', 'indexer'),
    edge('broker', 'billing'),
    // Each announcement edge is one more task per post.
    edge('topic', 'push'),
    edge('topic', 'audit'),
    edge('topic', 'metrics'),
    edge('chat', 'ws'),
    edge('ws', 'mesh'),
    edge('mesh', 'chatsvc'),
    edge('cron', 'fn'),
    edge('fn', 'db'),
  ],
  // Notes only, no sections: these nodes are hand-placed rather than on the
  // grid, and the gaps between them cannot hold frames plus label plates.
  annotations: [
    note(
      'ed-note-sync',
      16,
      248,
      'Everything on the left is someone waiting for an answer. Everything on the right happens after the feature already shipped.',
      236,
    ),
    note(
      'ed-note-fanout',
      1160,
      16,
      'One shipped feature becomes five pieces of work here, each picked up by its own team. Turn the load up to 3x and watch legal review: it runs out of room and work is dropped, while marketing, finance and analytics keep up and the data team runs busy but stays current. Nobody shipping features sees a thing.',
      300,
    ),
    note(
      'ed-note-cold',
      16,
      680,
      'Contractors start cold. The first job after a quiet spell pays two days of ramp-up, then they stay on for two weeks. Watch the first batch after weekly reporting lands.',
      236,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * 16. Choosing what fails (resilient-delivery)
 *     Every way a company can fail ON PURPOSE instead of by surprise.
 *
 *     Customer path, 40 a week:
 *       triage     admits 120 a week; 3 in 10 asks are low priority.
 *                  Invisible at 1x; at 3x it drops low priority first.
 *       customer success  16 at once / 25ms = 640 a week, never the
 *                  constraint.
 *       reserved time  at most 9 asks outstanding with the integrations
 *                  team, so one slow partner cannot eat every hour.
 *       integrations   3 at once / 50ms = 60 a week <- the constraint;
 *                  67% busy at 1x, overwhelmed at 3x.
 *       deferred paperwork  says yes at once and files a week later: a
 *                  standing pile of ~40 promised but unrecorded.
 *       rework queue -> fulfilment vendor fails 15 in 100 jobs; failed
 *                  ones come back later, and only those that fail three
 *                  times are abandoned.
 *     Content path, 6 a week:
 *       backlog -> content studio, 6 people x 1 / 300ms = 20 a week.
 * ------------------------------------------------------------------ */

const resilientDelivery: Topology = {
  nodes: [
    node('client', 'client', 'Customer asks', COL(0), ROW(1), {
      rps: 40,
      timeoutMs: 3000,
    }),
    node('shedder', 'loadshedder', 'Priority triage', COL(1), ROW(1), {
      rateLimitRps: 120,
      burst: 120,
      lowPriorityShare: 0.3,
      priorityReserve: 0.3,
    }),
    node('api', 'service', 'Customer success', COL(2), ROW(1), {
      capacity: 16,
      serviceMs: 25,
      serviceCv: 0.4,
      queueLimit: 64,
    }),
    node('bulkhead', 'bulkhead', 'Reserved time', COL(3), ROW(0), {
      bulkheadMax: 9,
    }),
    node('recs', 'service', 'Integrations team', COL(4), ROW(0), {
      capacity: 3,
      serviceMs: 50,
      serviceCv: 0.5,
      queueLimit: 16,
    }),
    node('writebuf', 'writebehind', 'Deferred paperwork', COL(3), ROW(1), {
      capacity: 256,
      serviceMs: 1,
      serviceCv: 0.3,
      queueLimit: 512,
      flushDelayMs: 1000,
    }),
    node('db', 'db', 'Ops records', COL(4), ROW(1), {
      capacity: 4,
      serviceMs: 25,
      serviceCv: 0.6,
      queueLimit: 48,
    }),
    node('retryq', 'retryqueue', 'Rework queue', COL(3), ROW(2), {
      capacity: 8,
      serviceMs: 3,
      serviceCv: 0.3,
      queueLimit: 400,
      timeoutMs: 1000,
      retries: 2,
    }),
    node('notify', 'service', 'Fulfilment vendor', COL(4), ROW(2), {
      capacity: 6,
      serviceMs: 25,
      serviceCv: 0.5,
      errorRate: 0.15,
      queueLimit: 32,
    }),
    node('uploader', 'client', 'Content requests', COL(0), LROW(3, 1), {
      rps: 6,
      timeoutMs: 4000,
    }),
    node('encodeq', 'queue', 'Content backlog', COL(1), LROW(3, 1), {
      serviceMs: 1,
      serviceCv: 0.2,
      queueLimit: 200,
    }),
    node('transcoder', 'transcoder', 'Content studio', COL(2), LROW(3, 1), {
      instances: 6,
      capacity: 1,
      serviceMs: 300,
      serviceCv: 0.3,
    }),
  ],
  edges: [
    edge('client', 'shedder'),
    edge('shedder', 'api'),
    // Customer success hands every ask to all three: the integrations team
    // behind its reserved time, the paperwork, and a fulfilment job into
    // the rework queue. Paperwork and rework say yes at once, so the
    // customer's wait rides on the integrations path alone.
    edge('api', 'bulkhead'),
    edge('api', 'writebuf'),
    edge('api', 'retryq'),
    edge('bulkhead', 'recs'),
    edge('writebuf', 'db'),
    edge('retryq', 'notify'),
    edge('uploader', 'encodeq'),
    edge('encodeq', 'transcoder'),
  ],
  annotations: [
    sectionOver('rd-sec-live', 'Failing on purpose, not by surprise', 0, 1, 4, 0, 2),
    sectionOver('rd-sec-batch', 'Work that can wait', 2, 0, 2, 3, 3, 1),
    note(
      'rd-note-shed',
      16,
      16,
      'At 3x triage drops the low priority asks first, to protect the rest. Choosing what to drop beats letting a backlog choose for you.',
      236,
    ),
    note(
      'rd-note-bulkhead',
      1320,
      40,
      "Select the integrations team and press Slow in the inspector. Their reserved time fills within days, and after that new asks for them bounce at once instead of waiting. One slow team stops being everyone else's problem.",
      300,
    ),
    note(
      'rd-note-writebuf',
      1320,
      264,
      'Paperwork says yes at once and gets filed a week later, so about 40 promises are always made but not yet recorded. Crash it and exactly those are gone.',
      300,
    ),
    note(
      'rd-note-batch',
      800,
      496,
      'The content studio finishes about 20 pieces a week against 6 asked for. Turn the load past 3x and the backlog grows every week and never drains on its own. Add people to the studio to fix it.',
      300,
    ),
  ],
};

export const PRESETS: Preset[] = [
  {
    id: 'single-server',
    name: 'Founder approves everything',
    tagline: 'Engineers blocked on one founder',
    description:
      'Four engineers ship features, and every one waits for the founder to sign off. The founder is the smaller of the two, so cycle time climbs there first while engineers sit blocked on finished work.',
    topology: singleServer,
  },
  {
    id: 'load-balanced',
    name: 'More engineers, one reviewer',
    tagline: 'Hiring engineers does not speed up review',
    description:
      'A tech lead spreads work across three pods, and all of it goes through one code reviewer. Adding a pod adds building capacity and none at review.',
    topology: loadBalanced,
  },
  {
    id: 'cache-aside',
    name: 'Docs deflect support',
    tagline: 'What happens when the docs go stale',
    description:
      'Help docs answer most questions before they reach a person. Lower the share the docs answer and the support lead takes the whole load.',
    topology: cacheAside,
  },
  {
    id: 'async-workers',
    name: 'Support backlog and the ticket crew',
    tagline: 'A backlog that grows faster than it drains',
    description:
      'Every ticket gets an instant "got it" and waits in a backlog for the crew. Watch the backlog grow when the crew falls behind, long before any ticket is dropped.',
    topology: asyncWorkers,
  },
  {
    id: 'retry-storm',
    name: 'Customers chasing slow support',
    tagline: 'Follow-ups multiplying the overload',
    description:
      'Account managers chase support after a day and a half and resend the ask. Once support is slower than that, every ask arrives three times and support never catches up.',
    topology: retryStorm,
  },
  {
    id: 'cdn-origin',
    name: 'Self-serve setup',
    tagline: 'How many signups never need a person',
    description:
      'Self-serve setup finishes 9 in 10 new accounts, so only a trickle reaches the onboarding team. Drop the self-serve rate and watch the team drown.',
    topology: cdnOrigin,
  },
  {
    id: 'rate-limited-api',
    name: 'WIP limit at sprint intake',
    tagline: 'Saying no at intake keeps work moving',
    description:
      'An intake limit admits only what the team can finish each week. It ships slightly less under pressure, but what it takes on ships in days instead of weeks.',
    topology: rateLimitedApi,
  },
  {
    id: 'circuit-breaker',
    name: 'Stop sending work to a failing agency',
    tagline: 'A partner that keeps failing gets a break',
    description:
      'A stop-the-line rule watches the design agency and stops sending work once too much comes back failed. Crash the agency and watch the rule trip, then try again.',
    topology: circuitBreaker,
  },
  {
    id: 'read-replicas',
    name: 'Deputies answer for the CTO',
    tagline: 'Deputies scale answers, not decisions',
    description:
      "Deputies answer questions on the CTO's behalf, but every decision still goes to the CTO, and deputies two days behind can give a stale answer.",
    topology: readReplicas,
  },
  {
    id: 'sharded-database',
    name: 'One whale customer',
    tagline: 'One huge account swamping its owner',
    description:
      'Accounts are split evenly across four account managers until one customer gets huge. Then one account manager drowns while the team average still looks healthy.',
    topology: shardedDatabase,
  },
  {
    id: 'autoscaling-service',
    name: 'Hiring lags demand',
    tagline: 'Headcount arriving after it was needed',
    description:
      'A hiring plan adds people when the team runs hot, but each hire takes weeks to ramp up, so work is dropped in the gap between demand and headcount.',
    topology: autoscalingService,
  },
  {
    id: 'multi-region',
    name: 'Backup on-call owner',
    tagline: 'What a handover actually costs you',
    description:
      'Two owners, one on duty. Take the primary out and every escalation fails until the backup has taken over.',
    topology: multiRegion,
  },
  {
    id: 'full-stack',
    name: 'Series A company',
    tagline: 'Every team at once, under real load',
    description:
      'Every team at once: help center, support pods, playbook, account managers, and a feature backlog behind it all. Watch which team runs out first, and which one fails quietly.',
    topology: fullStack,
  },
  {
    id: 'specialised-stores',
    name: 'Where answers live',
    tagline: 'The right tool for each question',
    description:
      'Search, an AI assistant, a cross-team lookup, a shared drive, a metrics tracker and an archive, each built for one kind of question. Watch which fills first, and which fails without a sound.',
    topology: specialisedStores,
  },
  {
    id: 'event-driven',
    name: 'Launch announcement fans out',
    tagline: 'One post becomes work for every team',
    description:
      'Every shipped feature is posted to a team channel and announced to marketing, legal and analytics. Watch one post become five tasks, legal review run out of room, and standing meetings run out of seats.',
    topology: eventDriven,
  },
  {
    id: 'resilient-delivery',
    name: 'Choosing what fails',
    tagline: 'Deciding what gets dropped, on purpose',
    description:
      'Failing on purpose: triage drops low priority asks first, reserved time contains a slow team, failed vendor work comes back for rework, and deferred paperwork trades a quick yes for a pile of unrecorded promises.',
    topology: resilientDelivery,
  },
  ...STARTUP_PRESETS,
];

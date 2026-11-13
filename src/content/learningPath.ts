/* ==========================================================================
   The learning path.

   Every example and every challenge, in an order a reader can follow. The
   Examples gallery is a flat grid and the challenges are grouped by
   difficulty; neither says what to open first, or what a challenge builds
   on. Here each track pairs the examples that show an idea with the
   challenges that make the student use it, so a brief arrives after the
   system it is set in.

   Each id appears exactly once across the path. learningPath.test.ts holds
   that against PRESETS and CHALLENGES, so a new example or brief fails the
   suite until it is given a place here.
   ========================================================================== */

export type StepKind = 'example' | 'challenge';

export interface PathStep {
  readonly kind: StepKind;
  /** A preset id for an example, a challenge id for a challenge. */
  readonly id: string;
  /** What the student will learn, in one line. */
  readonly learn: string;
}

export interface PathTrack {
  readonly id: string;
  readonly title: string;
  /** The idea the track is about, in one line. */
  readonly about: string;
  readonly steps: readonly PathStep[];
}

const ex = (id: string, learn: string): PathStep => ({ kind: 'example', id, learn });
const ch = (id: string, learn: string): PathStep => ({ kind: 'challenge', id, learn });

export const LEARNING_PATH: readonly PathTrack[] = [
  {
    id: 'bottlenecks',
    title: 'Find the constraint',
    about: 'A team ships only as fast as the step that fills up first.',
    steps: [
      ex('single-server', 'Find the one person everything waits on.'),
      ex(
        'load-balanced',
        'See why more engineers do not help when one person reviews.',
      ),
      ch('hold-the-line', 'Find the line work waits in, and make room there.'),
      ch('nothing-looks-busy', 'Spot a team that is full while it looks half idle.'),
      ex('drum-buffer-rope', 'Pace new work to the constraint so nothing piles up.'),
    ],
  },
  {
    id: 'caching',
    title: 'Answers without a person',
    about: 'Docs and self-serve answer most asks before they reach anyone.',
    steps: [
      ex('cache-aside', 'See how support only feels the questions the docs miss.'),
      ex('cdn-origin', 'See how many signups never need a person at all.'),
      ch('keep-it-warm', 'Size support for what the docs miss, not every question.'),
      ch('not-everyones-problem', 'Stop one slow person from slowing every ask.'),
    ],
  },
  {
    id: 'async',
    title: 'Backlogs and handoffs',
    about: 'Say "got it" now, and do the work later.',
    steps: [
      ex('async-workers', 'Watch a backlog grow when the crew falls behind.'),
      ch('buying-time', 'Learn why a backlog only buys time, and what fixes it.'),
      ex('event-driven', 'Watch one announcement become work for every team.'),
      ex('ai-agency', 'See rework quietly eat a team of contractors.'),
    ],
  },
  {
    id: 'saying-no',
    title: 'Saying no under load',
    about: 'Turning some work away early ships more of what matters.',
    steps: [
      ex('retry-storm', 'See follow-ups multiply the overload that caused them.'),
      ch('five-seconds', 'Make support recover once a bad stretch ends.'),
      ex('rate-limited-api', 'See how a limit at intake keeps cycle time short.'),
      ch('say-no-fast', 'Ship more by refusing some work right away.'),
    ],
  },
  {
    id: 'failures',
    title: 'When people are out',
    about: 'People leave, get sick and go on holiday. Plan for the day they do.',
    steps: [
      ex('circuit-breaker', 'Watch a rule stop sending work to a failing partner.'),
      ch('lose-a-machine', 'Spread sign-off so one absence is not a stop.'),
      ex('multi-region', 'Measure what a handover to the backup really costs.'),
      ch('lose-a-region', 'Size the backup owner for the day you need them.'),
      ex('resilient-delivery', 'Choose which work fails, and where failed work goes.'),
      ch('saved-then-lost', 'Find promises that vanish while nothing reads as failed.'),
    ],
  },
  {
    id: 'data',
    title: 'Owners and deputies',
    about: 'What to do when one owner is not enough.',
    steps: [
      ex('read-replicas', 'See how deputies add answers but not decisions.'),
      ch('checkout-rush', 'Fix a crunch of decisions that deputies cannot help.'),
      ex('sharded-database', 'Watch one whale customer swamp their account manager.'),
      ch('one-hot-key', 'Cool the whale account while the average looks calm.'),
      ex('specialised-stores', 'See which tool fills first when each does one job.'),
    ],
  },
  {
    id: 'real-systems',
    title: 'Whole companies',
    about: 'Put it together, then find the constraint in a company like yours.',
    steps: [
      ex('autoscaling-service', 'See why new hires arrive after they were needed.'),
      ex('full-stack', 'Find the first team to run out when everyone is busy.'),
      ch('loud-and-quiet', 'Fix slow answers and a silent backlog at the same time.'),
      ex('seed-saas', 'See every yes in a seed company wait on the founders.'),
      ex('series-a-saas', 'Find the step that caps a Series A delivery line.'),
      ex('marketplace-ops', 'See trust and safety cap how fast supply can grow.'),
      ex('devtools-oss', 'See two maintainers set the pace of every pull request.'),
      ex('fintech-compliance', 'See a check on every item set the pace of everything.'),
    ],
  },
  {
    id: 'companies',
    title: 'Real companies',
    about: 'Where well-known companies say they get stuck, drawn from public sources.',
    steps: [
      ex(
        'openai',
        'See research, product and customers slow together when compute fills.',
      ),
      ex('anthropic', 'See a usage limit turn work away until compute is added.'),
      ex('spacex', 'See fast builders wait on a licence no hire can speed up.'),
      ex('nvidia', 'See hiring change nothing when a supplier sets the pace.'),
      ex('tesla', 'See two products stall on the one part they both need.'),
      ex('stripe', 'See coding agents pile work up at the people who review it.'),
      ex('gitlab', 'See more engineers stall when only maintainers can merge.'),
      ex('spotify', 'See finished work from every team wait at one shared release.'),
      ex('airbnb', 'See too many projects back up the teams everyone depends on.'),
      ex('amazon', 'See meetings for each layer fill up long before the builders do.'),
      ex('apple', 'See a few disputes set the pace when only the top can break ties.'),
    ],
  },
];

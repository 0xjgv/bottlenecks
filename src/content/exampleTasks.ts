import { PRESETS } from '../sim/presets';
import { offeredLoad } from '../learn/pathProgress';
import type {
  Cond,
  ExampleTask,
  Fig,
  NumericField,
  Probe,
  TaskStep,
} from '../learn/exampleTask';

// Thresholds are checked by running every exercise, including recovery,
// with three seeds. These are model experiments, not company measurements.
const HOLD = 1000;
const LOAD: Probe = { of: 'load' };
const FAILING: Probe = { of: 'failing' };
const P99: Probe = { of: 'p99' };
const busy = (node: string): Probe => ({ of: 'busy', node });
const waiting = (node: string): Probe => ({ of: 'waiting', node });
const setting = (node: string, field: NumericField): Probe => ({
  of: 'setting',
  node,
  field,
});
const atLeast = (probe: Probe, value: number): Cond => ({ probe, atLeast: value });
const below = (probe: Probe, value: number): Cond => ({ probe, below: value });
const exactly = (probe: Probe, value: number): Cond => ({
  probe,
  atLeast: value,
  below: value + 0.001,
});
const fig = (probe: Probe, label: string): Fig => ({ probe, label });
const FIELD_LABELS: Partial<Record<NumericField, string>> = {
  capacity: 'Tasks each person juggles at once',
  instances: 'People',
  serviceMs: 'Hands-on time per task',
  hitRate: 'Share answered without a person',
  replicaCount: 'Deputies',
  readFraction: 'Questions, not decisions',
  hotKeyFraction: 'Work from one huge customer',
  maxCapacity: 'Never go above',
  maxConcurrency: 'Most contractors at once',
  edgeShare: 'Resolved at first contact',
  rateLimitRps: 'Takes on at most',
};

function preset(id: string) {
  const p = PRESETS.find((p) => p.id === id);
  if (!p) throw new Error(`Exercise has no example: ${id}`);
  return p;
}

function label(id: string, node: string): string {
  const found = preset(id).topology.nodes.find((n) => n.id === node);
  if (!found) throw new Error(`Exercise names a missing part: ${id}/${node}`);
  return found.label;
}

const loadFor = (id: string, multiple: number) =>
  Math.round(offeredLoad(preset(id).topology) * multiple);
const raise = (rps: number): TaskStep => ({
  text: `Set incoming work to ${rps.toLocaleString('en-US')} tasks a week.`,
  when: [exactly(LOAD, rps)],
  action: { kind: 'load', rps },
  figs: [fig(LOAD, 'arriving each week')],
});

function watch(id: string, node: string, load: number): TaskStep {
  return {
    text: `Watch work wait at ${label(id, node)} while its capacity is full.`,
    when: [
      atLeast(LOAD, load * 0.9),
      atLeast(busy(node), 0.9),
      atLeast(waiting(node), 1),
    ],
    holdMs: HOLD,
    ring: node,
    figs: [
      fig(busy(node), 'busy'),
      fig(waiting(node), 'tasks waiting'),
      fig(P99, 'slowest cycle time'),
    ],
  };
}

function change(
  node: string,
  field: NumericField,
  value: number,
  text: string,
  when: readonly Cond[],
  fieldLabel?: string,
): TaskStep {
  return {
    text,
    when: [
      field === 'serviceMs'
        ? below(setting(node, field), value < 10 ? value + 0.25 : value + 2)
        : exactly(setting(node, field), value),
      ...when,
    ],
    holdMs: HOLD,
    action: { kind: 'select', node },
    ring: node,
    field: fieldLabel ?? FIELD_LABELS[field],
    figs: [fig(FAILING, 'work failing'), fig(P99, 'slowest cycle time')],
  };
}

function relieve(
  id: string,
  multiple: number,
  constraint: string,
  node: string,
  field: NumericField,
  value: number,
  text: string,
  learned: string,
  whole = true,
): ExampleTask {
  const load = loadFor(id, multiple);
  return {
    presetId: id,
    goal: `Relieve the constraint at ${label(id, constraint)}.`,
    steps: [
      raise(load),
      watch(id, constraint, load),
      change(node, field, value, text, [
        atLeast(LOAD, load * 0.9),
        below(waiting(constraint), 5),
        ...(whole ? [below(FAILING, 0.02)] : []),
      ]),
    ],
    learned,
  };
}

const SIMPLE: readonly ExampleTask[] = [
  relieve(
    'single-server',
    3,
    'db',
    'db',
    'capacity',
    4,
    'Select Founder sign-off. Let four tasks move through sign-off at once, then watch the waiting work clear.',
    'Adding room at sign-off releases the engineers waiting behind it. More engineering capacity alone would leave that wait.',
  ),
  relieve(
    'load-balanced',
    3,
    'db',
    'db',
    'capacity',
    4,
    'Give the shared reviewer room for four tasks at once. Keep the same incoming work.',
    'Three pods still share one review step. Capacity there helps every pod.',
  ),
  relieve(
    'cache-aside',
    3,
    'db',
    'cache',
    'hitRate',
    0.9,
    'Improve Help docs so 90 percent of questions are answered without a person.',
    'Deflecting repeat questions gives the support lead time for the questions that need a person.',
  ),
  relieve(
    'async-workers',
    3,
    'worker',
    'worker',
    'instances',
    8,
    'Give the Ticket crew eight people. Wait for the existing backlog to drain.',
    'An instant acknowledgement does not mean the work is done. More ticket capacity must clear the old backlog as well as new arrivals.',
  ),
  relieve(
    'retry-storm',
    2,
    'db',
    'db',
    'capacity',
    4,
    'Give the Support engineer room for four asks at once, then wait for the repeated asks to clear.',
    'Waiting created repeated asks that made the wait worse. Relieving the support constraint breaks that loop.',
  ),
  relieve(
    'cdn-origin',
    3,
    'origin',
    'cdn',
    'hitRate',
    0.97,
    'Improve Self-serve setup so 97 percent finish without a person.',
    'Better self-serve removes work before it reaches onboarding. Hiring is not the only way to protect that team.',
  ),
  relieve(
    'read-replicas',
    3,
    'replicas',
    'replicas',
    'replicaCount',
    6,
    'Raise the number of deputies to six and watch the questions stop waiting.',
    'Deputies answer more questions. Decisions that only the CTO can make still share one owner.',
  ),
  relieve(
    'full-stack',
    3,
    'workers',
    'workers',
    'instances',
    16,
    'Give Product engineers sixteen people. Keep the incoming work fixed and let the feature backlog drain.',
    'Customers can be told their ask is logged while product work falls behind. Watch the backlog, not just the acknowledgement.',
    false,
  ),
  relieve(
    'specialised-stores',
    3,
    'vectors',
    'vectors',
    'capacity',
    4,
    'Let the AI assistant handle four questions at once and watch its own line clear.',
    'Relieving the AI assistant clears this path. The slow archive is a separate constraint and still needs its own check.',
    false,
  ),
  relieve(
    'event-driven',
    3,
    'audit',
    'audit',
    'capacity',
    4,
    'Give Legal review room for four tasks at once. Watch its line clear while the other teams keep working.',
    'One shipped feature creates several follow-up jobs. A legal backlog can grow after the customer has already heard yes.',
    false,
  ),
  relieve(
    'resilient-delivery',
    4,
    'transcoder',
    'transcoder',
    'instances',
    12,
    'Give the Content studio twelve people. Wait for the content backlog to clear.',
    'The studio needs enough capacity for new pieces and the work already waiting. Priority triage elsewhere still makes its own choices.',
    false,
  ),
  {
    presetId: 'seed-saas',
    goal: 'Reduce the decisions waiting on the founders.',
    steps: [
      raise(loadFor('seed-saas', 3)),
      watch('seed-saas', 'founders', loadFor('seed-saas', 3)),
      change(
        'founders',
        'readFraction',
        0.9,
        'Make 90 percent of sign-offs quick questions the deputies can answer. Watch failures fall below 8 percent; a line can remain.',
        [atLeast(LOAD, loadFor('seed-saas', 3) * 0.9), below(FAILING, 0.08)],
      ),
    ],
    learned:
      'Repeatable answers reduce the founder constraint. They do not eliminate all waiting in this model, so check what still needs a decision.',
  },
  relieve(
    'series-a-saas',
    3,
    'qa',
    'qa',
    'instances',
    3,
    'Add a third person to QA and wait for the test backlog to clear.',
    'The line could already build more than it could test. A tester changes output where another engineer did not.',
  ),
  relieve(
    'marketplace-ops',
    3,
    'tns',
    'rules',
    'hitRate',
    0.7,
    'Improve Auto-approve rules to answer 70 percent without a reviewer.',
    'Better rules protect reviewer time for the sellers and payouts that need judgement.',
  ),
  relieve(
    'devtools-oss',
    3,
    'review',
    'review',
    'instances',
    3,
    'Add a third person to PR review and watch completed pull requests move on.',
    'More contributors would feed the same review queue. A maintainer releases work already written.',
  ),
  relieve(
    'fintech-compliance',
    3,
    'kyc',
    'kyc',
    'instances',
    5,
    'Give the compliance check five analysts and watch the waiting applications clear.',
    'Every application paid the compliance step. Adding capacity after it would not have released the queue.',
  ),
  relieve(
    'openai',
    2,
    'compute',
    'compute',
    'capacity',
    80,
    'Double Shared compute to eighty tasks at once. Keep the same incoming work.',
    'In this model, research, product work and customers all needed the same compute. Delivered still excludes internal research and product work.',
  ),
  relieve(
    'nvidia',
    2,
    'memory',
    'memory',
    'capacity',
    88,
    'Model more supplier capacity: let Memory handle eighty-eight orders at once.',
    'In this model, supplier capacity releases orders. More internal engineers would still wait on memory.',
  ),
  relieve(
    'tesla',
    2,
    'battery',
    'battery',
    'capacity',
    112,
    'Let Battery packs build 112 packs at once, then watch the waiting orders clear.',
    'In this model, both vehicle and storage work share battery production. Capacity at assembly alone leaves that constraint.',
  ),
  relieve(
    'stripe',
    2,
    'review',
    'review',
    'instances',
    8,
    'Give human review eight people and keep the agent cap unchanged.',
    'In this model, agents can write more than people can review. More reviewers release changes already written.',
  ),
  relieve(
    'gitlab',
    2,
    'maintainers',
    'maintainers',
    'instances',
    11,
    'Raise Maintainers from nine people to eleven, then watch the waiting changes clear.',
    'In this model, only maintainers can accept a change. More authors would not add that authority.',
  ),
  relieve(
    'spotify',
    3,
    'release',
    'release',
    'serviceMs',
    37,
    'Shorten the Release manager hands-on time to 1.5 working hours or less per change.',
    'In this model, less time spent handing off each release lets finished squad work reach listeners sooner.',
  ),
  relieve(
    'amazon',
    3,
    'prepre',
    'prepre',
    'serviceMs',
    6,
    'Shorten the Pre-pre-meeting hands-on time to fifteen working minutes or less per idea.',
    'In this model, less preliminary approval work clears the queue without adding builders.',
  ),
  relieve(
    'apple',
    3,
    'executives',
    'peers',
    'edgeShare',
    0.95,
    'Raise the share resolved in Peer debate from 90 to 95 percent.',
    'In this model, settling more between peers protects the executive time needed for genuine impasses.',
  ),
];

function intakeTask(
  id: string,
  gate: string,
  team: string,
  multiple: number,
  limit: number,
): ExampleTask {
  const load = loadFor(id, multiple);
  return {
    presetId: id,
    goal: 'See what limiting work protects, then remove the limit and compare.',
    steps: [
      raise(load),
      {
        text: `Watch ${label(id, gate)} turn work away before it reaches the team.`,
        when: [atLeast(LOAD, load * 0.9), atLeast({ of: 'refused', node: gate }, 1)],
        holdMs: HOLD,
        ring: gate,
        figs: [
          fig({ of: 'refused', node: gate }, 'turned away at intake'),
          fig(P99, 'slowest cycle time'),
        ],
      },
      change(
        gate,
        'rateLimitRps',
        1000,
        'Raise the intake limit to 1,000 tasks a week. Watch the waiting work build instead.',
        [atLeast(LOAD, load * 0.9), atLeast(waiting(team), 5)],
      ),
      change(
        gate,
        'rateLimitRps',
        limit,
        `Restore the intake limit to ${limit} tasks a week. Wait for the team backlog to clear.`,
        [atLeast(LOAD, load * 0.9), below(waiting(team), 5)],
      ),
    ],
    learned:
      'The limit chooses what to decline before work starts. Removing it adds waiting work without adding capacity.',
  };
}

const SPECIAL: readonly ExampleTask[] = [
  intakeTask('rate-limited-api', 'limiter', 'api', 3, 28),
  intakeTask('drum-buffer-rope', 'rope', 'review', 3, 24),
  {
    presetId: 'sharded-database',
    goal: 'Watch one large customer overload one owner while others have room.',
    steps: [
      change(
        'shards',
        'hotKeyFraction',
        0.6,
        'Give one customer 60 percent of the asks.',
        [],
      ),
      watch('sharded-database', 'shards', loadFor('sharded-database', 1)),
      change(
        'shards',
        'hotKeyFraction',
        0,
        'Spread the asks evenly again, with no single hot customer.',
        [below(waiting('shards'), 5), below(FAILING, 0.02)],
      ),
    ],
    learned:
      'An average hides uneven ownership. Spreading asks fixes the overloaded owner without increasing the total team.',
  },
  {
    presetId: 'autoscaling-service',
    goal: 'See why hiring must account for the time before a person can contribute.',
    steps: [
      raise(loadFor('autoscaling-service', 3)),
      watch('autoscaling-service', 'api', loadFor('autoscaling-service', 3)),
      change(
        'scaler',
        'maxCapacity',
        8,
        'Raise the hiring plan maximum to eight people. Wait for at least six to be working and the backlog to clear.',
        [
          atLeast({ of: 'running', node: 'api' }, 6),
          below(waiting('api'), 5),
          below(FAILING, 0.02),
        ],
      ),
    ],
    learned:
      'Opening roles is not instant capacity. The backlog persists through the hiring decision and ramp-up time.',
  },
  {
    presetId: 'ai-agency',
    goal: 'Relieve contractor refusals while briefs are still accepted.',
    steps: [
      raise(loadFor('ai-agency', 3)),
      {
        text: 'Watch the contractors turn away work when all their seats are taken.',
        when: [
          atLeast(LOAD, loadFor('ai-agency', 3) * 0.9),
          atLeast({ of: 'turnedAway', node: 'contract' }, 1),
        ],
        holdMs: HOLD,
        ring: 'contract',
        figs: [fig({ of: 'turnedAway', node: 'contract' }, 'jobs turned away')],
      },
      change(
        'contract',
        'maxConcurrency',
        24,
        'Raise the contractor cap to 24. Watch their refusals stop.',
        [
          atLeast(LOAD, loadFor('ai-agency', 3) * 0.9),
          below({ of: 'turnedAway', node: 'contract' }, 0.5),
        ],
      ),
    ],
    learned:
      'A brief accepted into the rework loop is not a finished deliverable. The contractor cap controls one cause of repeated attempts.',
  },
  {
    presetId: 'anthropic',
    goal: 'Add capacity before raising the limit that protects it.',
    steps: [
      raise(loadFor('anthropic', 3)),
      {
        text: 'Watch Usage limits turn customers away while the serving compute stays below full.',
        when: [
          atLeast({ of: 'refused', node: 'limits' }, 1),
          below(busy('compute'), 0.95),
        ],
        holdMs: HOLD,
        ring: 'limits',
        figs: [
          fig({ of: 'refused', node: 'limits' }, 'turned away'),
          fig(busy('compute'), 'compute busy'),
        ],
      },
      change(
        'compute',
        'capacity',
        34,
        'Double Serving compute to 34 tasks at once before changing the limit.',
        [],
      ),
      change(
        'limits',
        'rateLimitRps',
        144,
        'Now raise Usage limits to 144 tasks a week and watch failures stop.',
        [below(FAILING, 0.02)],
      ),
    ],
    learned:
      'In this model, raising the usage limit alone moves the queue onto compute. Capacity first makes the higher limit sustainable.',
  },
  ...(['spacex', 'airbnb'] as const).map((id): ExampleTask => {
    const constraint = id === 'spacex' ? 'licence' : 'shared';
    const stress = loadFor(id, id === 'spacex' ? 3 : 2);
    const manageable = loadFor(id, id === 'spacex' ? 2 : 1);
    return {
      presetId: id,
      goal: 'Match commitments to a shared constraint instead of starting more work.',
      steps: [
        raise(stress),
        watch(id, constraint, stress),
        {
          ...raise(manageable),
          text: `Reduce incoming commitments to ${manageable} tasks a week. Wait for old work to clear and failures to fall below 2 percent.`,
          when: [
            exactly(LOAD, manageable),
            below(waiting(constraint), 5),
            below(FAILING, 0.02),
          ],
          holdMs: HOLD,
          ring: constraint,
          figs: [
            fig(waiting(constraint), 'tasks waiting'),
            fig(FAILING, 'work failing'),
          ],
        },
      ],
      learned:
        id === 'spacex'
          ? 'In this model, starting fewer flight changes protects a review process the engineering team does not control.'
          : 'In this model, fewer concurrent commitments let the shared teams finish work people still need. More starts had created abandoned work.',
    };
  }),
  ...(['circuit-breaker', 'multi-region'] as const).map((id): ExampleTask => {
    const node = id === 'circuit-breaker' ? 'payments' : 'us-api';
    const response = id === 'circuit-breaker' ? 'breaker' : 'eu-api';
    return {
      presetId: id,
      goal:
        id === 'circuit-breaker'
          ? 'See the stop-the-line rule protect a team from a failing partner.'
          : 'Watch a backup owner take over when the primary is out.',
      steps: [
        {
          text: `Select ${label(id, node)} and press Take out.`,
          when: [atLeast({ of: 'fault', node, kind: 'crash' }, 1)],
          action: { kind: 'select', node },
          ring: node,
        },
        {
          text:
            id === 'circuit-breaker'
              ? 'Watch the stop-the-line rule open and refuse new work.'
              : 'Wait for the backup owner to start finishing work while the primary remains out.',
          when: [
            atLeast({ of: 'fault', node, kind: 'crash' }, 1),
            atLeast(
              id === 'circuit-breaker'
                ? { of: 'breakerOpen', node: response }
                : { of: 'served', node: response },
              1,
            ),
          ],
          holdMs: 500,
          ring: response,
          figs: [
            fig(
              id === 'circuit-breaker'
                ? { of: 'breakerOpen', node: response }
                : { of: 'served', node: response },
              id === 'circuit-breaker' ? 'stop-the-line rule' : 'backup finished',
            ),
          ],
        },
      ],
      learned:
        id === 'circuit-breaker'
          ? 'The rule stops sending more work to a partner that is failing. It does not repair the partner.'
          : 'The backup buys cover after a handover. It does not add capacity while the primary is healthy.',
    };
  }),
];

export const EXAMPLE_TASKS: readonly ExampleTask[] = [...SIMPLE, ...SPECIAL];
export const taskFor = (id: string | null): ExampleTask | undefined =>
  id === null ? undefined : EXAMPLE_TASKS.find((task) => task.presetId === id);

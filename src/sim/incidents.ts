import type { Challenge } from './challenge';
import { defaultConfig } from './presets';
import type {
  FaultEvent,
  NodeConfig,
  NodeKind,
  SimEdge,
  SimNode,
  Topology,
} from './types';

/**
 * Startup incidents, rebuilt from parts the simulator already has.
 *
 * Each one is a scene that plays what happened on a fault schedule, the
 * story in plain words, and a brief judged by the same check as every other
 * challenge. They are not presets and not in CHALLENGES on purpose: neither
 * list moves, so no example's snapshots and no link to one can change.
 *
 * The hard rule is about facts. Each is a composite of a common startup
 * story, not one company's record, and `simNote` says so. `date` is when in
 * a company's life it happens, and `source` is background reading on the
 * idea, not a postmortem. Every time and number the simulator shows is its
 * own. The briefs' thresholds were measured against the
 * engine; incidents.test.ts pins them.
 */
export interface Incident {
  id: string;
  /** Plain words: "The launch week". */
  name: string;
  /** When in a company's life it happens: "Seed stage, launch week". */
  date: string;
  tagline: string;
  source: { title: string; url: string };
  /** What broke, why it spread and how it was fixed. */
  story: readonly string[];
  /** How the simulator's version differs in time and size from the real one. */
  simNote: string;
  /** The design that plays it, with the faults that recreate it. */
  scene: Topology;
  /** What is happening, by simulated time. Sorted by `atMs`, the first at 0. */
  captions: readonly Caption[];
  brief: Challenge;
}

export interface Caption {
  atMs: number;
  text: string;
}

function node(
  id: string,
  kind: NodeKind,
  label: string,
  x: number,
  y: number,
  overrides: Partial<NodeConfig> = {},
): SimNode {
  return { id, kind, label, x, y, config: { ...defaultConfig(kind), ...overrides } };
}

function edge(from: string, to: string): SimEdge {
  return { id: `${from}->${to}`, from, to, weight: 1 };
}

/* ---------------- The launch week ---------------- */

const LAUNCH: Incident = {
  id: 'incident-launch-week',
  name: 'The launch week',
  date: 'Seed stage, launch week',
  tagline: 'A launch spike swamps the founder, and support goes down with it',
  source: {
    title: 'Theory of constraints (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Theory_of_constraints',
  },
  story: [
    'A seed-stage company launches on a public launch site, and signups jump to several times a normal week.',
    'Every new account gets an onboarding call, and anything unusual goes to the founder for a yes.',
    'Existing customers keep asking for help as usual, and support needs the same founder to approve refunds and credits.',
    'The founder can only say yes to so many things a week. Launch signups take every slot, and customer tickets sit waiting behind them.',
    'Support stalls for customers who had nothing to do with the launch, and some of them give up.',
    'The team fixed it by protecting the founder: launch signups got a fixed share of founder time, and customers kept the rest.',
  ],
  simNote:
    'A composite of a common startup story, not one company. Launch signups burst to four times their usual rate from week 22 to 25, and the numbers are the model.',
  scene: {
    nodes: [
      node('customers', 'client', 'Customer tickets', 40, 60, {
        rps: 30,
        timeoutMs: 2000,
      }),
      node('launch', 'client', 'Launch signups', 40, 320, {
        rps: 15,
        timeoutMs: 2000,
        traffic: 'spike',
        trafficPeriodS: 25,
      }),
      node('support', 'service', 'Support team', 300, 60, {
        capacity: 3,
        instances: 2,
        serviceMs: 50,
        serviceCv: 0.5,
        queueLimit: 12,
      }),
      node('onboarding', 'service', 'Onboarding calls', 300, 320, {
        capacity: 3,
        instances: 2,
        serviceMs: 50,
        serviceCv: 0.5,
        queueLimit: 12,
      }),
      node('founder', 'db', 'Founder', 600, 190, {
        capacity: 2,
        serviceMs: 40,
        serviceCv: 0.6,
        queueLimit: 16,
      }),
    ],
    edges: [
      edge('customers', 'support'),
      edge('launch', 'onboarding'),
      edge('support', 'founder'),
      edge('onboarding', 'founder'),
    ],
  },
  captions: [
    {
      atMs: 0,
      text: 'A normal week. Support and onboarding both need the founder for a yes, and the founder keeps up.',
    },
    {
      atMs: 22_500,
      text: 'Launch day. Signups jump to four times normal, and every one wants the founder.',
    },
    {
      atMs: 24_000,
      text: 'The founder is full. Customer tickets wait behind launch signups, and support stalls.',
    },
    {
      atMs: 25_000,
      text: 'The launch is over. The founder works through the pile, and support recovers.',
    },
  ],
  brief: {
    id: 'incident-launch-week',
    version: 1,
    name: 'Protect your customers in launch week',
    brief:
      'The next launch brings 60 signups a week on top of the usual 30 customer tickets, and both need the founder. Launch signups may wait or drop, but existing customers must not: drop no more than 2 in 100 customer tickets, and close the slowest 1 in 100 within a week. You cannot add people or time to anyone.',
    presetId: 'incident-launch-week',
    startOverrides: { launch: { rps: 60 } },
    loadRps: 90,
    budget: 0,
    goals: [
      { metric: 'errorRate', max: 2, route: 'customers' },
      { metric: 'p99', max: 1000, route: 'customers' },
    ],
    hints: [
      'Customer tickets fail, yet nothing about them changed. Watch who they are waiting for.',
      'Support is not busy. Its people are holding tickets while they wait for the founder.',
      'Look at the line from onboarding to the founder. How much of the founder can launch signups take right now?',
    ],
    lesson:
      'The founder was one constraint shared by two flows, and the launch took all of it. Capping how much founder time launch signups could hold, with reserved capacity on their path, kept the rest free for customers. Launch signups waited longer, which they would have anyway. When a launch is coming, decide in advance how much of your constraint it may use.',
  },
};

/* ---------------- The key engineer quits ---------------- */

const QUIT_FAULTS: readonly FaultEvent[] = [
  { atMs: 20_000, action: 'inject', nodeId: 'lead', kind: 'crash-instance' },
];

const QUIT: Incident = {
  id: 'incident-key-engineer-quits',
  name: 'The key engineer quits',
  date: 'Series A, mid quarter',
  tagline: 'One person out, and every change stops',
  source: {
    title: 'Bus factor (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Bus_factor',
  },
  story: [
    'One senior engineer reviews and ships every change, because they know the codebase best.',
    'It works: they are fast, and the team never waits long.',
    'They resign, effective immediately, in the middle of a quarter.',
    'Nobody else can approve a change, so every engineer ends up holding finished work that cannot ship.',
    'Nothing ships for weeks while the team learns the parts only one person knew.',
    'The fix the team made afterwards was to spread review across several people, so losing one slows review instead of stopping it.',
  ],
  simNote:
    'A composite of a common startup story, not one company. The lead reviewer leaves at week 20 and is not replaced in the run, and the numbers are the model.',
  scene: {
    nodes: [
      node('work', 'client', 'Roadmap work', 40, 190, { rps: 30, timeoutMs: 3000 }),
      node('engineers', 'service', 'Engineers', 300, 190, {
        capacity: 3,
        instances: 4,
        serviceMs: 150,
        serviceCv: 0.5,
        queueLimit: 24,
      }),
      node('lead', 'service', 'Lead reviewer', 600, 190, {
        capacity: 4,
        instances: 1,
        serviceMs: 50,
        serviceCv: 0.5,
        queueLimit: 24,
      }),
    ],
    edges: [edge('work', 'engineers'), edge('engineers', 'lead')],
    faults: [...QUIT_FAULTS],
  },
  captions: [
    {
      atMs: 0,
      text: 'A normal quarter. Every change goes through one lead reviewer, who keeps up easily.',
    },
    {
      atMs: 20_000,
      text: 'The lead reviewer quits. Nobody else can approve a change.',
    },
    {
      atMs: 25_000,
      text: 'Engineers hold finished work that cannot ship, and new work is dropped.',
    },
  ],
  brief: {
    id: 'incident-key-engineer-quits',
    version: 1,
    name: 'Survive the key engineer leaving',
    brief:
      'Every change goes through one lead reviewer who juggles four reviews at once. At week 20 they quit, and nobody replaces them this quarter. Across the whole run, drop no more than 2 in 100 pieces of work, and ship the slowest 1 in 100 within two weeks. You cannot add review time, only arrange the time you have.',
    presetId: 'incident-key-engineer-quits',
    loadRps: 30,
    budget: 0,
    faults: QUIT_FAULTS,
    goals: [
      { metric: 'errorRate', max: 2 },
      { metric: 'p99', max: 2000 },
    ],
    hints: [
      'Everything is fine until week 20. Watch what is left of review after that.',
      'A faster or busier lead reviewer still stops when they leave.',
      'Look at the lead reviewer. How many people do review? If one of them left, would the rest cover 30 a week?',
    ],
    lesson:
      'One person was a single point of failure, however good they were. The same review time spread across several people meant losing one cost a share of review, not all of it, as long as the rest could carry the load. Ask of every step: if this person left tomorrow, does the work slow down, or stop?',
  },
};

/* ---------------- The enterprise deal ---------------- */

const DEAL: Incident = {
  id: 'incident-enterprise-deal',
  name: 'The enterprise deal',
  date: 'Series A, first big contract',
  tagline: "One big customer's asks starve everyone else",
  source: {
    title: 'The Goal, by Eliyahu Goldratt (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/The_Goal_(novel)',
  },
  story: [
    'A small software company signs its first enterprise customer, worth more than the next twenty combined.',
    'The contract promises fast turnaround on their requests, and the requests start arriving within weeks.',
    'Engineering takes every enterprise ask as it comes, in the same line as everyone else.',
    "Within a quarter the enterprise customer's asks fill the line, and smaller customers wait weeks for fixes they used to get in days.",
    'Smaller customers start leaving, quietly, while the dashboard shows engineering busier than ever.',
    'The company capped the work the enterprise customer could have in progress at once, and the rest of the team went back to serving everyone.',
  ],
  simNote:
    "A composite of a common startup story, not one company. The enterprise customer's asks ramp up over the first 20 weeks, and the numbers are the model.",
  scene: {
    nodes: [
      node('everyone', 'client', 'Other customers', 40, 60, {
        rps: 30,
        timeoutMs: 2000,
      }),
      node('whale', 'client', 'Enterprise customer', 40, 320, {
        rps: 40,
        timeoutMs: 2000,
        traffic: 'ramp',
        trafficPeriodS: 20,
      }),
      node('eng', 'service', 'Engineering', 340, 190, {
        capacity: 2,
        instances: 3,
        serviceMs: 100,
        serviceCv: 0.6,
        queueLimit: 32,
      }),
    ],
    edges: [edge('everyone', 'eng'), edge('whale', 'eng')],
  },
  captions: [
    {
      atMs: 0,
      text: 'The deal is signed. Engineering serves 30 asks a week from everyone else, with room to spare.',
    },
    {
      atMs: 10_000,
      text: 'The enterprise customer ramps up. Their asks join the same line as everyone else.',
    },
    {
      atMs: 18_000,
      text: 'Engineering is full. Everyone waits weeks, and asks from smaller customers are dropped.',
    },
  ],
  brief: {
    id: 'incident-enterprise-deal',
    version: 1,
    name: 'Keep serving everyone else',
    brief:
      'The enterprise customer now sends 40 asks a week, everyone else 30, and engineering finishes just under 60. The enterprise customer agreed to a cap on work in progress; everyone else did not. Drop no more than 2 in 100 asks from other customers, and close their slowest 1 in 100 within two weeks. You cannot hire.',
    presetId: 'incident-enterprise-deal',
    loadRps: 70,
    budget: 0,
    goals: [
      { metric: 'errorRate', max: 2, route: 'everyone' },
      { metric: 'p99', max: 2000, route: 'everyone' },
    ],
    hints: [
      'Engineering is full. Find out whose work fills it.',
      "Everyone's asks wait in the same line. The enterprise customer's share of that line has no limit.",
      'Look at the connection from the enterprise customer to engineering. How many of their asks should be in progress at once?',
    ],
    lesson:
      "Engineering could not serve 70 a week, and with one shared line the biggest customer decided who waited. Capping the enterprise customer's work in progress, with reserved capacity or an intake limit on their path, kept a fixed share of engineering for everyone else. A big customer is worth serving, but decide how much of your constraint they get, or they will take all of it.",
  },
};

export const INCIDENTS: readonly Incident[] = [LAUNCH, QUIT, DEAL];

/** The briefs, for the challenge store and lookup by id. */
export const INCIDENT_BRIEFS: readonly Challenge[] = INCIDENTS.map((i) => i.brief);

export function incidentById(id: string): Incident | undefined {
  return INCIDENTS.find((i) => i.id === id);
}

/** The caption showing at `nowMs`, or null before the first one. */
export function captionAt(incident: Incident, nowMs: number): Caption | null {
  let shown: Caption | null = null;
  for (const c of incident.captions) {
    if (c.atMs <= nowMs) shown = c;
  }
  return shown;
}

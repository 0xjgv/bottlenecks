import { describe, expect, it } from 'vitest';
import { applyLoad } from './challenge';
import { challengeById, CHALLENGES } from './challenges';
import { Engine } from './engine';
import { sanitizeFaults } from './faults';
import { captionAt, INCIDENTS, incidentById } from './incidents';
import type { Incident } from './incidents';
import { judge, startDesign } from './judge';
import { defaultConfig, PRESETS } from './presets';
import type { NodeConfig, NodeKind, RouteStats, Topology } from './types';

/*
 * An incident is three promises: the scene plays the failure the story
 * tells, the brief fails as it starts and passes with the fix the real
 * postmortem points at, and nothing about it leaks into the examples or
 * the existing briefs.
 */

function incident(id: string): Incident {
  const i = incidentById(id);
  if (!i) throw new Error(`no incident ${id}`);
  return i;
}

/** The design a reader starts the brief with. */
function opened(i: Incident): Topology {
  return applyLoad(structuredClone(startDesign(i.brief)), i.brief.loadRps);
}

type Edit = (t: Topology) => void;

const set =
  (id: string, config: Partial<NodeConfig>): Edit =>
  (t) => {
    const n = t.nodes.find((x) => x.id === id);
    if (!n) throw new Error(`no node ${id}`);
    Object.assign(n.config, config);
  };

const add =
  (
    id: string,
    kind: NodeKind,
    x: number,
    y: number,
    config: Partial<NodeConfig> = {},
  ): Edit =>
  (t) => {
    t.nodes.push({
      id,
      kind,
      label: id,
      x,
      y,
      config: { ...defaultConfig(kind), ...config },
    });
  };

const wire =
  (from: string, to: string): Edit =>
  (t) => {
    t.edges.push({ id: `${from}->${to}`, from, to, weight: 1 });
  };

const unwire =
  (from: string, to: string): Edit =>
  (t) => {
    t.edges = t.edges.filter((e) => e.id !== `${from}->${to}`);
  };

const all =
  (...edits: Edit[]): Edit =>
  (t) => {
    for (const e of edits) e(t);
  };

function status(i: Incident, edit: Edit): string {
  const design = opened(i);
  edit(design);
  return judge(i.brief, design).status;
}

/** Route readings every five simulated seconds, keyed by the second. */
function timeline(t: Topology, seconds: number): Map<number, readonly RouteStats[]> {
  const engine = new Engine(t, 1);
  const out = new Map<number, readonly RouteStats[]>();
  for (let s = 1; s <= seconds; s++) {
    for (let k = 0; k < 60; k++) engine.advance(1000 / 60);
    if (s % 5 === 0) out.set(s, engine.routes());
  }
  return out;
}

function errorsAt(rows: Map<number, readonly RouteStats[]>, s: number): number[] {
  return (rows.get(s) ?? []).map((r) => Math.round(r.errorRate * 100));
}

/** A new component on the connection from `from` to `to`. */
const between = (
  from: string,
  to: string,
  kind: NodeKind,
  config: Partial<NodeConfig> = {},
): Edit =>
  all(
    add(`new-${kind}`, kind, 600, 450, config),
    unwire(from, to),
    wire(from, `new-${kind}`),
    wire(`new-${kind}`, to),
  );

describe('the set of incidents', () => {
  it('keeps out of the examples and the briefs', () => {
    for (const i of INCIDENTS) {
      expect(PRESETS.some((p) => p.id === i.id)).toBe(false);
      expect(CHALLENGES.some((c) => c.id === i.brief.id)).toBe(false);
      expect(challengeById(i.brief.id)).toBe(i.brief);
    }
  });

  it.each(INCIDENTS.map((i) => [i.id, i] as const))('%s is told honestly', (_, i) => {
    expect(i.story.length).toBeGreaterThanOrEqual(4);
    expect(i.story.length).toBeLessThanOrEqual(6);
    expect(new URL(i.source.url).protocol).toBe('https:');
    expect(i.source.title.length).toBeGreaterThan(0);
    expect(i.simNote.length).toBeGreaterThan(0);
    expect(i.captions[0]?.atMs).toBe(0);
    const words = [
      i.name,
      i.tagline,
      i.simNote,
      ...i.story,
      ...i.captions.map((c) => c.text),
      i.brief.brief,
      i.brief.lesson,
      ...i.brief.hints,
    ];
    for (const w of words) expect(w).not.toMatch(/[\u2013\u2014]/);
    const times = i.captions.map((c) => c.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it.each(INCIDENTS.map((i) => [i.id, i] as const))(
    '%s faults name parts that exist',
    (_, i) => {
      const fail = () => {
        throw new Error('dropped');
      };
      expect(sanitizeFaults(i.scene.faults, i.scene, fail)).toHaveLength(
        i.scene.faults?.length ?? 0,
      );
      expect(sanitizeFaults(i.brief.faults, i.scene, fail)).toHaveLength(
        i.brief.faults?.length ?? 0,
      );
    },
  );

  it.each(INCIDENTS.map((i) => [i.id, i] as const))(
    '%s has no overlapping boxes',
    (_, i) => {
      const ns = i.scene.nodes;
      for (let a = 0; a < ns.length; a++) {
        for (let b = a + 1; b < ns.length; b++) {
          const apart =
            Math.abs(ns[a]!.x - ns[b]!.x) >= 184 || Math.abs(ns[a]!.y - ns[b]!.y) >= 88;
          expect(apart).toBe(true);
        }
      }
    },
  );

  it('shows the caption the clock has reached', () => {
    const launch = incident('incident-launch-week');
    expect(captionAt(launch, 0)?.atMs).toBe(0);
    expect(captionAt(launch, 22_499)?.atMs).toBe(0);
    expect(captionAt(launch, 22_500)?.atMs).toBe(22_500);
    expect(captionAt(launch, 90_000)?.atMs).toBe(25_000);
  });
});

describe('the launch week', () => {
  const launch = incident('incident-launch-week');

  it('plays it: fine, customers fail while the launch spikes, then back', () => {
    // Routes are [customer tickets, launch signups].
    const rows = timeline(launch.scene, 30);
    expect(errorsAt(rows, 20)).toEqual([0, 0]);
    expect(errorsAt(rows, 25)[0]).toBeGreaterThan(10);
    expect(errorsAt(rows, 30)).toEqual([0, 0]);
  });

  it('fails as it starts', () => {
    expect(status(launch, () => {})).toBe('goal-missed');
  });

  it.each([
    [
      'launch signups capped at 2 in the founder',
      between('onboarding', 'founder', 'bulkhead', { bulkheadMax: 2 }),
    ],
    [
      'launch signups capped at 1 in the founder',
      between('onboarding', 'founder', 'bulkhead', { bulkheadMax: 1 }),
    ],
  ])('passes with %s', (_, edit) => {
    expect(status(launch, edit)).toBe('passed');
  });

  it.each([['a deeper line at the founder', set('founder', { queueLimit: 64 })]])(
    'fails with %s',
    (_, edit) => {
      expect(status(launch, edit)).toBe('goal-missed');
    },
  );

  it.each([
    ['more founder time', set('founder', { capacity: 3 })],
    ['a bigger support team', set('support', { capacity: 6 })],
  ])('will not take %s', (_, edit) => {
    expect(status(launch, edit)).toBe('over-budget');
  });
});

describe('the key engineer quits', () => {
  const quit = incident('incident-key-engineer-quits');

  it('plays it: fine, then nothing ships once the lead reviewer leaves', () => {
    const rows = timeline(quit.scene, 40);
    expect(errorsAt(rows, 20)).toEqual([0]);
    for (const s of [25, 30, 40]) expect(errorsAt(rows, s)).toEqual([100]);
  });

  it('fails as it starts', () => {
    expect(status(quit, () => {})).toBe('goal-missed');
  });

  it.each([
    ['review spread across two people', set('lead', { capacity: 2, instances: 2 })],
    ['review spread across four people', set('lead', { capacity: 1, instances: 4 })],
  ])('passes with %s', (_, edit) => {
    expect(status(quit, edit)).toBe('passed');
  });

  it.each([
    ['engineers giving up on review sooner', set('engineers', { timeoutMs: 500 })],
    ['a deeper review line', set('lead', { queueLimit: 100 })],
  ])('fails with %s', (_, edit) => {
    expect(status(quit, edit)).toBe('goal-missed');
  });

  it('will not take more review time', () => {
    expect(status(quit, set('lead', { capacity: 8 }))).toBe('over-budget');
  });
});

describe('the enterprise deal', () => {
  const deal = incident('incident-enterprise-deal');

  it('plays it: fine, then everyone drops work once the ramp fills engineering', () => {
    // Routes are [other customers, enterprise customer].
    const rows = timeline(deal.scene, 30);
    expect(errorsAt(rows, 10)).toEqual([0, 0]);
    expect(errorsAt(rows, 25)[0]).toBeGreaterThan(10);
    expect(errorsAt(rows, 30)[0]).toBeGreaterThan(10);
  });

  it('fails as it starts', () => {
    expect(status(deal, () => {})).toBe('goal-missed');
  });

  it.each([
    [
      'reserved capacity of 3 for the enterprise customer',
      between('whale', 'eng', 'bulkhead', { bulkheadMax: 3 }),
    ],
    [
      'an intake limit of 25 a week on the enterprise customer',
      between('whale', 'eng', 'ratelimiter', { rateLimitRps: 25, burst: 25 }),
    ],
  ])('passes with %s', (_, edit) => {
    expect(status(deal, edit)).toBe('passed');
  });

  it.each([
    [
      'an intake limit of 40 a week, the whole ask',
      between('whale', 'eng', 'ratelimiter', { rateLimitRps: 40, burst: 40 }),
    ],
  ])('fails with %s', (_, edit) => {
    expect(status(deal, edit)).toBe('goal-missed');
  });

  it('fails outright with a deeper engineering line', () => {
    expect(status(deal, set('eng', { queueLimit: 200 }))).not.toBe('passed');
  });

  it('will not take more engineers', () => {
    expect(status(deal, set('eng', { capacity: 3 }))).toBe('over-budget');
  });
});

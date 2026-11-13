import { describe, expect, it } from 'vitest';
import { Engine } from '../sim/engine';
import { PRESETS } from '../sim/presets';
import { edge, node } from '../sim/presetKit';
import type { SimSnapshot, Topology } from '../sim/types';
import { scaled } from './growth';
import { unfinishedWork } from './unfinished';

function preset(id: string): Topology {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return structuredClone(found.topology);
}

/**
 * Snapshots at whole weeks, so each case is checked at several moments. The
 * engine reuses its node and failure records between snapshots, so each is
 * copied to keep the moment it was taken.
 */
function weeks(t: Topology, at: readonly number[]): SimSnapshot[] {
  const engine = new Engine(t, 1);
  const out: SimSnapshot[] = [];
  let ms = 0;
  for (const w of at) {
    for (; ms < w * 1000; ms += 50) engine.advance(50);
    const s = engine.snapshot();
    out.push({
      ...s,
      nodes: { ...s.nodes },
      failuresByReason: { ...s.failuresByReason },
    });
  }
  return out;
}

/** Items the sources sent and have not heard back on: arrived - finished - failed. */
function openItems(t: Topology, s: SimSnapshot): number {
  let finished = 0;
  for (const n of t.nodes)
    if (n.kind === 'client') finished += s.nodes[n.id]?.totalCompleted ?? 0;
  return s.system.totalRequests - finished - s.system.totalFailed;
}

function read(t: Topology, s: SimSnapshot): number {
  const n = unfinishedWork(t, s);
  if (n === null) throw new Error('expected a number');
  return n;
}

const AT = [5, 15, 25];

describe('unfinished work', () => {
  it('counts each item once down a plain chain', () => {
    for (const id of ['single-server', 'load-balanced']) {
      const t = scaled(preset(id), 1.5);
      for (const s of weeks(t, AT)) {
        expect(s.failuresByReason.timeout).toBe(0);
        expect(read(t, s)).toBe(openItems(t, s));
      }
    }
  });

  it('counts jobs the backlog accepted and the crew has not finished', () => {
    const t = scaled(preset('async-workers'), 3);
    const backlog = t.nodes.find((n) => n.kind === 'queue')?.id ?? '';
    const crew = t.nodes.find((n) => n.kind === 'worker')?.id ?? '';
    for (const s of weeks(t, AT)) {
      const b = s.nodes[backlog];
      const c = s.nodes[crew];
      if (!b || !c) throw new Error('missing stats');
      const openJobs = b.totalCompleted - c.totalCompleted - c.totalFailed;
      expect(b.queued).toBeGreaterThan(100);
      expect(read(t, s)).toBe(openItems(t, s) + openJobs);
    }
  });

  /*
   * The cases below build their own designs rather than load a company map:
   * those are edited often, and a test of this count must not move when a
   * map gains a backlog.
   */

  it('counts work still being done after the requester gave up', () => {
    // A team that finishes 160 a week, asked for 400, by customers who give
    // up after a week (the airbnb shape at 4x).
    const t: Topology = {
      nodes: [
        node('c', 'client', 'c', 0, 0, { rps: 400, timeoutMs: 1000 }),
        node('team', 'service', 'team', 1, 0, {
          capacity: 1,
          instances: 4,
          queueLimit: 1000,
        }),
      ],
      edges: [edge('c', 'team')],
    };
    const snaps = weeks(t, [5, 10, 15, 20, 25, 30]);
    for (const s of snaps) expect(read(t, s)).toBeGreaterThanOrEqual(openItems(t, s));
    // At some of these moments abandoned work is in progress, so the count
    // exceeds what arrived and has not been answered.
    expect(snaps.some((s) => read(t, s) > openItems(t, s))).toBe(true);
    expect(snaps.at(-1)?.failuresByReason.timeout).toBeGreaterThan(0);
  });

  it('reads contractors as their running work, not their waiting', () => {
    const t: Topology = {
      nodes: [
        node('c', 'client', 'c', 0, 0, { rps: 200, timeoutMs: 0 }),
        node('agents', 'lambda', 'agents', 1, 0),
        node('review', 'service', 'review', 2, 0, { capacity: 1, instances: 6 }),
      ],
      edges: [edge('c', 'agents'), edge('agents', 'review')],
    };
    for (const s of weeks(t, AT)) {
      expect(s.nodes.agents?.waitingOnDownstream).toBeGreaterThan(0);
      expect(read(t, s)).toBe(openItems(t, s));
    }
  });

  it('counts one task per team when an item needs several at once', () => {
    // One item needs three teams at once (the apple shape).
    const t: Topology = {
      nodes: [
        node('c', 'client', 'c', 0, 0, { rps: 60, timeoutMs: 0 }),
        node('a', 'service', 'a', 1, 0, { capacity: 1, instances: 2 }),
        node('b', 'service', 'b', 1, 1, { capacity: 1, instances: 2 }),
        node('d', 'service', 'd', 1, 2, { capacity: 1, instances: 2 }),
      ],
      edges: [edge('c', 'a'), edge('c', 'b'), edge('c', 'd')],
    };
    for (const s of weeks(t, AT)) {
      const items = openItems(t, s);
      const tasks = read(t, s);
      expect(tasks).toBeGreaterThan(items);
      expect(tasks).toBeLessThanOrEqual(3 * items);
    }
  });

  it('counts people waiting for reserved capacity, not the calls it has out', () => {
    const t: Topology = {
      nodes: [
        node('c', 'client', 'c', 0, 0, { rps: 400, timeoutMs: 0 }),
        node('bh', 'bulkhead', 'bh', 1, 0, {
          bulkheadMode: 'wait',
          bulkheadMax: 4,
          acquireQueueMax: 500,
          acquireTimeoutMs: 100_000,
        }),
        node('svc', 'service', 'svc', 2, 0, {
          capacity: 1,
          instances: 4,
          timeoutMs: 0,
        }),
      ],
      edges: [edge('c', 'bh'), edge('bh', 'svc')],
    };
    for (const s of weeks(t, AT)) expect(read(t, s)).toBe(openItems(t, s));
  });

  it('counts promised paperwork until it is written down', () => {
    const t: Topology = {
      nodes: [
        node('c', 'client', 'c', 0, 0, { rps: 60, timeoutMs: 0 }),
        node('svc', 'service', 'svc', 1, 0, { timeoutMs: 0 }),
        node('wb', 'writebehind', 'wb', 2, 0, { timeoutMs: 0 }),
        node('db', 'db', 'db', 3, 0, { timeoutMs: 0 }),
      ],
      edges: [edge('c', 'svc'), edge('svc', 'wb'), edge('wb', 'db')],
    };
    for (const s of weeks(t, AT)) {
      expect(read(t, s)).toBeGreaterThanOrEqual(
        openItems(t, s) + (s.nodes.wb?.dirtyWrites ?? 0),
      );
      expect(s.nodes.wb?.dirtyWrites).toBeGreaterThan(0);
    }
  });

  describe('is null where work sits out of sight', () => {
    const last = (t: Topology) => weeks(t, [5])[0] as SimSnapshot;

    it('in a design with retries', () => {
      for (const id of [
        'retry-storm',
        'ai-agency',
        'resilient-delivery',
        'fintech-compliance',
      ]) {
        const t = preset(id);
        expect(unfinishedWork(t, last(t)), id).toBeNull();
      }
    });

    it('with a team channel or standing meetings', () => {
      for (const kind of ['streambroker', 'websocket'] as const) {
        const t: Topology = {
          nodes: [
            node('c', 'client', 'c', 0, 0, { rps: 50 }),
            node('k', kind, 'k', 1, 0),
            node('svc', 'service', 'svc', 2, 0),
          ],
          edges: [edge('c', 'k'), edge('k', 'svc')],
        };
        expect(unfinishedWork(t, last(t)), kind).toBeNull();
      }
    });

    it('on a connection that takes time to cross', () => {
      const t = preset('single-server');
      const first = t.edges[0];
      if (!first) throw new Error('no edge');
      first.latencyMs = 10;
      expect(unfinishedWork(t, last(t))).toBeNull();
    });

    it('with reserved capacity that takes time of its own', () => {
      const t: Topology = {
        nodes: [
          node('c', 'client', 'c', 0, 0, { rps: 50 }),
          node('bh', 'bulkhead', 'bh', 1, 0, { serviceMs: 1 }),
          node('svc', 'service', 'svc', 2, 0),
        ],
        edges: [edge('c', 'bh'), edge('bh', 'svc')],
      };
      expect(unfinishedWork(t, last(t))).toBeNull();
    });
  });
});

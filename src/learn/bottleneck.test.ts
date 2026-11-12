import { describe, expect, it } from 'vitest';
import { Engine } from '../sim/engine';
import { PRESETS } from '../sim/presets';
import type { FailureKind, FailureOpts, SimSnapshot, Topology } from '../sim/types';
import { formatCount } from '../components/format';
import { findBottleneck, type Verdict } from './bottleneck';

/**
 * Every case drives the real engine, seed 1, so the sentence is checked
 * against the same numbers the canvas would be showing at that moment.
 */

function scaled(t: Topology, factor: number): Topology {
  return {
    ...t,
    nodes: t.nodes.map((n) =>
      n.kind === 'client' && n.config.rps !== undefined
        ? { ...n, config: { ...n.config, rps: n.config.rps * factor } }
        : n,
    ),
  };
}

function preset(id: string): Topology {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p.topology;
}

function idOf(t: Topology, label: string): string {
  const n = t.nodes.find((x) => x.label === label);
  if (!n) throw new Error(`no node ${label}`);
  return n.id;
}

interface Run {
  topology: Topology;
  snapshot: SimSnapshot;
  verdict: Verdict;
}

function runFor(
  topology: Topology,
  seconds: number,
  fault?: { at: number; label: string; kind: FailureKind; opts?: FailureOpts },
): Run {
  const engine = new Engine(topology, 1);
  for (let s = 0; s < seconds; s += 1) {
    if (fault && s === fault.at) {
      engine.injectFailure(idOf(topology, fault.label), fault.kind, fault.opts);
    }
    for (let i = 0; i < 10; i += 1) engine.advance(100);
  }
  const snapshot = engine.snapshot();
  return { topology, snapshot, verdict: findBottleneck(topology, snapshot) };
}

function problemAt(run: Run): string {
  if (run.verdict.kind !== 'problem') {
    throw new Error(`expected a problem, got ${run.verdict.kind}: ${run.verdict.text}`);
  }
  return run.verdict.nodeId;
}

describe('findBottleneck', () => {
  it('finds nothing struggling in any example at its starting load', () => {
    const wrong: string[] = [];
    for (const p of PRESETS) {
      const engine = new Engine(p.topology, 1);
      for (let s = 1; s <= 20; s += 1) {
        for (let i = 0; i < 10; i += 1) engine.advance(100);
        if (s % 5 !== 0) continue;
        const v = findBottleneck(p.topology, engine.snapshot());
        if (v.kind === 'problem') wrong.push(`${p.id} at ${s}s: ${v.text}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 60_000);

  it('names the database as the constraint in the founder example at 3x', () => {
    const run = runFor(scaled(preset('single-server'), 3), 10);
    const db = idOf(run.topology, 'Founder sign-off');
    expect(problemAt(run)).toBe(db);
    const s = run.snapshot.nodes[db];
    expect(run.verdict.text).toContain(
      'Founder sign-off is the constraint: all 2 task slots busy',
    );
    // The backlog in the sentence is the snapshot's own number.
    expect(run.verdict.text).toContain(`${formatCount(s?.queued)} tasks waiting`);
    expect(run.verdict.text).toMatch(
      /Engineers is not the problem; it is stuck behind it, with \d+ tasks blocked waiting on it\./,
    );
    // A Goal-style next step closes the verdict.
    expect(run.verdict.text).toMatch(/Protect its time: .+\.$/);
  });

  it('names the workers, not the queue, when async jobs pile up', () => {
    const run = runFor(scaled(preset('async-workers'), 3), 6);
    expect(problemAt(run)).toBe(idOf(run.topology, 'Ticket crew'));
    expect(run.verdict.text).toMatch(
      /^Ticket crew is the constraint: all 8 task slots taken, \d+ in progress and \d+ blocked waiting on others, [\d,]+ tasks waiting in Ticket backlog\./,
    );
    // Its slots are full only with held ones counted, so the sentence splits
    // them the way the box does rather than calling all eight busy.
    const s = run.snapshot.nodes[idOf(run.topology, 'Ticket crew')];
    expect(run.verdict.text).toContain(
      `${formatCount(s?.inFlight)} in progress and ${formatCount(s?.waitingOnDownstream)} blocked waiting on others`,
    );
    expect(run.verdict.text).toMatch(
      /Ticket backlog takes in \d+ a week but only \d+ a week get done, so the backlog keeps growing\. Protect its time: /,
    );
  });

  it('blames the database, not the caller giving up on it, in a retry storm', () => {
    const run = runFor(scaled(preset('retry-storm'), 2), 10);
    expect(problemAt(run)).toBe(idOf(run.topology, 'Support engineer'));
    expect(run.verdict.text).toMatch(
      /Account managers is giving up on it, \d+ items a week\./,
    );
  });

  it('says a rate limiter refusing work is doing its job', () => {
    const run = runFor(scaled(preset('rate-limited-api'), 3), 10);
    expect(run.verdict.kind).toBe('on-purpose');
    expect(run.verdict.text).toMatch(
      /^Nothing is full\. Sprint intake limit is turning away \d+ items a week on purpose/,
    );
  });

  it('names an injected fault first, with what it caused', () => {
    const slowed = runFor(preset('single-server'), 8, {
      at: 3,
      label: 'Founder sign-off',
      kind: 'slow',
      opts: { factor: 5 },
    });
    expect(problemAt(slowed)).toBe(idOf(slowed.topology, 'Founder sign-off'));
    expect(slowed.verdict.text).toMatch(
      /^Founder sign-off: you slowed it 5x\. Now it is the constraint: all 2 task slots busy/,
    );

    const crashed = runFor(preset('single-server'), 6, {
      at: 3,
      label: 'Founder sign-off',
      kind: 'crash',
    });
    expect(crashed.verdict.text).toBe(
      'Founder sign-off: you took the whole team out, so nothing sent to it gets done.',
    );
  });

  it('says a team with one person out sick is coping when it is', () => {
    const run = runFor(preset('load-balanced'), 8, {
      at: 3,
      label: 'Pod 1',
      kind: 'crash-instance',
    });
    expect(run.verdict.text).toBe(
      'Pod 1: you sent one of its people home sick, and it is keeping up for now.',
    );
  });

  it('names the busiest part when healthy', () => {
    const run = runFor(preset('single-server'), 10);
    expect(run.verdict.kind).toBe('healthy');
    expect(run.verdict.text).toMatch(
      /^Nothing is piling up right now\. The busiest step is Founder sign-off at \d+%; if work grows, it is the likely constraint\.$/,
    );
  });

  it('has nothing to judge with no traffic', () => {
    const t = preset('single-server');
    const snapshot = new Engine(t, 1).snapshot();
    expect(findBottleneck(t, snapshot).kind).toBe('idle');
  });

  it('never writes an em dash', () => {
    const run = runFor(scaled(preset('async-workers'), 4), 20);
    expect(run.verdict.text).not.toMatch(/—/);
  });
});

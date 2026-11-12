import { describe, expect, it } from 'vitest';
import { isNote } from './annotations';
import { Engine } from './engine';
import { PRESETS } from './presets';
import type { NodeStats, Topology } from './types';

/**
 * Example copy, held to the engine.
 *
 * Each case pins a claim a preset's notes or description makes to what the
 * engine measures, so a retune that makes the copy wrong fails here instead
 * of teaching a reader something false. Claims like these drifted before:
 * a ceiling quoted from arithmetic rather than measured, and dropped work
 * blamed on the wrong team.
 *
 * Bounds are loose on purpose. They separate the true story from the false
 * one, not one decimal from the next.
 */

const FRAME = 1000 / 60;
const SEEDS = [1, 2, 3];

function preset(id: string) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
}

function noteText(id: string, noteId: string): string {
  const note = (preset(id).topology.annotations ?? [])
    .filter(isNote)
    .find((n) => n.id === noteId);
  if (!note) throw new Error(`no note ${noteId} on ${id}`);
  return note.text;
}

interface Run {
  /** Per node, the mean of each numeric field over one-second samples. */
  readonly mean: Record<string, Record<string, number>>;
}

/** Scales every client the way the load slider does, warms up, then samples. */
function measure(
  id: string,
  mult: number,
  seed: number,
  warmS = 15,
  windowS = 20,
): Run {
  const topology: Topology = structuredClone(preset(id).topology);
  for (const n of topology.nodes) {
    if (n.kind === 'client') n.config.rps = Math.round((n.config.rps ?? 0) * mult);
  }
  const engine = new Engine(topology, seed);
  for (let i = 0; i < 60 * warmS; i += 1) engine.advance(FRAME);
  const sums: Record<string, Record<string, number>> = {};
  for (let s = 0; s < windowS; s += 1) {
    for (let i = 0; i < 60; i += 1) engine.advance(FRAME);
    for (const [nodeId, snap] of Object.entries(engine.snapshot().nodes)) {
      const acc = (sums[nodeId] ??= {});
      for (const [field, v] of Object.entries(snap as NodeStats)) {
        if (typeof v === 'number') acc[field] = (acc[field] ?? 0) + v / windowS;
      }
    }
  }
  return { mean: sums };
}

describe('example copy agrees with the engine', () => {
  it('more engineers: the reviewer tops out near 80 a week', () => {
    expect(noteText('load-balanced', 'lb-note-db')).toContain('about 80 a week');
    for (const seed of SEEDS) {
      const db = measure('load-balanced', 4, seed).mean.db;
      expect(db.throughput, `seed ${seed}`).toBeGreaterThan(70);
      expect(db.throughput, `seed ${seed}`).toBeLessThan(95);
    }
  });

  it('series A: at 3x the dropped work comes from the full feature backlog', () => {
    expect(noteText('full-stack', 'fs-note-lesson')).toContain('feature backlog');
    for (const seed of SEEDS) {
      const m = measure('full-stack', 3, seed).mean;
      // The backlog accounts for nearly all of the customers' dropped work,
      // while the account managers run busy and turn almost nothing away.
      expect(m.queue.shedRate, `seed ${seed}`).toBeGreaterThan(0.9 * m.client.shedRate);
      expect(m.shards.shedRate ?? 0, `seed ${seed}`).toBeLessThan(2);
    }
  });

  it('where answers live: the AI assistant fills loudly, the archive quietly', () => {
    expect(noteText('specialised-stores', 'ss-note-lesson')).toContain('AI assistant');
    const m = measure('specialised-stores', 3, 1).mean;
    expect(m.vectors.utilization).toBeGreaterThan(0.95);
    expect(m['recs-api'].shedRate).toBeGreaterThan(5);
    expect(m.glacier.throttledRate).toBeGreaterThan(2);
    expect(m.batch.shedRate ?? 0).toBe(0);
  });

  it('launch fan-out: at 3x legal review drops work and the others keep up', () => {
    const text = noteText('event-driven', 'ed-note-fanout');
    expect(text).toContain('legal review');
    expect(text).toContain('data team');
    for (const seed of SEEDS) {
      const m = measure('event-driven', 3, seed).mean;
      expect(m.audit.shedRate, `seed ${seed}`).toBeGreaterThan(10);
      expect(m.broker.consumerLag, `seed ${seed}`).toBeLessThan(50);
      // The three the note says keep up do keep up.
      for (const id of ['billing', 'push', 'metrics']) {
        expect(m[id].shedRate ?? 0, `${id} seed ${seed}`).toBe(0);
      }
    }
  });

  it('intake limit: at 3x it ships less but a typical task is far faster', () => {
    const text = noteText('rate-limited-api', 'rl-note-trade');
    expect(text).toContain('ships 28 a week');
    expect(text).toContain('34 a week');
    const limited = measure('rate-limited-api', 3, 1).mean;
    expect(limited.api.throughput).toBeGreaterThan(25);
    expect(limited.api.throughput).toBeLessThan(31);
    const open = structuredClone(preset('rate-limited-api').topology);
    const limiter = open.nodes.find((n) => n.id === 'limiter');
    if (!limiter) throw new Error('no limiter');
    limiter.config.rateLimitRps = 10_000;
    limiter.config.burst = 10_000;
    for (const n of open.nodes) if (n.kind === 'client') n.config.rps *= 3;
    const engine = new Engine(open, 1);
    for (let i = 0; i < 60 * 15; i += 1) engine.advance(FRAME);
    engine.startTally();
    for (let i = 0; i < 60 * 20; i += 1) engine.advance(FRAME);
    const tally = engine.readTally();
    const sorted = [...(tally?.latencies ?? [])].sort((a, b) => a - b);
    // Without the limit a typical task waits over a week.
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(1000);
    expect((tally?.completed ?? 0) / 20).toBeGreaterThan(31);
  });

  it('failing agency: after a crash the rule stays open while the agency is down', () => {
    expect(noteText('circuit-breaker', 'cb-note-trip')).toContain(
      'only if they succeed',
    );
    const engine = new Engine(structuredClone(preset('circuit-breaker').topology), 1);
    for (let i = 0; i < 60 * 10; i += 1) engine.advance(FRAME);
    engine.injectFailure('payments', 'crash');
    for (let i = 0; i < 60 * 6; i += 1) engine.advance(FRAME);
    // From here the rule tries a few jobs every three weeks and they fail,
    // so it never reports closed again.
    for (let i = 0; i < 60 * 15; i += 1) {
      engine.advance(FRAME);
      expect(engine.snapshot().nodes.breaker.breakerState).not.toBe('closed');
    }
  });
});

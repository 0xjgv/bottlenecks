import { Engine } from '../sim/engine';
import { nearestRank } from '../sim/judge';
import type { SimSnapshot, Topology } from '../sim/types';
import { findBottleneck, type Verdict } from './bottleneck';

/**
 * "What happens when we grow?"
 *
 * Plays the same org at several multiples of today's incoming work and
 * reports, per multiple, what it delivers, how long the slowest work takes,
 * how much is dropped, and which step is the constraint. Every number is
 * measured from a headless engine run with a fixed seed, never projected
 * from a ceiling, so a queue that only builds under bursts shows up here.
 *
 * One simulated second is one working week, so the counted window is 20
 * weeks after a 5 week warm-up.
 */

/** Growth multiples tried, smallest first. */
export const GROWTH_MULTIPLES: readonly number[] = [1, 1.5, 2, 3, 4];
/** Weeks played before counting starts, so backlogs have formed. */
export const GROWTH_WARMUP_MS = 5000;
/** End of the counted window. */
export const GROWTH_END_MS = 25_000;
/** Simulated ms per engine step; the engine caps a step at 100ms. */
const FRAME_MS = 100;
/** Share of work dropped past which a multiple counts as broken. */
export const BROKEN_DROP_SHARE = 0.02;
/** Growth in the slowest cycle time, against today, that counts as broken. */
export const BROKEN_P99_FACTOR = 2;

export interface GrowthStep {
  multiple: number;
  /** Work arriving, items per week. */
  offeredPerWeek: number;
  /** Work finished, items per week. */
  deliveredPerWeek: number;
  /** Share of arrived work that failed, was dropped or given up on, 0..1. */
  droppedShare: number;
  /** Median cycle time in engine ms, or null when nothing finished. */
  p50Ms: number | null;
  /** Slowest 1 in 100 cycle time in engine ms, or null when nothing finished. */
  p99Ms: number | null;
  /** The busiest step that can fill up, and how busy it was at the end. */
  busiest: { nodeId: string; utilization: number } | null;
  /** The "Find the problem" verdict on the final snapshot. */
  verdict: Verdict;
  broken: boolean;
}

export interface GrowthForecast {
  steps: GrowthStep[];
  /** The first multiple that broke, or null when every one held. */
  breaksAt: number | null;
}

/** The topology with every source's incoming work scaled by `multiple`. */
export function scaled(t: Topology, multiple: number): Topology {
  return {
    ...t,
    nodes: t.nodes.map((n) =>
      n.kind === 'client'
        ? { ...n, config: { ...n.config, rps: n.config.rps * multiple } }
        : n,
    ),
  };
}

/** Rework abandoned so far, summed over every rework queue's shelf. */
function shelved(snapshot: SimSnapshot): number {
  let n = 0;
  for (const s of Object.values(snapshot.nodes)) n += s.deadLetters ?? 0;
  return n;
}

/** Kinds that never do work of their own, so are never the busiest. */
const NOT_WORK = new Set(['client', 'autoscaler', 'region', 'cron', 'pubsub']);

/** Plays one multiple. Yields once per simulated week so a caller can stay responsive. */
export function* playMultiple(
  t: Topology,
  multiple: number,
  seed: number,
): Generator<void, Omit<GrowthStep, 'broken'>> {
  const topology = scaled(t, multiple);
  const engine = new Engine(topology, seed);
  let now = 0;
  let shelvedAtStart = 0;
  while (now < GROWTH_END_MS) {
    if (now === GROWTH_WARMUP_MS) {
      engine.startTally();
      shelvedAtStart = shelved(engine.snapshot());
    }
    engine.advance(FRAME_MS);
    now += FRAME_MS;
    if (now % 1000 === 0) yield;
  }
  const tally = engine.readTally();
  engine.stopTally();
  const snapshot = engine.snapshot();
  const weeks = (GROWTH_END_MS - GROWTH_WARMUP_MS) / 1000;
  const arrived = tally?.arrived ?? 0;
  const sorted = Float64Array.from(tally?.latencies ?? []).sort();
  // Lost work: what the requester saw fail, plus what was promised and then
  // lost behind their back (backlog jobs that failed after a yes, deferred
  // paperwork never filed, and rework abandoned on the dead letter shelf).
  const lost =
    (tally?.failed ?? 0) +
    (tally?.jobsFailed ?? 0) +
    Math.max(0, (tally?.writesAcked ?? 0) - (tally?.writesLanded ?? 0)) +
    Math.max(0, shelved(snapshot) - shelvedAtStart);

  let busiest: GrowthStep['busiest'] = null;
  for (const node of topology.nodes) {
    if (NOT_WORK.has(node.kind)) continue;
    const u = snapshot.nodes[node.id]?.utilization;
    if (u === undefined || !Number.isFinite(u)) continue;
    if (busiest === null || u > busiest.utilization)
      busiest = { nodeId: node.id, utilization: u };
  }

  return {
    multiple,
    offeredPerWeek: arrived / weeks,
    deliveredPerWeek: (tally?.completed ?? 0) / weeks,
    droppedShare: arrived > 0 ? lost / arrived : 0,
    p50Ms: nearestRank(sorted, 0.5),
    p99Ms: nearestRank(sorted, 0.99),
    busiest,
    verdict: findBottleneck(topology, snapshot),
  };
}

/** Plays every multiple. Yields between weeks; returns the forecast. */
export function* playGrowth(
  t: Topology,
  seed: number,
  multiples: readonly number[] = GROWTH_MULTIPLES,
): Generator<number, GrowthForecast> {
  const steps: GrowthStep[] = [];
  let baseP99: number | null = null;
  for (let i = 0; i < multiples.length; i++) {
    const m = multiples[i] ?? 1;
    const run = playMultiple(t, m, seed);
    let r = run.next();
    while (!r.done) {
      yield i / multiples.length;
      r = run.next();
    }
    const step = r.value;
    if (i === 0) baseP99 = step.p99Ms;
    const slower =
      baseP99 !== null &&
      step.p99Ms !== null &&
      step.p99Ms > baseP99 * BROKEN_P99_FACTOR;
    steps.push({ ...step, broken: step.droppedShare > BROKEN_DROP_SHARE || slower });
  }
  return { steps, breaksAt: steps.find((s) => s.broken)?.multiple ?? null };
}

/** Runs the forecast to completion synchronously. */
export function forecastGrowth(
  t: Topology,
  seed: number,
  multiples: readonly number[] = GROWTH_MULTIPLES,
): GrowthForecast {
  const run = playGrowth(t, seed, multiples);
  let r = run.next();
  while (!r.done) r = run.next();
  return r.value;
}

/**
 * The step that limits output at one multiple. "Find the problem" is the
 * authority: when it names a struggling step, or a gate refusing on purpose,
 * that step is the answer, so the two features never disagree. Only when
 * nothing is struggling does the busiest step stand in, as the likely next
 * constraint.
 */
export function constraintOf(
  step: GrowthStep,
): { nodeId: string; how: 'struggling' | 'refusing' | 'busiest' } | null {
  if (step.verdict.kind === 'problem')
    return { nodeId: step.verdict.nodeId, how: 'struggling' };
  if (step.verdict.kind === 'on-purpose')
    return { nodeId: step.verdict.nodeId, how: 'refusing' };
  return step.busiest ? { nodeId: step.busiest.nodeId, how: 'busiest' } : null;
}

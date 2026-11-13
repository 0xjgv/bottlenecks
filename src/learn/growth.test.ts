import { describe, expect, it } from 'vitest';
import { PRESETS } from '../sim/presets';
import type { Topology } from '../sim/types';
import { constraintOf, forecastGrowth, scaled, weeksToReach } from './growth';

function preset(id: string): Topology {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found.topology;
}

describe('growth forecast', () => {
  it('scales only the sources of work', () => {
    const t = preset('single-server');
    const s = scaled(t, 3);
    for (const [i, n] of s.nodes.entries()) {
      const before = t.nodes[i];
      if (!before) throw new Error('node count changed');
      if (n.kind === 'client') expect(n.config.rps).toBe(before.config.rps * 3);
      else expect(n.config).toBe(before.config);
    }
  });

  it('holds at today and breaks once the constraint fills, naming it', () => {
    const f = forecastGrowth(preset('single-server'), 1, [1, 6]);
    const [today, grown] = f.steps;
    if (!today || !grown) throw new Error('missing steps');
    expect(today.broken).toBe(false);
    expect(grown.broken).toBe(true);
    expect(f.breaksAt).toBe(6);
    expect(grown.busiest?.nodeId).toBe('db');
  });

  it('is deterministic for a seed', () => {
    const a = forecastGrowth(preset('single-server'), 7, [2]);
    const b = forecastGrowth(preset('single-server'), 7, [2]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('the forecast names the step whose extra hour becomes output', () => {
  // Each pick was checked by doubling candidates at 3x: only doubling the
  // named step lifted finished work a week.
  it.each([
    ['fintech-compliance', 'kyc'],
    ['specialised-stores', 'vectors'],
    ['series-a-saas', 'qa'],
    ['event-driven', 'ws'],
  ])('%s at 3x: %s', (id, nodeId) => {
    const [step] = forecastGrowth(preset(id), 1, [3]).steps;
    if (!step) throw new Error('no step');
    expect(constraintOf(step)).toEqual({ nodeId, how: 'struggling' });
  });

  it('calls a limiter refusing work a gate, not a constraint', () => {
    const [step] = forecastGrowth(preset('rate-limited-api'), 1, [3]).steps;
    if (!step) throw new Error('no step');
    expect(constraintOf(step)?.how).toBe('refusing');
  });

  it('counts rework abandoned on the shelf as lost work', () => {
    const [step] = forecastGrowth(preset('ai-agency'), 1, [3]).steps;
    if (!step) throw new Error('no step');
    expect(step.droppedShare).toBeGreaterThan(0.2);
    expect(step.broken).toBe(true);
  });
});

describe('weeks until a size, at a weekly growth rate', () => {
  it('is zero for today', () => {
    expect(weeksToReach(1, 0.07)).toBe(0);
  });

  it('compounds: 7% a week doubles in about 10 weeks, 10% in about 7', () => {
    expect(weeksToReach(2, 0.07)).toBeCloseTo(10.24, 2);
    expect(weeksToReach(2, 0.1)).toBeCloseTo(7.27, 2);
    expect(weeksToReach(4, 0.07)).toBeCloseTo(20.49, 2);
  });

  // The yearly multiples in "Startup = Growth": 5% a week is 12.6x a year,
  // 7% is 33.7x, 10% is 142x.
  it.each([
    [0.05, 12.6],
    [0.07, 33.7],
    [0.1, 142],
  ])('%s a week reaches %sx in a year', (rate, yearly) => {
    expect(weeksToReach(yearly, rate)).toBeCloseTo(52, 0);
  });
});

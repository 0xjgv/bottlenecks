import { describe, expect, it } from 'vitest';
import { Engine } from '../sim/engine';
import { PRESETS } from '../sim/presets';
import { edge, node } from '../sim/presetKit';
import type { SimSnapshot, Topology } from '../sim/types';
import { scaled } from './growth';
import { deliveredRps, peopleCount } from './threeMeasures';

function preset(id: string): Topology {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return structuredClone(found.topology);
}

function run(t: Topology, weeks: number): SimSnapshot {
  const e = new Engine(t, 1);
  for (let ms = 0; ms < weeks * 1000; ms += 50) e.advance(50);
  return e.snapshot();
}

describe('Delivered', () => {
  it('is the system goodput when every source counts', () => {
    const t = preset('openai');
    delete t.measures;
    const s = run(t, 10);
    expect(deliveredRps(t, s)).toBe(s.system.goodputRps);
  });

  it('sums the sources to the goodput, so leaving some out is honest', () => {
    for (const id of ['openai', 'nvidia', 'full-stack']) {
      const t = scaled(preset(id), 2);
      const s = run(t, 10);
      let sum = 0;
      for (const n of t.nodes)
        if (n.kind === 'client') sum += s.nodes[n.id]!.throughput;
      expect(sum, id).toBeCloseTo(s.system.goodputRps, 9);
    }
  });

  it('counts only the sources that are output', () => {
    const t = preset('openai');
    expect(t.measures?.notOutput).toEqual(['research', 'product']);
    const s = run(t, 10);
    expect(deliveredRps(t, s)).toBe(s.nodes.customers!.throughput);
    expect(deliveredRps(t, s)).toBeLessThan(s.system.goodputRps);
  });
});

describe('People', () => {
  it('counts the company, not its compute or suppliers', () => {
    // researchers 4 + applied 4 + five teams of 1; Shared compute left out.
    const openai = preset('openai');
    expect(peopleCount(openai, run(openai, 2))).toBe(13);
    // sales 4 + engineering 4 + building ahead 1; the five outside companies left out.
    const nvidia = preset('nvidia');
    expect(peopleCount(nvidia, run(nvidia, 2))).toBe(9);
  });

  it('leaves contractors out and is null with no people at all', () => {
    const t: Topology = {
      nodes: [node('c', 'client', 'c', 0, 0), node('agents', 'lambda', 'agents', 1, 0)],
      edges: [edge('c', 'agents')],
    };
    expect(peopleCount(t, run(t, 1))).toBeNull();
    const all = { ...t, measures: { notPeople: [] } };
    expect(peopleCount(all, run(all, 1))).toBeNull();
  });

  it('reads the live headcount a hiring plan has changed', () => {
    const t = scaled(preset('autoscaling-service'), 3);
    const s = run(t, 30);
    const hired = t.nodes.filter((n) => s.nodes[n.id]?.instances !== undefined);
    const live = hired.reduce((a, n) => a + s.nodes[n.id]!.instances!, 0);
    const designed = hired.reduce((a, n) => a + (n.config.instances ?? 1), 0);
    expect(live).not.toBe(designed);
    expect(peopleCount(t, s)).toBe(live);
  });
});

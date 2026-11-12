import { describe, expect, it } from 'vitest';
import { PRESETS } from '../sim/presets';
import type { Topology } from '../sim/types';
import { forecastGrowth, scaled } from './growth';

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

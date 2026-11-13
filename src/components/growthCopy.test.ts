import { describe, expect, it } from 'vitest';
import type { GrowthForecast, GrowthStep } from '../learn/growth';
import { headline } from './growthCopy';

const step = (multiple: number, broken: boolean): GrowthStep => ({
  multiple,
  offeredPerWeek: 20 * multiple,
  deliveredPerWeek: 20,
  droppedShare: broken ? 0.5 : 0,
  p50Ms: 100,
  p99Ms: 200,
  busiest: { nodeId: 'founder', utilization: 0.9 },
  verdict: broken
    ? { kind: 'problem', nodeId: 'founder', text: '' }
    : { kind: 'healthy', nodeId: 'founder', text: '' },
  broken,
});

const forecast = (...steps: GrowthStep[]): GrowthForecast => ({
  steps,
  breaksAt: steps.find((s) => s.broken)?.multiple ?? null,
});

const nameOf = () => 'Founder sign-off';

describe('the growth headline dates the breaking point', () => {
  it('says how many weeks away the break is at the chosen rate', () => {
    const f = forecast(step(1, false), step(2, true));
    expect(headline(f, nameOf, 0.07)).toBe(
      "Breaks at 2x today's work, about 10 weeks away at 7% a week. Founder sign-off is the constraint.",
    );
    expect(headline(f, nameOf, 0.1)).toContain('about 7 weeks away at 10% a week');
  });

  it('says how long the design holds when nothing breaks', () => {
    const f = forecast(step(1, false), step(4, false));
    expect(headline(f, nameOf, 0.07)).toBe(
      "Holds at 4x today's work, at least 20 weeks of growth at 7% a week. Founder sign-off is the likely next constraint.",
    );
    // 4x at 10% a week is 14.5 weeks away: "at least" rounds down.
    expect(headline(f, nameOf, 0.1)).toContain(
      'at least 14 weeks of growth at 10% a week',
    );
  });

  it('puts no date on a design that is already over capacity', () => {
    const f = forecast(step(1, true));
    expect(headline(f, nameOf, 0.07)).toBe(
      'Already over capacity at today’s work. Founder sign-off is the constraint.',
    );
  });
});

import { constraintOf, weeksToReach, type GrowthForecast } from '../learn/growth';
import { formatPct } from './format';

/**
 * The words the growth forecast puts on its numbers. Kept out of the panel
 * so the sentences can be pinned by a test without rendering it.
 */

/** Whole weeks until `multiple`, rounded to the nearest. */
export const weeksAway = (multiple: number, rate: number): number =>
  Math.round(weeksToReach(multiple, rate));

export function headline(
  f: GrowthForecast,
  nameOf: (id: string) => string,
  rate: number,
): string {
  const broke = f.steps.find((s) => s.broken);
  const last = f.steps[f.steps.length - 1];
  const pace = `${formatPct(rate)} a week`;
  if (!broke) {
    const next = last ? constraintOf(last) : null;
    const tail = next ? ` ${nameOf(next.nodeId)} is the likely next constraint.` : '';
    const top = last?.multiple ?? 1;
    // Floored, not rounded: "at least" must never promise a week it has not got.
    return `Holds at ${top}x today's work, at least ${Math.floor(weeksToReach(top, rate))} weeks of growth at ${pace}.${tail}`;
  }
  const at =
    broke.multiple === 1
      ? 'Already over capacity at today\u2019s work.'
      : `Breaks at ${broke.multiple}x today's work, about ${weeksAway(broke.multiple, rate)} weeks away at ${pace}.`;
  const c = constraintOf(broke);
  if (!c) return at;
  if (c.how === 'refusing')
    return `${at} ${nameOf(c.nodeId)} turns work away by design.`;
  return `${at} ${nameOf(c.nodeId)} is the constraint.`;
}

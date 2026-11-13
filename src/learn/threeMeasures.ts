import { PEOPLE_KINDS } from '../sim/measures';
import type { SimSnapshot, Topology } from '../sim/types';

/**
 * Delivered and People, two of The Goal's three measures (the third,
 * unfinished work, is in unfinished.ts). Both honour the design's
 * `measures`: the sources of work that are internal, and the steps that are
 * not people.
 */

/**
 * Work delivered a week. With no source marked as internal it is the
 * system's own goodput, exactly as before. Otherwise it is the sum over the
 * sources that count of each source's finished rate: a source's `throughput`
 * is booked on the same event as the system's goodput (an item finished and
 * still wanted), so over every source the two agree to the last bit.
 */
export function deliveredRps(topology: Topology, snapshot: SimSnapshot): number {
  const internal = new Set(topology.measures?.notOutput ?? []);
  if (!topology.nodes.some((n) => n.kind === 'client' && internal.has(n.id))) {
    return snapshot.system.goodputRps;
  }
  let sum = 0;
  for (const n of topology.nodes) {
    if (n.kind !== 'client' || internal.has(n.id)) continue;
    sum += snapshot.nodes[n.id]?.throughput ?? 0;
  }
  return sum;
}

/**
 * The people the design pays for: headcount summed over the steps whose
 * inspector calls their count "People", less those marked not people. The
 * live count where the snapshot has one (a hiring plan moves it), else the
 * design's. Null when no step is people, so nothing is shown for it.
 * Contractors (lambda) are not a people kind and are never counted.
 */
export function peopleCount(topology: Topology, snapshot: SimSnapshot): number | null {
  const notPeople = new Set(topology.measures?.notPeople ?? []);
  let total = 0;
  let any = false;
  for (const n of topology.nodes) {
    if (!PEOPLE_KINDS.has(n.kind) || notPeople.has(n.id)) continue;
    any = true;
    const live = snapshot.nodes[n.id]?.instances;
    total += Math.max(1, Math.floor(live ?? n.config.instances ?? 1));
  }
  return any ? total : null;
}

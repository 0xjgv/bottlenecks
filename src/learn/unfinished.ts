import type { NodeStats, SimNode, SimSnapshot, Topology } from '../sim/types';

/**
 * Unfinished work: the tasks in the company right now that are waiting in a
 * backlog or being worked on. The Goal calls it inventory, the second of its
 * three measures beside throughput and operating expense.
 *
 * The count is the sum, over every step, of the tasks waiting there and the
 * tasks someone there is working on. A person who has finished their part and
 * holds the item while a later step works on it (`waitingOnDownstream`) is not
 * counted, because the later step counts it. So an item walking down a chain
 * is one task wherever it is.
 *
 * It counts TASKS, not items, and says so on screen. Where one item becomes
 * work for several steps at once (a source or team wired to several steps, an
 * announcement, a production studio's renditions) each of those is a task
 * somebody holds, and each is effort spent that no customer has yet, so each
 * counts. Work still being done after the requester gave up counts too: the
 * engine keeps doing it, so it is real work in the system.
 *
 * Every step kind, and why `queued + inFlight` is or is not its count:
 *
 *   kind                       reads as
 *   -------------------------  ------------------------------------------------
 *   service, worker            queued + inFlight. Blocking kinds: a slot held
 *                              while waiting on a later step is outside inFlight.
 *   lambda                     queued + inFlight. Its inFlight is running minus
 *                              waiting on a later step, the same split.
 *   lb, cache, cdn, apigateway queued + inFlight. They free the slot when their
 *   sidecar, edgecompute       own work ends, so the item is only ever counted
 *                              at the step it moved on to.
 *   queue                      queued + inFlight. Its queued is the accepted
 *                              jobs waiting in the backlog for a crew.
 *   retryqueue, writebehind    queued + inFlight: messages waiting or out for
 *                              delivery, which for deferred paperwork is every
 *                              promise not yet written down. A rework queue's
 *                              shelf (dead letters) is given up, so not counted.
 *   transcoder                 queued + inFlight. Its renditions are tasks at the
 *                              steps they are sent to.
 *   db, replica, shard,        queued + inFlight, which these kinds rewrite from
 *   objectstore, searchindex,  their own pools; both are this step's own work.
 *   timeseriesdb, graphdb,
 *   vectordb, coldstorage
 *   region, ratelimiter,       queued + inFlight: a gate holds an item only for
 *   breaker, loadshedder,      its own handling time, usually none.
 *   pubsub
 *   client, cron, autoscaler   queued + inFlight, always 0: a source hands its
 *                              work on and a controller holds none.
 *   bulkhead                   bulkheadWaiting. Its inFlight is the pool of calls
 *                              out at the step behind it, which that step counts.
 *                              Unreadable if it has its own handling time.
 *   websocket                  Unreadable. Its inFlight is seats held, which
 *                              outlast the work, and the handshakes in progress
 *                              are in no field.
 *   streambroker               Unreadable. Its queued is the slowest group's
 *                              lag, its inFlight is deliveries the readers also
 *                              count, and posts mid-publish are in no field.
 *
 * Two kinds of wiring hide work from every snapshot, so a design with either
 * reads as unreadable too:
 *   - a step that retries (`retries` above 0, with somewhere to call): an item
 *     waiting out the delay before its next try is at no step;
 *   - a connection that takes time to cross (`latencyMs` above 0): an item on
 *     the way is at no step.
 *
 * Unreadable means `null`, and the interface then shows no number at all. The
 * decision depends on the design alone, never on the moment, so the readout
 * does not appear and vanish while a run plays.
 */

/** The tasks one step holds, or null when its snapshot cannot say. */
function tasksAt(node: SimNode, stats: NodeStats): number | null {
  switch (node.kind) {
    case 'websocket':
    case 'streambroker':
      return null;
    case 'bulkhead':
      return node.config.serviceMs > 0 ? null : (stats.bulkheadWaiting ?? 0);
    default:
      return stats.queued + stats.inFlight;
  }
}

/** Does this design keep work somewhere no snapshot field reaches? */
function hidesWork(topology: Topology): boolean {
  if (topology.edges.some((e) => (e.latencyMs ?? 0) > 0)) return true;
  return topology.nodes.some(
    (n) =>
      Math.floor(n.config.retries ?? 0) > 0 &&
      topology.edges.some((e) => e.from === n.id && !e.control),
  );
}

/**
 * Tasks waiting or being worked on across the whole design, or null when the
 * design holds work this count cannot see. A step with no stats yet (added
 * since the last snapshot) holds nothing, so it adds nothing.
 */
export function unfinishedWork(
  topology: Topology,
  snapshot: SimSnapshot,
): number | null {
  if (hidesWork(topology)) return null;
  let total = 0;
  for (const node of topology.nodes) {
    const stats = snapshot.nodes[node.id];
    if (!stats) continue;
    const n = tasksAt(node, stats);
    if (n === null) return null;
    total += n;
  }
  return total;
}

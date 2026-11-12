import type { NodeKind } from '../sim/types';

/**
 * Kinds this applies to: exactly the ones with a throughput ceiling (see
 * `HAS_THROUGHPUT_CEILING` in ../components/Inspector.tsx) -- headroom is only ever a
 * defined concept for these, so a suggestion is only ever offered for these.
 *
 * One suggestion per kind, not several with tradeoffs. Per the issue
 * discussion: a suggestion that sounds reasonable and makes things worse is
 * worse than saying nothing, so this deliberately does not offer "make the
 * database bigger" for a db -- that specific advice is a trap in at least one
 * of the app's own challenges. Where a kind has no single fix that is
 * obviously right, the suggestion points at the knob that is honestly the
 * most likely lever rather than pretending certainty.
 */
export function suggestionFor(kind: NodeKind): string | null {
  switch (kind) {
    case 'cache':
      // Deliberately NOT "raise the hit rate". The hit/miss roll happens in
      // onServiceComplete (behaviour.ts), so a hit and a miss occupy a slot
      // for the same serviceMs: hit rate changes what this node FORWARDS,
      // never what arrives at it. When the cache itself is over its ceiling,
      // raising hit rate moves nothing here -- it relieves what is behind it.
      return 'Add people to keep the playbook, or let each take more at once. Hit rate will not help here, because an ask the playbook answers and one it passes on take the same time to check. Hit rate changes what it passes on, not what it has to get through.';
    case 'db':
      // Deliberately not "add capacity" -- bigger databases do not always
      // help, and a wrong-sounding suggestion is worse than none. Point at
      // reducing what reaches it instead.
      return 'A decision maker rarely gets faster by adding helpers, because the decisions still conflict and queue. Look at what is reaching it instead. A playbook in front that answers more asks, or fewer people chasing the same ask twice, will do more than adding headcount here.';
    case 'lb':
      // A load balancer being the bottleneck is unusual; its own limit is
      // rarely the real story.
      return 'A dispatcher running full is uncommon. Check the teams it hands work to are not the real constraint before adding people here.';
    case 'sidecar':
      // Every hop through a sidecar pays its tax; retries multiply it.
      return 'Every item pays this step a tax. Check how often people chase and how long they wait before adding people; a wave of chasing here costs more than the work itself.';
    case 'apigateway':
      return 'The front desk only checks and routes, so add people to spread the asks across more of them.';
    case 'worker':
      return 'The crew pulls from the backlog at its own pace. Add people to clear it faster.';
    case 'service':
    case 'objectstore':
    case 'coldstorage':
    case 'retryqueue':
    case 'transcoder':
    case 'edgecompute':
      // The remaining ceiling kinds run the same slot discipline with no
      // sharper lever than the obvious one: more parallel slots, or less
      // time per request.
      return 'Protect its time: take work off it that someone else can do, cut the hands-on time per task, or add people.';
    default:
      return null;
  }
}

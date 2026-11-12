import type { NodeKind } from '../sim/types';

/**
 * Which glossary entry explains each word printed on a node's box.
 *
 * The box is SVG text, so a <Term> cannot sit on it, and the canvas pointer
 * layer is not the place to grow a second hover system. The inspector shows
 * the same words under its meter instead, each explained from the glossary.
 *
 * Keyed by the exact label `readoutFor` returns. Most words mean the same
 * thing on every kind; the few that do not ("refused" is an intake limit's
 * throttling but a stop-the-line rule's open circuit) are resolved per kind
 * first. A label with no entry here is plain enough to need none ("in", "out").
 */
const BY_LABEL: Readonly<Record<string, string>> = {
  busy: 'utilisation',
  p99: 'p99',
  waiting: 'backlog',
  served: 'throughput',
  done: 'throughput',
  sent: 'offered',
  ok: 'goodput',
  failing: 'error-rate',
  covered: 'hit-rate',
  stale: 'stale-read',
  conflict: 'lock-contention',
  escalated: 'origin-fetch',
  room: 'tokens',
  line: 'breaker',
  stops: 'breaker',
  fails: 'error-rate',
  reports: 'range-query',
  unread: 'consumer-lag',
  lost: 'retention',
  'fan-out': 'fan-out',
  'in room': 'connection-slot',
  seats: 'connection-slot',
  partner: 'outlier-ejection',
  reserved: 'bulkhead',
  'given up': 'dead-letter',
  redo: 'redelivery',
  fixed: 'edge-share',
  'at risk': 'dirty-write',
  watching: 'utilisation',
  people: 'instances',
  'on duty': 'region',
  handover: 'region',
  available: 'region',
  'back in': 'region',
  'per job': 'service-time',
  'shed low': 'deprioritized',
  'shed high': 'deprioritized',
  limited: 'throttled',
  denied: 'unauthorized',
};

const BY_KIND: Partial<Record<NodeKind, Readonly<Record<string, string>>>> = {
  shard: { hot: 'hot-key', cold: 'shard' },
  lambda: { ramping: 'cold-start', ready: 'cold-start', refused: 'throttled' },
  searchindex: { stale: 'stale-search' },
  graphdb: { 'per ask': 'traversal-depth' },
  vectordb: { 'per ask': 'recall' },
  ratelimiter: { refused: 'throttled' },
  breaker: { refused: 'rejected' },
  websocket: { refused: 'conn-refused' },
  bulkhead: { refused: 'bulkhead-full' },
  sidecar: { refused: 'outlier-ejection' },
  objectstore: { refused: 'prefix-ceiling' },
  coldstorage: { 'dig out': 'coldstorage', refused: 'throttled' },
};

/** Glossary id for a word on a node's box, or undefined when it needs none. */
export function readoutTermFor(kind: NodeKind, label: string): string | undefined {
  return BY_KIND[kind]?.[label] ?? BY_LABEL[label];
}

/** Every id this module can return, for the wiring test. */
export function allReadoutTermIds(): string[] {
  const ids = new Set(Object.values(BY_LABEL));
  for (const m of Object.values(BY_KIND))
    for (const id of Object.values(m)) ids.add(id);
  return [...ids];
}

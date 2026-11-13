import type { NodeKind, SimNode, Topology } from './types';

/* ------------------------------------------------------------------ *
 * What the measures count.
 *
 * Documentation for the readouts only: the engine never reads it, the way it
 * never reads annotations. A design stores only its exceptions, so one that
 * never set either list carries no field at all and every link, file and
 * saved copy of it is byte for byte what it was before the field existed.
 * ------------------------------------------------------------------ */

export interface Measures {
  /** Sources of work whose finished items do NOT count as delivered output (internal work). */
  notOutput?: string[];
  /** Steps whose headcount does NOT count as people (compute, suppliers, an outside body). */
  notPeople?: string[];
}

/** Which of the two lists a flag lives in. */
export type MeasureList = keyof Measures;

/**
 * The kinds whose headcount is people: exactly the kinds whose inspector
 * shows a "People" field (FIELDS_BY_KIND carries 'instances'). A test holds
 * the two together, so the People total and the inspector cannot disagree.
 * Contractors (lambda) scale on demand and are not headcount.
 */
export const PEOPLE_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
  'apigateway',
  'cache',
  'cdn',
  'db',
  'edgecompute',
  'graphdb',
  'lb',
  'retryqueue',
  'searchindex',
  'service',
  'sidecar',
  'timeseriesdb',
  'transcoder',
  'vectordb',
  'websocket',
  'worker',
]);

/** The kind each list may name: a source of work, or a step with people. */
const ALLOWED: Record<MeasureList, (kind: NodeKind) => boolean> = {
  notOutput: (kind) => kind === 'client',
  notPeople: (kind) => PEOPLE_KINDS.has(kind),
};

/**
 * One list, kept to ids of this design's nodes of the right kind, without
 * repeats, in the design's node order so the same flags always write the
 * same bytes. Anything else in the input is dropped, not rejected.
 */
function cleanList(
  raw: unknown,
  nodes: readonly SimNode[],
  list: MeasureList,
): string[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter((v): v is string => typeof v === 'string'));
  return nodes
    .filter((n) => wanted.has(n.id) && ALLOWED[list](n.kind))
    .map((n) => n.id);
}

/** The measures a design may carry, or undefined when there are no exceptions. */
export function sanitizeMeasures(
  raw: unknown,
  nodes: readonly SimNode[],
): Measures | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const notOutput = cleanList(r.notOutput, nodes, 'notOutput');
  const notPeople = cleanList(r.notPeople, nodes, 'notPeople');
  if (notOutput.length === 0 && notPeople.length === 0) return undefined;
  return {
    ...(notOutput.length > 0 ? { notOutput } : {}),
    ...(notPeople.length > 0 ? { notPeople } : {}),
  };
}

function listsEqual(a: readonly string[] = [], b: readonly string[] = []): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** `t` with `m` as its measures, or without the field when `m` is undefined. */
function withMeasures(t: Topology, m: Measures | undefined): Topology {
  const { measures: _old, ...rest } = t;
  return m ? { ...rest, measures: m } : rest;
}

/**
 * The design with its measures re-checked against its own nodes: a deleted
 * node's id leaves the lists, so a later node minted with the same id cannot
 * inherit its flag. The same object comes back when nothing changed.
 */
export function cleanMeasures(t: Topology): Topology {
  const m = sanitizeMeasures(t.measures, t.nodes);
  if (
    listsEqual(m?.notOutput, t.measures?.notOutput) &&
    listsEqual(m?.notPeople, t.measures?.notPeople) &&
    (m !== undefined) === (t.measures !== undefined)
  ) {
    return t;
  }
  return withMeasures(t, m);
}

/** Is this node counted: a source as output, a step as people? */
export function counts(t: Topology, list: MeasureList, id: string): boolean {
  return !(t.measures?.[list] ?? []).includes(id);
}

/** Count a node again (`counted`), or leave it out of its measure. */
export function setCounted(
  t: Topology,
  list: MeasureList,
  id: string,
  counted: boolean,
): Topology {
  const now = t.measures?.[list] ?? [];
  const next = counted ? now.filter((x) => x !== id) : [...now, id];
  return withMeasures(t, sanitizeMeasures({ ...t.measures, [list]: next }, t.nodes));
}

/**
 * Copies made inside one design (duplicate, alt-drag) keep their source's
 * flags: a copy of the shared compute is still not people. `pairs` maps each
 * source id to its copy's id; the copies must already be in `t`.
 */
export function carryMeasures(
  t: Topology,
  pairs: readonly (readonly [string, string])[],
): Topology {
  if (!t.measures) return t;
  const extend = (list: readonly string[] = []) => {
    const flagged = new Set(list);
    return [
      ...list,
      ...pairs.filter(([from]) => flagged.has(from)).map(([, to]) => to),
    ];
  };
  return withMeasures(
    t,
    sanitizeMeasures(
      {
        notOutput: extend(t.measures.notOutput),
        notPeople: extend(t.measures.notPeople),
      },
      t.nodes,
    ),
  );
}

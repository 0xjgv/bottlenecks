import { describe, expect, it } from 'vitest';
import {
  PEOPLE_KINDS,
  carryMeasures,
  cleanMeasures,
  counts,
  sanitizeMeasures,
  setCounted,
} from './measures';
import { edge, node } from './presetKit';
import type { NodeKind, Topology } from './types';

function design(): Topology {
  return {
    nodes: [
      node('ask', 'client', 'Customers', 0, 0),
      node('road', 'client', 'Road map', 0, 1),
      node('team', 'service', 'Team', 1, 0),
      node('gpu', 'service', 'Compute', 2, 0),
      node('agents', 'lambda', 'Contractors', 2, 1),
    ],
    edges: [edge('ask', 'team'), edge('road', 'team'), edge('team', 'gpu')],
  };
}

describe('sanitizeMeasures', () => {
  const { nodes } = design();

  it('keeps ids of the right kind, once each, in node order', () => {
    expect(
      sanitizeMeasures(
        { notOutput: ['road', 'road', 'team'], notPeople: ['gpu', 'team', 'gpu'] },
        nodes,
      ),
    ).toEqual({ notOutput: ['road'], notPeople: ['team', 'gpu'] });
  });

  it('drops ids the design does not hold and kinds with no people', () => {
    expect(
      sanitizeMeasures(
        { notOutput: ['gone', 'gpu'], notPeople: ['agents', 'ask', 7] },
        nodes,
      ),
    ).toBeUndefined();
  });

  it('is undefined for anything that is not a measures object', () => {
    for (const raw of [undefined, null, 3, 'x', [], { notOutput: 'road' }, {}]) {
      expect(sanitizeMeasures(raw, nodes)).toBeUndefined();
    }
  });
});

describe('editing what counts', () => {
  it('stores only the exception, and dropping it removes the field', () => {
    const t = design();
    const off = setCounted(t, 'notPeople', 'gpu', false);
    expect(off.measures).toEqual({ notPeople: ['gpu'] });
    expect(counts(off, 'notPeople', 'gpu')).toBe(false);
    const on = setCounted(off, 'notPeople', 'gpu', true);
    expect('measures' in on).toBe(false);
    expect(counts(on, 'notPeople', 'gpu')).toBe(true);
  });

  it('forgets a deleted node, so an id minted again later starts counted', () => {
    const t = setCounted(design(), 'notPeople', 'gpu', false);
    const deleted = cleanMeasures({
      ...t,
      nodes: t.nodes.filter((n) => n.id !== 'gpu'),
    });
    expect('measures' in deleted).toBe(false);
    // Nothing to clean: the very same object comes back.
    expect(cleanMeasures(t)).toBe(t);
  });

  it('carries a flag to a copy made in the same design', () => {
    const t = setCounted(design(), 'notPeople', 'gpu', false);
    const copy = { ...node('gpu-2', 'service', 'Compute', 3, 0) };
    const both = carryMeasures({ ...t, nodes: [...t.nodes, copy] }, [
      ['gpu', 'gpu-2'],
      ['team', 'team-2'],
    ]);
    expect(both.measures).toEqual({ notPeople: ['gpu', 'gpu-2'] });
  });
});

/**
 * The People total must count exactly the steps whose inspector calls their
 * count "People", so the two can never disagree. The inspector's field table
 * is read from its source, as the glossary wiring test reads it.
 */
const SOURCES = import.meta.glob('../components/Inspector.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

describe('PEOPLE_KINDS', () => {
  it('is exactly the kinds whose inspector shows a People field', () => {
    const src = Object.values(SOURCES)[0] ?? '';
    const table = /const FIELDS_BY_KIND[^=]*= \{([\s\S]*?)\n\};/.exec(src)?.[1] ?? '';
    const withoutComments = table.replace(/\/\/.*$/gm, '');
    const showsPeople = new Set<NodeKind>();
    let kinds = 0;
    for (const m of withoutComments.matchAll(/([a-z]+): \[([^\]]*)\]/g)) {
      kinds += 1;
      if (m[2]!.includes("'instances'")) showsPeople.add(m[1] as NodeKind);
    }
    expect(kinds).toBe(33);
    expect([...showsPeople].sort()).toEqual([...PEOPLE_KINDS].sort());
  });
});

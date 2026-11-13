import { describe, expect, it } from 'vitest';
import { isNote, isSection } from './annotations';
import { NODE_H, NODE_W } from './presetKit';
import { COMPANY_PRESETS } from './presets.companies';
import { PRESETS } from './presets';
import { PEOPLE_KINDS } from './measures';
import { constraintOf, forecastGrowth } from '../learn/growth';

/**
 * Real companies, held to the rule in presets.companies.ts: the shape is
 * sourced, the numbers are the model's and say so, and the step that breaks
 * first is the one the company's own sources name.
 */

const SEEDS = [1, 2, 3];

it('lists every company among the examples', () => {
  const ids = new Set(PRESETS.map((p) => p.id));
  expect(COMPANY_PRESETS.length).toBeGreaterThanOrEqual(10);
  for (const p of COMPANY_PRESETS) expect(ids.has(p.id), p.id).toBe(true);
});

describe.each(COMPANY_PRESETS.map((p) => [p.id, p] as const))(
  'company %s',
  (_id, p) => {
    const notes = (p.topology.annotations ?? []).filter(isNote);

    it('links its public sources, each once', () => {
      expect(p.sources.length).toBeGreaterThan(0);
      for (const s of p.sources) {
        expect(s.url, s.title).toMatch(/^https:\/\//);
        expect(s.title.trim()).not.toBe('');
      }
      expect(new Set(p.sources.map((s) => s.url)).size).toBe(p.sources.length);
    });

    it('says once on the canvas that every number is the model', () => {
      const said = notes.filter((n) =>
        /Every number here is the model's, not [^.]+'s\./.test(n.text),
      );
      expect(said).toHaveLength(1);
    });

    /* A note is often out of view, so an unsourced step has to say so where
     it is drawn: inside a section labelled as typical. */
    it('draws every typical step inside a section that says so', () => {
      const steps = p.topology.nodes.filter((n) => n.kind !== 'client');
      const sections = (p.topology.annotations ?? []).filter(isSection);
      const marked = sections.filter((s) => s.label.endsWith('(typical, not sourced)'));
      const inside = (n: { x: number; y: number }, s: (typeof sections)[number]) =>
        n.x >= s.x &&
        n.y >= s.y &&
        n.x + NODE_W <= s.x + s.width &&
        n.y + NODE_H <= s.y + s.height;
      for (const n of steps) {
        const typical = p.typical.includes(n.id);
        expect(
          marked.some((s) => inside(n, s)),
          `${n.id} is ${typical ? 'typical' : 'sourced'}`,
        ).toBe(typical);
      }
      for (const id of p.typical)
        expect(
          steps.some((n) => n.id === id),
          id,
        ).toBe(true);
      expect(p.typical).not.toContain(p.constraint);
      expect(p.typical.length).toBeLessThanOrEqual(steps.length - p.typical.length);
    });

    /* Roles outlast the people in them. A denylist is a tripwire, not proof:
     it holds the convention for the names most likely to slip in. */
    it('names roles, not people', () => {
      const copy = [
        p.name,
        p.tagline,
        p.description,
        ...p.sources.map((s) => s.title),
        ...p.topology.nodes.map((n) => n.label),
        ...notes.map((n) => n.text),
      ].join(' ');
      expect(copy).not.toMatch(
        /\b(Altman|Brockman|Amodei|Musk|Huang|Jassy|Bezos|Cook|Collison|Ek|Chesky)\b/,
      );
    });

    it('names only its own sources and people in its measures, and keeps an output', () => {
      const kinds = new Map(p.topology.nodes.map((n) => [n.id, n.kind]));
      const m = p.topology.measures;
      for (const id of m?.notOutput ?? []) expect(kinds.get(id), id).toBe('client');
      for (const id of m?.notPeople ?? []) {
        expect(PEOPLE_KINDS.has(kinds.get(id) ?? 'client'), id).toBe(true);
      }
      const internal = new Set(m?.notOutput ?? []);
      const output = p.topology.nodes.filter(
        (n) => n.kind === 'client' && !internal.has(n.id),
      );
      expect(output.length).toBeGreaterThan(0);
    });

    it.each(SEEDS)(
      'holds today and breaks by 4x at its named constraint, seed %i',
      (seed) => {
        const f = forecastGrowth(p.topology, seed);
        expect(f.steps[0]!.broken, 'broken at 1x').toBe(false);
        expect(f.breaksAt, 'never breaks').not.toBeNull();
        expect(f.breaksAt!).toBeGreaterThanOrEqual(2);
        const broke = f.steps.find((s) => s.multiple === f.breaksAt)!;
        expect(constraintOf(broke)?.nodeId, `at ${f.breaksAt}x`).toBe(p.constraint);
      },
    );
  },
);

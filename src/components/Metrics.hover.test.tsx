// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Metrics } from './Metrics';
import { Engine } from '../sim/engine';
import { PRESETS } from '../sim/presets';
import { formatCompact, formatMs, formatPct } from './format';
import type { HistoryPoint, SimSnapshot } from '../sim/types';

/**
 * Reading a sample off a chart. Whatever the legend shows while a chart is
 * read must be that one sample's measured values, never a blend of two.
 */

class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number; pointerType?: string } = {},
  ) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = true;
  }
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  vi.stubGlobal('PointerEvent', FakePointerEvent);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** A run with something to read: a single server pushed past its ceiling. */
function overloaded(steps = 200): SimSnapshot {
  const topo = structuredClone(PRESETS.find((p) => p.id === 'single-server')!.topology);
  for (const n of topo.nodes)
    if (n.kind === 'client') n.config = { ...n.config, rps: 400 };
  const engine = new Engine(topo);
  for (let i = 0; i < steps; i++) engine.advance(50);
  return engine.snapshot();
}

const chart = (label: string) =>
  container.querySelector<HTMLElement>(`section[aria-label^="${label}"]`)!;
const plot = (label: string) => chart(label).querySelector<HTMLElement>('.mx-plot')!;
const legend = (label: string) =>
  [...chart(label).querySelectorAll('.mx-key-value')].map((v) => v.textContent);
const stamp = (label: string) =>
  chart(label).querySelector('.mx-hover-at')?.textContent;

const value = (label: string) =>
  chart(label).querySelector('.mx-hover-val')?.textContent?.trim();

/** The sample the readout names, found by its time. */
function sampleNamed(history: readonly HistoryPoint[], label: string): HistoryPoint {
  const at = stamp(label);
  const s = Number(/at week ([\d.]+)/.exec(at ?? '')?.[1]);
  const found = history.find((p) => Math.round(p.t / 10) / 100 === s);
  if (!found) throw new Error(`no sample ${at}`);
  return found;
}

function pointer(el: Element, type: string, clientX: number, pointerType = 'mouse') {
  act(() => {
    el.dispatchEvent(
      new FakePointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY: 50,
        pointerType,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  });
}

function key(el: HTMLElement, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  });
}

describe('reading a chart', () => {
  it('a mouse over the plot reads the sample under it, and leaving restores live', () => {
    const snap = overloaded();
    const history = snap.history.slice();
    act(() => root.render(<Metrics snapshot={snap} />));
    const live = legend('Cycle time');
    expect(stamp('Cycle time')).toBeUndefined();

    pointer(plot('Cycle time'), 'pointermove', 280);
    const s = sampleNamed(history, 'Cycle time');
    expect(legend('Cycle time')).toEqual([
      formatMs(s.p50),
      formatMs(s.p95),
      formatMs(s.p99),
    ]);
    expect(chart('Cycle time').querySelectorAll('.mx-dot')).toHaveLength(3);
    // The headline figure sits beside the time, in view even when the legend
    // is below the strip's fold.
    expect(value('Cycle time')).toBe(`p99 ${formatMs(s.p99)}`);

    pointer(plot('Work finished'), 'pointermove', 280);
    const t = sampleNamed(history, 'Work finished');
    expect(legend('Work finished')).toEqual([
      formatCompact(t.offered),
      formatCompact(t.goodput),
      formatPct(t.errorRate),
    ]);
    expect(value('Work finished')).toBe(`${formatCompact(t.goodput)}/wk finished`);

    act(() => {
      plot('Cycle time').dispatchEvent(
        new FakePointerEvent('pointerout', {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
    });
    expect(stamp('Cycle time')).toBeUndefined();
    expect(legend('Cycle time')).toEqual(live);
  });

  it('a finger reads while it presses, keeps the sample when lifted, and a tap away clears it', () => {
    const snap = overloaded();
    act(() => root.render(<Metrics snapshot={snap} />));
    const el = plot('Cycle time');

    // A finger that is not down is not there.
    pointer(el, 'pointermove', 280, 'touch');
    expect(stamp('Cycle time')).toBeUndefined();

    pointer(el, 'pointerdown', 270, 'touch');
    const first = stamp('Cycle time');
    expect(first).toMatch(/^at /);
    pointer(el, 'pointermove', 300, 'touch');
    const moved = stamp('Cycle time');
    expect(moved).not.toBe(first);
    pointer(el, 'pointerup', 300, 'touch');
    expect(stamp('Cycle time')).toBe(moved);

    pointer(document.body, 'pointerdown', 10, 'touch');
    expect(stamp('Cycle time')).toBeUndefined();
  });

  it('a scroll that takes the touch is not a reading', () => {
    const snap = overloaded();
    act(() => root.render(<Metrics snapshot={snap} />));
    const el = plot('Cycle time');
    pointer(el, 'pointerdown', 270, 'touch');
    expect(stamp('Cycle time')).toMatch(/^at /);
    pointer(el, 'pointercancel', 270, 'touch');
    expect(stamp('Cycle time')).toBeUndefined();
  });

  it('the arrow keys step through samples and say each one', () => {
    const snap = overloaded();
    const history = snap.history.slice();
    act(() => root.render(<Metrics snapshot={snap} />));
    const el = plot('Cycle time');
    act(() => el.focus());
    key(el, 'ArrowLeft');
    const last = history[history.length - 1]!;
    expect(sampleNamed(history, 'Cycle time')).toBe(last);
    key(el, 'ArrowLeft');
    const prev = history[history.length - 2]!;
    expect(sampleNamed(history, 'Cycle time')).toBe(prev);
    const said = chart('Cycle time').querySelector('[aria-live]')?.textContent;
    expect(said).toBe(
      `at week ${prev.t / 1000}: p50 ${formatMs(prev.p50)}, p95 ${formatMs(prev.p95)}, p99 ${formatMs(prev.p99)}`,
    );
    key(el, 'Escape');
    expect(stamp('Cycle time')).toBeUndefined();
    expect(chart('Cycle time').querySelector('[aria-live]')?.textContent).toBe('');
  });

  it('a failure second with nothing failing says so', () => {
    const topo = structuredClone(
      PRESETS.find((p) => p.id === 'single-server')!.topology,
    );
    const engine = new Engine(topo);
    // Healthy at its default load: every sampled second is clean.
    for (let i = 0; i < 100; i++) {
      engine.advance(50);
      act(() => root.render(<Metrics snapshot={engine.snapshot()} />));
    }
    const el = plot('Failed work');
    act(() => el.focus());
    key(el, 'End');
    expect(chart('Failed work').querySelector('.mx-clean')?.textContent).toMatch(
      /^Nothing was failing at week [\d.]+\.$/,
    );
  });
});

describe('the time axis', () => {
  it('is labelled in run time, the clock the readout uses', () => {
    const labels = () =>
      [...chart('Cycle time').querySelectorAll('.mx-xlabel')].map((t) => t.textContent);
    // Thirty seconds in, the window starts before the run did, and "0s"
    // marks where the run began.
    act(() => root.render(<Metrics snapshot={overloaded(600)} />));
    expect(labels()).toEqual(['0wk', 'now']);
    // Past a minute, the left edge names its own run time.
    act(() => root.render(<Metrics snapshot={overloaded(1800)} />));
    expect(labels()).toEqual(['30wk', 'now']);
  });
});

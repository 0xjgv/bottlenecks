import { useEffect, useId, useState } from 'react';
import { DEFAULT_SEED } from '../sim/seed';
import type { Topology } from '../sim/types';
import { GROWTH_MULTIPLES, playGrowth, type GrowthForecast } from '../learn/growth';
import { formatMs, formatPct, formatRate, toneClass } from './format';
import './Growth.css';

/**
 * "What if we grow?" The growth forecast as a panel: today's org played at
 * several multiples of today's incoming work, one row per multiple, with the
 * step that limits output at each. Every figure is measured by
 * `src/learn/growth.ts`.
 */

type View =
  { status: 'running'; done: number } | { status: 'done'; forecast: GrowthForecast };

/** Wall-clock budget per slice, so the canvas keeps animating while it runs. */
const SLICE_MS = 12;

interface Props {
  topology: Topology;
  /** Display name for a node id. */
  nameOf: (id: string) => string;
  onClose: () => void;
  /** Sets every source of work to `multiple` times today. */
  onPlay: (multiple: number) => void;
}

function useForecast(topology: Topology): View {
  const [view, setView] = useState<View>({ status: 'running', done: 0 });
  useEffect(() => {
    const run = playGrowth(topology, topology.seed ?? DEFAULT_SEED);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const slice = () => {
      const until = performance.now() + SLICE_MS;
      let r = run.next();
      while (!r.done && performance.now() < until) r = run.next();
      if (r.done) {
        setView({ status: 'done', forecast: r.value });
        return;
      }
      setView({ status: 'running', done: r.value });
      timer = setTimeout(slice, 0);
    };
    timer = setTimeout(slice, 0);
    return () => clearTimeout(timer);
  }, [topology]);
  return view;
}

function headline(f: GrowthForecast, nameOf: (id: string) => string): string {
  const broke = f.steps.find((s) => s.broken);
  const last = f.steps[f.steps.length - 1];
  if (!broke) {
    return `Holds at ${last?.multiple ?? 1}x today's work.`;
  }
  if (broke.multiple === 1) return 'Already over capacity at today’s work.';
  const who = broke.busiest ? nameOf(broke.busiest.nodeId) : 'one step';
  return `Breaks at ${broke.multiple}x today's work. ${who} is the constraint.`;
}

export function GrowthPanel({ topology, nameOf, onClose, onPlay }: Props) {
  const view = useForecast(topology);
  const headingId = useId();

  return (
    <section
      className="chal grw"
      role="region"
      aria-labelledby={headingId}
      data-chrome=""
    >
      <header className="chal-head">
        <div className="chal-head-text">
          <p className="label chal-kicker">What if we grow?</p>
          <h2 id={headingId} className="chal-name">
            {view.status === 'done'
              ? headline(view.forecast, nameOf)
              : 'Playing 20 weeks at each size…'}
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-icon"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>
      <div className="chal-body">
        {view.status === 'running' ? (
          <div
            className="grw-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.done * 100)}
            aria-label="Forecast progress"
          >
            <span style={{ width: `${Math.round(view.done * 100)}%` }} />
          </div>
        ) : (
          <>
            <table className="grw-table">
              <thead>
                <tr>
                  <th scope="col">Work in</th>
                  <th scope="col">Done</th>
                  <th scope="col">Dropped</th>
                  <th scope="col" title="The slowest 1 in 100 items">
                    Slowest
                  </th>
                  <th scope="col">Busiest step</th>
                </tr>
              </thead>
              <tbody>
                {view.forecast.steps.map((s) => (
                  <tr key={s.multiple} className={s.broken ? 'is-broken' : undefined}>
                    <th scope="row">
                      <button
                        type="button"
                        className="btn btn-sm grw-play"
                        title={`Play the canvas at ${s.multiple}x today's work`}
                        onClick={() => onPlay(s.multiple)}
                      >
                        {s.multiple}x
                      </button>
                      <span className="grw-sub">{formatRate(s.offeredPerWeek)}</span>
                    </th>
                    <td>{formatRate(s.deliveredPerWeek)}</td>
                    <td
                      className={
                        s.droppedShare > 0.02 ? toneClass('danger') : undefined
                      }
                    >
                      {formatPct(s.droppedShare)}
                    </td>
                    <td>{formatMs(s.p99Ms)}</td>
                    <td>
                      {s.busiest ? (
                        <>
                          <span className="grw-who">{nameOf(s.busiest.nodeId)}</span>
                          <span className="grw-sub">
                            {formatPct(s.busiest.utilization)} busy
                          </span>
                        </>
                      ) : (
                        'none'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chal-note">
              Each row plays your company for 20 weeks with incoming work at that
              multiple of today. Press a multiple to play it on the canvas. A row turns
              red when more than 2 in 100 items are dropped, or the slowest items take
              more than twice as long as today. The busiest step sets the pace for
              everyone: an hour saved there is an hour for the whole company; an hour
              saved anywhere else changes nothing.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export { GROWTH_MULTIPLES };

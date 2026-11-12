import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { SimSnapshot, Topology } from '../sim/types';
import { formatPct } from '../components/format';
import { MIN_RATE } from './bottleneck';
import {
  STEP_COUNT,
  TOUR_RPS,
  brokenText,
  fixedText,
  p99Text,
  readingOf,
  stepNumber,
  totalSlots,
} from './tourSteps';
import type { TourState } from './useTour';
import './Tour.css';

interface TourProps {
  tour: TourState;
  topology: Topology;
  snapshot: SimSnapshot | null;
  selectedId: string | null;
  rps: number;
  onSetLoad: (rps: number) => void;
  onSelect: (nodeId: string) => void;
  onOpenPath: () => void;
}

/** How long a backlog may take to clear after a fix before "try more" is fair. */
const SETTLE_MS = 4000;

/**
 * The field step 3 points at, found by the glossary term its label carries
 * rather than by the label's wording, which the inspector owns.
 */
const SLOTS_TERM = 'capacity';

/** The control a stage points at, or null. Read from the DOM: it belongs to other components. */
function targetFor(kind: string, fieldShown: boolean): Element | null {
  if (kind === 'load') {
    // On a phone the load block is `display: contents` and draws no box; the
    // track row is the slider's own.
    const load = document.querySelector('.traffic-load');
    return load && getComputedStyle(load).display === 'contents'
      ? load.querySelector('.traffic-load-track')
      : load;
  }
  if (kind !== 'fix' || !fieldShown) return null;
  const term = document.querySelector(`.ins label.row-k [data-term="${SLOTS_TERM}"]`);
  return term?.closest('.ins-field-row, .ins-field') ?? null;
}

/**
 * The first-visit walkthrough: a small card that says what to do next and
 * moves on when the engine shows it happened. Not modal: nothing is dimmed
 * and the canvas keeps every gesture, because the lesson is in using the
 * real controls.
 */
export function Tour({
  tour,
  topology,
  snapshot,
  selectedId,
  rps,
  onSetLoad,
  onSelect,
  onOpenPath,
}: TourProps) {
  const { stage } = tour;
  const cardRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<Element | null>(null);

  /* Focus comes to the card when it opens, and again on each new step if it
     was in the card (a pressed button that has now gone). Never taken from
     the slider or a field the student is using. */
  const step = stepNumber(stage);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const active = document.activeElement;
    if (active === null || active === document.body || card.contains(active)) {
      card.focus({ preventScroll: true });
    }
  }, [step]);

  /* The ring on the control this step is about. Rerun on every render, since
     the inspector mounts its fields after a selection lands. */
  const subject = stage.kind === 'load' ? null : stage.nodeId;
  const fieldShown = subject !== null && selectedId === subject;
  useLayoutEffect(() => {
    const next = targetFor(stage.kind, fieldShown);
    const prev = ringRef.current;
    if (prev === next) return;
    prev?.removeAttribute('data-tour-ring');
    next?.setAttribute('data-tour-ring', '');
    if (next && stage.kind === 'fix') next.scrollIntoView?.({ block: 'center' });
    ringRef.current = next;
  });
  useEffect(
    () => () => {
      ringRef.current?.removeAttribute('data-tour-ring');
      ringRef.current = null;
    },
    [],
  );

  const label =
    subject !== null
      ? (topology.nodes.find((n) => n.id === subject)?.label ?? 'It')
      : null;
  const p99 = snapshot ? p99Text(snapshot) : null;

  let title: string;
  let body: ReactNode;
  let actions: ReactNode;

  switch (stage.kind) {
    case 'load':
      title = 'Push more work in';
      body = (
        <p>
          This slider is how much work arrives each week. Drag it up to about {TOUR_RPS}{' '}
          a week and watch where it piles up.
        </p>
      );
      actions =
        rps < TOUR_RPS ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onSetLoad(TOUR_RPS)}
          >
            Set it to {TOUR_RPS} a week
          </button>
        ) : null;
      break;
    case 'broken': {
      const state = snapshot ? brokenText(topology, snapshot, stage.nodeId) : null;
      const err = snapshot?.system.errorRate ?? 0;
      // Refused work never waits, so "every new item" is only true without it.
      const refusing =
        (snapshot ? readingOf(topology, snapshot, stage.nodeId)?.r.refused : 0) ?? 0;
      title = 'You found the constraint';
      body = (
        <p>
          {state ? `${state} ` : null}
          {refusing >= MIN_RATE
            ? 'New work now waits its turn there, or is turned away once the backlog is full'
            : 'Every new item now waits its turn there'}
          {p99 ? `, so the slowest 1 in 100 items take ${p99}` : ''}
          {err >= 0.005 ? ` and ${formatPct(err)} of work fails` : ''}. Speeding up any
          other step would only grow the pile in front of it.
        </p>
      );
      actions = (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => onSelect(stage.nodeId)}
        >
          Show me the fix
        </button>
      );
      break;
    }
    case 'fix': {
      const now = totalSlots(topology, stage.nodeId);
      const cfg = topology.nodes.find((n) => n.id === stage.nodeId)?.config;
      const at = snapshot ? readingOf(topology, snapshot, stage.nodeId) : null;
      title = 'Add capacity at the constraint';
      if (!fieldShown) {
        body = <p>Select {label} to see its settings.</p>;
        actions = (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onSelect(stage.nodeId)}
          >
            Select {label}
          </button>
        );
      } else if (now <= stage.slots) {
        body = (
          <p>
            Each slot is one task {label} can work on at once. Raise the highlighted
            setting from {cfg?.capacity ?? 0} to {(cfg?.capacity ?? 0) * 2}.
          </p>
        );
        actions = null;
      } else if (at?.r.struggling) {
        const since = (snapshot?.system.timeMs ?? 0) - (stage.raisedAtMs ?? 0);
        body =
          since < SETTLE_MS ? (
            <p>
              {label} has {now} task slots now. Give the backlog a few weeks to clear.
            </p>
          ) : (
            <p>
              {label} has {now} task slots now, but it is still the constraint at this
              load. Try more.
            </p>
          );
        actions = null;
      } else {
        body = (
          <p>
            That did it. Now watch cycle time come back down as the backlog clears
            {p99 ? `: ${p99}` : ''}.
          </p>
        );
        actions = null;
      }
      break;
    }
    case 'fixed': {
      const state = snapshot ? fixedText(topology, snapshot, stage.nodeId) : null;
      title = 'Fixed';
      body = (
        <>
          <p>
            {state ? `${state} ` : null}
            {p99 ? `Cycle time is back to ${p99}.` : null}
          </p>
          <p>
            That is the whole loop: push work in, find the constraint, add capacity
            there, then look for the next one. The learning path has what to try next.
          </p>
        </>
      );
      actions = (
        <>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              tour.end();
              onOpenPath();
            }}
          >
            Open the learning path
          </button>
          <button type="button" className="btn btn-sm" onClick={tour.end}>
            Done
          </button>
        </>
      );
      break;
    }
  }

  return (
    <div className="tour" data-chrome="tour">
      <section
        ref={cardRef}
        className="tour-card"
        data-spot-avoid
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            tour.end();
          }
        }}
      >
        <header className="tour-head">
          <span className="tour-step">
            Step <span className="num">{step}</span> of{' '}
            <span className="num">{STEP_COUNT}</span>
          </span>
          {stage.kind === 'fixed' ? null : (
            <button
              type="button"
              className="btn btn-sm btn-ghost tour-skip"
              title="Skip the tour (Esc)"
              onClick={tour.end}
            >
              Skip tour
            </button>
          )}
        </header>
        <h2 id="tour-title" className="tour-title">
          {title}
        </h2>
        <div id="tour-body" className="tour-body">
          {body}
        </div>
        {actions ? <div className="tour-actions">{actions}</div> : null}
      </section>
    </div>
  );
}

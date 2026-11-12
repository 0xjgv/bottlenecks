import type {
  Attack,
  Closest,
  SearchPhase,
  SeedRun,
  SinglePoint,
} from '../sim/breakit';
import { BREAK_END_MS, BREAK_WARMUP_MS } from '../sim/breakit';
import type { Goal } from '../sim/challenge';
import { formatGoalMs, formatGoalPct, formatMs, formatShareDown } from './format';

/* ------------------------------------------------------------------ *
 * The words "Can you break it?" uses: setback phrases, schedules and
 * verdict sentences. Kept apart from the panel so they can be tested
 * without rendering anything.
 * ------------------------------------------------------------------ */

/** Names for the parts of a design, by id. */
export interface Names {
  node: (id: string) => string;
  /** An edge as "the handoff from A to B". */
  edge: (id: string) => string;
}

/**
 * A moment on the run's clock as a reader would say it: "week 12",
 * "week 0.5". One simulated second is one working week.
 */
export function secs(ms: number): string {
  const s = ms / 1000;
  return `week ${Number.isInteger(s) ? s : s.toFixed(1)}`;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** One setback, without its timing: "slow Founder 5x". */
export function faultPhrase(a: Attack, names: Names): string {
  switch (a.kind) {
    case 'crash':
      return `take out ${names.node(a.target)}`;
    case 'crash-instance':
      return `send one person from ${names.node(a.target)} home sick`;
    case 'slow':
      return `slow ${names.node(a.target)} ${a.factor}x`;
    case 'errors':
      return `make ${pct(a.rate)} of ${names.node(a.target)}'s work bounce back`;
    case 'cut':
      return `break ${names.edge(a.target)}`;
  }
}

/** One setback with its timing: "slow Founder 5x at week 10 for 5wk". */
export function attackPhrase(a: Attack, names: Names): string {
  const length = a.forMs === null ? '' : ` for ${formatMs(a.forMs)}`;
  return `${faultPhrase(a, names)} at ${secs(a.atMs)}${length}`;
}

/**
 * A whole schedule as one sentence. Faults at the same moment are joined
 * with "and", later ones with "then". Times are on the replay's clock.
 */
export function scheduleSentence(attacks: readonly Attack[], names: Names): string {
  const groups: Attack[][] = [];
  for (const a of attacks) {
    const last = groups[groups.length - 1];
    if (last && last[0].atMs === a.atMs) last.push(a);
    else groups.push([a]);
  }
  const text = groups
    .map((g) => g.map((a) => attackPhrase(a, names)).join(' and '))
    .join(', then ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The counted window, as the verdict names it. */
export const WINDOW_PHRASE = `Between ${secs(BREAK_WARMUP_MS)} and ${secs(BREAK_END_MS)}`;

/** Whose work a goal is about: "work items" or "work items from Sales". */
function whose(goal: Goal, names: Names): string {
  return goal.route === undefined
    ? 'work items'
    : `work items from ${names.node(goal.route)}`;
}

/**
 * The line a goal has to stay under, as the verdict quotes it. A run that
 * fell behind broke whatever the goal said, so it gets the reason instead.
 */
export function goalLine(goal: Goal, run?: SeedRun): string {
  if (run?.outcome === 'falling-behind') {
    return 'A backlog that keeps growing fails everything in the end, so this counts as broken whatever the goal.';
  }
  switch (goal.metric) {
    case 'errorRate':
      return `The goal was ${formatGoalPct(goal.max)} or less.`;
    case 'p99':
      return `The goal was ${formatGoalMs(goal.max)} or less.`;
    case 'p95':
      return `The goal was ${formatGoalMs(goal.max)} or less.`;
    default:
      return goal.max === 0
        ? 'The goal was none.'
        : `The goal was ${goal.max} or fewer.`;
  }
}

/** What a run did to the goal, in a sentence, without the goal itself. */
export function effectSentence(run: SeedRun, goal: Goal, names: Names): string {
  const who = whose(goal, names);
  if (run.outcome === 'nothing-completed') {
    return `${WINDOW_PHRASE}, none of the ${who} got through.`;
  }
  if (run.outcome === 'falling-behind') {
    const share = formatShareDown(run.keptUp);
    const answered = (run.keptUp ?? 0) > 0.9 ? share : `only ${share}`;
    return `${WINDOW_PHRASE}, ${who} piled up faster than they finished: ${answered} got done and the rest were still waiting.`;
  }
  switch (goal.metric) {
    case 'errorRate':
      return run.actual === null
        ? `${WINDOW_PHRASE}, none of the ${who} got done.`
        : `${WINDOW_PHRASE}, ${formatGoalPct(run.actual)} of ${who} failed.`;
    case 'p99':
      return `${WINDOW_PHRASE}, the slowest 1 in 100 ${who} took ${formatGoalMs(run.actual)} or longer.`;
    case 'p95':
      return `${WINDOW_PHRASE}, the slowest 1 in 20 ${who} took ${formatGoalMs(run.actual)} or longer.`;
    case 'lostWrites':
      return `${run.actual ?? 0} promised ${run.actual === 1 ? 'record was' : 'records were'} never written down.`;
    case 'lostJobs':
      return `${run.actual ?? 0} accepted ${run.actual === 1 ? 'task' : 'tasks'} failed later.`;
    case 'queueDepth':
      return '';
  }
}

/** The fault-free figure under a goal: "With no faults, 0.4% of work items fail." */
export function baselineSentence(run: SeedRun, goal: Goal, names: Names): string {
  const who = whose(goal, names);
  if (run.outcome === 'nothing-completed')
    return `With no faults, none of the ${who} get through.`;
  if (run.outcome === 'falling-behind') {
    return `With no faults, ${who} already pile up faster than they finish.`;
  }
  switch (goal.metric) {
    case 'errorRate':
      return `With no faults, ${formatGoalPct(run.actual)} of ${who} fail.`;
    case 'p99':
      return `With no faults, 99 in 100 ${who} finish within ${formatGoalMs(run.actual)}.`;
    case 'p95':
      return `With no faults, 19 in 20 ${who} finish within ${formatGoalMs(run.actual)}.`;
    case 'lostWrites':
      return `With no faults, ${run.actual ?? 0} promised records are lost.`;
    case 'lostJobs':
      return `With no faults, ${run.actual ?? 0} accepted tasks fail.`;
    case 'queueDepth':
      return '';
  }
}

/** What the search is doing, announced as it changes. */
export function phaseLine(phase: SearchPhase): string {
  switch (phase) {
    case 'baseline':
      return 'Measuring it with no faults';
    case 'remembered':
      return 'Trying the faults that broke it last time';
    case 'single':
      return 'Trying one fault at a time';
    case 'pair':
      return 'Trying two at once';
    case 'triple':
      return 'Trying three at once';
    case 'shrink':
      return 'Found what breaks it. Narrowing it down';
  }
}

/** The near miss so far, or that there has not been one. */
export function closestLine(closest: Closest | null, goal: Goal, names: Names): string {
  if (closest === null || closest.score < 0.5) return 'Nothing has come close yet.';
  const sentence = scheduleSentence(closest.attacks, names).slice(0, -1);
  const what = `${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
  if (closest.outcome === 'falling-behind' || closest.pilingUp) {
    return `Closest call: ${what}. Work started to pile up.`;
  }
  switch (goal.metric) {
    case 'errorRate':
      return `Closest call: ${what}. ${formatGoalPct(closest.actual)} failed.`;
    case 'p99':
    case 'p95':
      return `Closest call: ${what}. The slowest took ${formatGoalMs(closest.actual)}.`;
    default:
      return `Closest call: ${what}.`;
  }
}

/** How many of each size the search tried. */
export function triedLine(bySize: readonly [number, number, number]): string {
  const parts = [`One fault: ${bySize[0]}.`];
  if (bySize[1] > 0) parts.push(`Two at once: ${bySize[1]}.`);
  if (bySize[2] > 0) parts.push(`Three at once: ${bySize[2]}.`);
  return parts.join(' ');
}

/** A list as a reader would say it: "A, B and C". */
function listed(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The single points of failure as findings, one line per source of work:
 * "All work from Customers has to pass through Support and Founder."
 */
export function singlePointLines(
  points: readonly SinglePoint[],
  names: Names,
): string[] {
  const byClient = new Map<string, { boxes: string[]; links: string[] }>();
  for (const p of points) {
    for (const c of p.clients) {
      const parts = byClient.get(c) ?? { boxes: [], links: [] };
      if (p.type === 'node') parts.boxes.push(names.node(p.id));
      else parts.links.push(names.edge(p.id));
      byClient.set(c, parts);
    }
  }
  // Teams first, handoffs after, so the sentence reads boxes then wires.
  return [...byClient].map(
    ([c, { boxes, links }]) =>
      `All work from ${names.node(c)} has to pass through ${listed([...boxes, ...links])}.`,
  );
}

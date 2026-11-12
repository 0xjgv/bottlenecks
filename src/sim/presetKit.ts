/**
 * Building blocks for the bundled examples: node and edge literals, the
 * layout grid, and annotation helpers. Shared by presets.ts and
 * presets.startups.ts so both place nodes on the same grid.
 */
import type { NodeConfig, NodeKind, SimEdge, SimNode } from './types';
import type { Note, Section } from './annotations';
import { defaultConfig } from './defaults';

/* ------------------------------------------------------------------ *
 * Preset construction helpers
 * ------------------------------------------------------------------ */

export function node(
  id: string,
  kind: NodeKind,
  label: string,
  x: number,
  y: number,
  overrides: Partial<NodeConfig> = {},
): SimNode {
  return {
    id,
    kind,
    label,
    x,
    y,
    config: { ...defaultConfig(kind), ...overrides },
  };
}

export function edge(from: string, to: string, weight = 1): SimEdge {
  return { id: `${from}->${to}`, from, to, weight };
}

/**
 * A CONTROL edge: "`from` acts on `to`". Carries no requests -- the engine
 * leaves control edges out of every routing set -- and exists so a
 * supervisory relationship is stated in the topology rather than inferred
 * from a wire that looks exactly like a traffic path.
 */
export function control(from: string, to: string): SimEdge {
  return { id: `${from}->${to}`, from, to, weight: 1, control: true };
}

/* ================================================================== *
 * Grid geometry for the presets below.
 *
 * Canvas draws a node as NODE_W=184 x NODE_H=88 anchored at (x, y). A column
 * pitch of 260 leaves 76px of horizontal gutter for the edge to be visible,
 * and a row pitch of 130 leaves 42px vertically. Every preset places nodes on
 * COL(i) / ROW(j) so no two boxes can overlap by construction, and the
 * verifier asserts it rather than trusting the arithmetic.
 * ================================================================== */

const COL0 = 40;
const COL_PITCH = 260;
const ROW0 = 60;
const ROW_PITCH = 130;

/** x of grid column i (0-based), left-to-right. */
export const COL = (i: number) => COL0 + i * COL_PITCH;
/** y of grid row j (0-based), top-to-bottom. */
export const ROW = (j: number) => ROW0 + j * ROW_PITCH;

/* ================================================================== *
 * Annotation helpers for the presets below.
 *
 * These build the Section and Note literals directly rather than calling
 * makeSection/makeNote from annotations.ts, because those mint ids from a
 * mutating module counter. A preset's annotation ids would then depend on
 * module evaluation order, which is exactly the kind of thing that is stable
 * in a test run and different in a share link. Ids here are written down.
 *
 * The frame helpers take grid cells rather than pixels so a section is
 * described the way the layout is: "columns 0 to 3, rows 0 to 1". Sections
 * are padded evenly; the room that padding needs is bought at the lane
 * boundary by LANE_GAP rather than by squeezing the frames.
 * presets.annotations.test.ts asserts none of them collide.
 * ================================================================== */

const SEC_PAD_X = 28;
const SEC_PAD_T = 16;
const SEC_PAD_B = 16;

/**
 * Extra vertical space inserted at a lane boundary, on top of ROW_PITCH.
 *
 * Two stacked sections need NODE_H + pad + label plate + pad = 148px between
 * their row tops, and ROW_PITCH is 130. Without this the frames either touch
 * or the lower one's label plate lands inside the upper frame. Rather than
 * shaving the padding down until it fits (which is what made the first pass
 * look cramped), the layout gives the boundary the room it actually needs.
 */
export const LANE_GAP = 64;

/** y of grid row j, pushed down by `lane` lane boundaries above it. */
export const LROW = (j: number, lane = 0) => ROW(j) + lane * LANE_GAP;

/**
 * A section framing grid cells c0..c1 by r0..r1 inclusive.
 *
 * `tight` drops the bottom padding to zero, freeing the row gutter for the
 * label plate of whatever section sits underneath.
 */
export function sectionOver(
  id: string,
  label: string,
  tone: number,
  c0: number,
  c1: number,
  r0: number,
  r1: number,
  lane = 0,
): Section {
  const x = COL(c0) - SEC_PAD_X;
  const y = LROW(r0, lane) - SEC_PAD_T;
  return {
    id,
    kind: 'section',
    label,
    x,
    y,
    width: COL(c1) + NODE_W + SEC_PAD_X - x,
    height: LROW(r1, lane) + NODE_H + SEC_PAD_B - y,
    tone,
  };
}

/**
 * A note at an explicit world point.
 *
 * Presets set `font: 'hand'` on their commentary so it reads as something
 * written in the margin rather than as another label belonging to the
 * diagram. Colour is left unset: a note with no colour follows the theme,
 * which is what keeps the examples legible when the palette changes.
 */
export function note(
  id: string,
  x: number,
  y: number,
  text: string,
  width = 220,
  size: Note['size'] = 'md',
  font: Note['font'] = 'hand',
): Note {
  return { id, kind: 'note', text, x, y, width, size, font };
}

/** Node box, mirrored from Canvas so the frame helpers can do arithmetic. */
export const NODE_W = 184;
export const NODE_H = 88;

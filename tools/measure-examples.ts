/**
 * Every example, played headless at 1x and 3x its default incoming work.
 *
 *   bun tools/measure-examples.ts              all examples
 *   bun tools/measure-examples.ts seed-saas    only ids containing "seed-saas"
 *   MULT=1,2,4 bun tools/measure-examples.ts   other multiples
 *
 * Uses the growth forecast's runner (src/learn/growth.ts): a fixed seed, a
 * 5 week warm-up, then 20 counted weeks. Per example and multiple it prints
 * work finished per week, the slowest 1 in 100 cycle time, the share of
 * work dropped, and the busiest step by utilisation.
 */
import { forecastGrowth } from '../src/learn/growth.ts';
import { PRESETS } from '../src/sim/presets.ts';
import { formatMs } from '../src/components/format.ts';

const SEED = 1;
const MULTS = (process.env.MULT ?? '1,3').split(',').map(Number);
const filter = process.argv[2] ?? '';

const pad = (s: string, n: number) => s.padEnd(n);
const lpad = (s: string, n: number) => s.padStart(n);

console.log(
  `${pad('example', 22)}${lpad('x', 4)}${lpad('in/wk', 9)}${lpad('done/wk', 9)}${lpad('p99', 9)}${lpad('dropped', 9)}  busiest`,
);
for (const p of PRESETS) {
  if (!p.id.includes(filter)) continue;
  const { steps } = forecastGrowth(p.topology, SEED, MULTS);
  for (const s of steps) {
    const busy = s.busiest
      ? `${s.busiest.nodeId} ${(s.busiest.utilization * 100).toFixed(0)}%`
      : '-';
    console.log(
      `${pad(p.id, 22)}${lpad(`${s.multiple}`, 4)}${lpad(s.offeredPerWeek.toFixed(1), 9)}${lpad(s.deliveredPerWeek.toFixed(1), 9)}${lpad(formatMs(s.p99Ms), 9)}${lpad(`${(s.droppedShare * 100).toFixed(1)}%`, 9)}  ${busy}`,
    );
  }
}

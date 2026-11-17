import { describe, expect, it } from 'vitest';
import { Engine } from '../sim/engine';
import { PRESETS } from '../sim/presets';
import type { Topology } from '../sim/types';
import {
  TASK_START,
  advanceTask,
  probeValue,
  type ExampleTask,
  type TaskStep,
} from '../learn/exampleTask';
import { offeredLoad } from '../learn/pathProgress';
import { EXAMPLE_TASKS } from './exampleTasks';

function start(task: ExampleTask, seed: number) {
  const p = PRESETS.find((p) => p.id === task.presetId);
  if (!p) throw new Error(`Missing example ${task.presetId}`);
  const topology = structuredClone(p.topology);
  const engine = new Engine(topology, seed);
  for (let t = 0; t < 10_000; t += 50) engine.advance(50);
  return { topology, engine };
}

// Operate the same numeric settings and fault controls the instructions name.
// Observation conditions are never synthesized: only the real engine can pass them.
function perform(step: TaskStep, topology: Topology, engine: Engine): void {
  if (step.action?.kind === 'load') {
    const factor = step.action.rps / offeredLoad(topology);
    for (const n of topology.nodes) {
      if (n.kind !== 'client') continue;
      const rps = (n.config.rps ?? 0) * factor;
      n.config = { ...n.config, rps };
      engine.updateNodeConfig(n.id, { rps });
    }
  }
  for (const condition of step.when) {
    const p = condition.probe;
    if (p.of === 'setting') {
      const value = condition.atLeast ?? Math.ceil(condition.below ?? 1) - 1;
      const n = topology.nodes.find((n) => n.id === p.node);
      if (!n) throw new Error(`Missing part ${p.node}`);
      n.config = { ...n.config, [p.field]: value };
      engine.updateNodeConfig(n.id, { [p.field]: value });
    } else if (p.of === 'fault' && condition.atLeast === 1) {
      if (
        !engine
          .snapshot()
          .activeFailures.some((f) => f.nodeId === p.node && f.kind === p.kind)
      ) {
        engine.recordFailure(p.node, p.kind);
      }
    }
  }
}

it('gives every startup example exactly one exercise with valid named parts', () => {
  expect(EXAMPLE_TASKS.map((t) => t.presetId).sort()).toEqual(
    PRESETS.map((p) => p.id).sort(),
  );
  for (const task of EXAMPLE_TASKS) {
    const { topology } = start(task, 1);
    const ids = new Set(topology.nodes.map((n) => n.id));
    for (const step of task.steps) {
      if (step.ring)
        expect(ids.has(step.ring), `${task.presetId}: ${step.ring}`).toBe(true);
      for (const c of step.when) {
        if ('node' in c.probe)
          expect(ids.has(c.probe.node), `${task.presetId}: ${c.probe.node}`).toBe(true);
      }
      expect(step.text).not.toMatch(
        /requests per second|\bservers\b|\bmilliseconds\b|—/i,
      );
    }
  }
});

describe.each(EXAMPLE_TASKS.map((task) => [task.presetId, task] as const))(
  '%s exercise',
  (_, task) => {
    it('does not complete when left untouched at its starting load', () => {
      const { topology, engine } = start(task, 1);
      let progress = TASK_START;
      for (let t = 0; t < 30_000; t += 100) {
        engine.advance(50);
        engine.advance(50);
        progress = advanceTask(task, progress, topology, engine.snapshot());
      }
      expect(progress.step).toBeLessThan(task.steps.length);
    });

    it.each([1, 2, 3])(
      'completes the stated actions and measured recovery on seed %i',
      (seed) => {
        const { topology, engine } = start(task, seed);
        let progress = TASK_START;
        while (progress.step < task.steps.length) {
          const at = progress.step;
          const step = task.steps[at];
          if (!step) throw new Error('Missing current step');
          perform(step, topology, engine);
          for (let t = 0; t < 90_000 && progress.step === at; t += 100) {
            engine.advance(50);
            engine.advance(50);
            progress = advanceTask(task, progress, topology, engine.snapshot());
          }
          const measured = step.when.map((c) => ({
            ...c,
            value: probeValue(c.probe, topology, engine.snapshot()),
          }));
          expect(
            progress.step,
            `${task.presetId} seed ${seed} step ${at + 1}: ${step.text}\n${JSON.stringify(measured)}`,
          ).toBeGreaterThan(at);
        }
      },
    );
  },
);

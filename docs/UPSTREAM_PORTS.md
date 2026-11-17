# Selective Breakscale ports

Verified on 17 November 2026 against upstream `145cdf980a657d7f8b28addad11a248d5d6bbd6f` and Bottlenecks baseline `d5e474cf277e2509370a7835737242f94bc686f5`.

## Scope

| Area           | Ported behavior                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Interaction    | Modal focus and keyboard containment, touch tooltip presses, larger resize targets, inspector reselect, canvas fit and reveal |
| Run comparison | Keep a run's measured samples and startup readouts; inspect individual chart samples; 0.5×, 1×, 2× and 4× playback            |
| Learning       | A measured exercise for every one of the 34 startup examples; prior saved progress remains valid                              |
| Flow           | Measured handoff outcomes, retries, losses and backlog pressure; representative dots with a static reduced-motion alternative |
| Intake         | Clustered arrivals, synchronized batches, account concentration, baseline load multiples, and ramps that start when selected  |

The larger editor redesign, command palette, context menus, presentation mode, deep links, and operation-level correctness expansion are outside this port. No dependency was added. Nothing was pushed or deployed.

The engine remains pure. Startup names, working-time units, company examples and measure exclusions remain in place. New configuration fields and traffic-pattern indices append to the existing share format. Existing designs omit them and retain their previous behavior.

The new engine features principally follow upstream commits [`f79b2a1`](https://github.com/workersio/breakscale/commit/f79b2a111b278381da47ca5671ad11de83d4fd32) and [`6c380c7`](https://github.com/workersio/breakscale/commit/6c380c775d1734a97619f6271a29f97e0d2b67bb). Instructions, exercise thresholds, labels and units are adapted to the startup model.

## Verification

- `bun run test`: 150 files and 3,116 tests passed.
- `bun run build`: passed. Main application chunk 769.70 kB, 239.79 kB gzip. The existing 600 kB warning remains; baseline was 694.66 kB, 214.28 kB gzip.
- `bun run lint`: no errors, 27 warnings, compared with 28 at baseline.
- Legacy simulation parity: 34 examples × 3 seeds × loads of 1×, 2× and 4×. All 3,060 snapshots across 306 runs match the original engine byte for byte. Each run covers 20 working weeks at a fixed 16 ms engine step, with outcome counting enabled in the new engine.
- Exercises: all 102 runs across the same 34 examples and three seeds completed. The script observed 309 successful steps; completion fell between week 11.7 and week 39.6, including ten weeks of initial warm-up. Untouched examples do not receive completion credit.
- Serialization: legacy links and replay fixtures pass. New intake settings round-trip alongside both startup measure-exclusion lists.
- Real Chromium: desktop, tablet and phone exercise completion; desktop and phone run comparison, chart readout, playback controls, moving and static flow displays, workload controls and session restore. Checks use visible pages and hard reloads. No page errors were observed.
- Computed contrast for the new readings and controls: lowest tested body-text ratio 5.49:1 in light mode and 5.80:1 in dark mode. Flow graphics: 3.24:1 and 4.94:1 respectively.

## Measured model experiments

These are controlled simulation runs, not observations about real companies.

| Experiment                                                                                                     | Actual output                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose a 20-week ramp at week 64, seed 42                                                                      | First two weeks: 9 tasks after the fix, 185 before. Last two ramp weeks: 213 tasks; two weeks after the ramp: 216.                                                                                             |
| Same 1,500 tasks, three batches of 500, team capacity 400/week and backlog 24, no background arrivals, seed 42 | All at once: 1,416 failed. Each batch spread over two weeks: 0 failed. Both measured at week 66, after all three batches arrived.                                                                              |
| Steady versus clustered intake, configured 50/week, 300-week run, seed 42                                      | Steady: 14,835 tasks, 49.45/week, final p99 0.01 working weeks. Clustered: 14,964 tasks, 49.88/week, final p99 0.0574 working weeks. Rate is the whole-run mean; p99 is the engine's trailing measured window. |
| Eight account owners, 768 tasks/week, 30 weeks, seed 42                                                        | Even distribution: mean busy 58.28%, busiest owner 73.34%, failures 0%. Concentration level 1: mean busy 57.68%, busiest owner 100%, failures 11.31%; measured busiest account share 22.02%.                   |

The parity check covers the stated seeds, topologies and loads. Browser checks used Chromium with emulated touch viewports, not physical devices or Safari/Firefox. Hosted deployment, external sharing services, production performance and cross-browser deterministic replay were not verified.

Independent review also found two transition cases, each reproduced before its fix: a pending clustered arrival could outlast a newly selected ramp, and a saved aggregate baseline above 5,000/week was truncated on reload. Regression coverage now exercises both ramp update paths and restores a 6,000/week baseline across three sources.

The independent reviewer rechecked both fixes: each ramp update path produced 113 tasks during the five-week climb and 471 over the following ten weeks. An additional 120 fresh-ramp and reset snapshots matched the pre-port engine. The 6,000/week baseline persisted and reloaded as 1.0×. No high-confidence findings remained in the reviewed simulation, wire, playback and baseline scope.

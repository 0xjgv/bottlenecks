# Bottlenecks

Map how work flows through your startup. Find what slows it down.

Bottlenecks is a simulator in the spirit of Goldratt's _The Goal_. Put your teams, backlogs,
approvers and handoffs on a canvas, send work through them, and watch where it piles up. Every
number comes from simulating individual work items, not from a formula: cycle time, backlog
size, how busy people are, and how much work gets dropped.

It is a fork of [Breakscale](https://github.com/workersio/breakscale), a system design simulator.
The engine is unchanged; everything on screen is in startup terms. One simulated second is one
working week. [docs/STARTUP_MODEL.md](docs/STARTUP_MODEL.md) explains the time scale, the
vocabulary and what each component means.

## How to use it

1. **Map your flow.** Start from an example (Menu, Examples) that looks like your company: Seed
   SaaS, Series A SaaS, Marketplace ops, Devtools open source, AI agency, Fintech compliance, or
   Drum, buffer, rope. Rename the boxes to your teams and set each one's people, tasks per person
   and hands-on time per task in the inspector. Or drag parts from the left rail and wire your own.
2. **Drive work in.** The "Work arriving" slider in the top bar sets how many items a week reach
   the company, the way a client drives traffic into a server. Watch backlogs grow and cycle time
   climb.
3. **Find the constraint.** "Find the problem" names the one step that limits output right now,
   says who is blocked behind it, and suggests what to do: protect its time, put a playbook in
   front, or add people there. An hour saved anywhere else changes nothing.
4. **Look ahead.** "What if we grow?" plays your company for 20 weeks at 1x, 1.5x, 2x, 3x and 4x
   today's work and shows when it breaks and which step is the constraint at each size.
   "Can you break it?" searches for the smallest set of events that halts you: someone out sick,
   a team out, a slowdown, quality slipping, a broken handoff.
5. **Practise.** Challenges and startup scenarios (launch week, the key engineer quits, the
   enterprise deal) each fail as they ship; find the change that fixes them.

## Run it locally

You need [Bun](https://bun.sh).

```bash
bun install
bun dev        # http://localhost:5174
bun run test   # vitest. Not `bun test`, which skips the jsdom setup
```

```
src/sim/         the simulation engine. No React, no DOM, no I/O
src/components/  canvas, inspector, metrics, palette
src/content/     glossary text
src/App.tsx      shell: layout, the animation loop, persistence
```

## License

[MIT](LICENSE)

The bundled Caveat webfont in `public/fonts/Caveat/` is **not** covered by the MIT licence. It is
licensed separately under the [SIL Open Font License 1.1](public/fonts/Caveat/OFL.txt), which ships
alongside the font file as that licence requires. Copyright 2014 The Caveat Project Authors.

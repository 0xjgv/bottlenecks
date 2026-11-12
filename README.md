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

# Contributing to Bottlenecks

Bottlenecks is a teaching tool, so the bar for a change is not only "does it work" but "does it
help someone see where work gets stuck".

Read [AGENTS.md](AGENTS.md) for the conventions and [docs/STARTUP_MODEL.md](docs/STARTUP_MODEL.md)
for how the simulation maps onto a startup.

## Setup

You need [Bun](https://bun.sh).

```bash
bun install
bun dev
```

The app runs at http://localhost:5174.

## Before you send a change

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `bun run typecheck` | Type-check the project                                   |
| `bun run lint`      | Lint                                                     |
| `bun run format`    | Format with Prettier                                     |
| `bun run test`      | Run the tests. Not `bun test`: it skips the vitest setup |
| `bun run build`     | Typecheck and build                                      |

- Keep the change small and aimed at one thing.
- Add or update a test for any behaviour you change.
- Say in plain language what the change does for someone using the app.

## Licence

Contributions are under the [MIT licence](LICENSE).

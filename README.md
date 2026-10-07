# Vibe Puzzles

A collection of logic puzzles that runs in the browser. Every puzzle is generated on the fly with a unique solution.

- **Tetroid**: shade one tetromino in every region so that all shaded cells connect, no 2×2 block is shaded and equal tetrominoes never touch.
- **Pinwheel**: divide the grid into regions that are point-symmetric around their centre dot.

Built with SvelteKit 3, Svelte 5, TypeScript and Tailwind CSS 4.

## Features

- Deterministic generators: a puzzle ID (shown under the board) always produces the same puzzle on every device.
- Normal and hard difficulty in several sizes, plus daily, weekly and monthly specials.
- Undo and redo, checkpoints, timers, error highlighting, zoom, keyboard and touch controls, print and share.
- Progress, settings and statistics are saved in the browser.
- Optional server (Cloudflare Workers with D1): anonymous players, game sync across devices with a sync code, and leaderboards.

## Development

Requires Node 24 (npm 11).

```sh
npm install
npm run dev        # dev server without the API
npm run cf:dev     # build and run with the API and a local D1 database
npm run lint       # prettier and eslint
npm run check      # svelte-check and worker type check
npm test           # unit tests
npm run test:e2e   # browser smoke tests (run `npx playwright install chromium` once)
```

## Project layout

```
src/lib/core/         shared types, seeded RNG, puzzle IDs, settings
src/lib/games/<id>/   one folder per game: rules, solver, generator, logic, Board.svelte, index.ts
src/lib/games/logic.ts   registry of game logic (used by the client and the server)
src/lib/games/index.ts   registry of game modules (logic plus UI)
src/lib/client/       browser-side storage, API client, game session, generator web worker
src/lib/components/   game shell and dialogs
src/routes/           pages
worker/               Cloudflare Worker: REST API and storage
migrations/           D1 schema
```

### Adding a game

1. Create `src/lib/games/<id>/` with a `logic.ts` exporting a `GameLogic` (variants, generator, state encoding, answer check) and an `index.ts` exporting a `GameModule` (name, rules, tools, settings and a `Board.svelte` component).
2. Register the logic in `src/lib/games/logic.ts` and the module in `src/lib/games/index.ts`.
3. Generators must be deterministic for a seed and must not depend on time, so puzzle IDs work everywhere.

## Branches and pull requests

- `main` is the stable branch and is deployed.
- `dev` is the integration branch for testing.
- Work happens on `feature/feature_name` branches with pull requests against `dev`. CI runs lint, type checks, unit tests and browser tests on every push and pull request.

## Deployment

### GitHub Pages (static, no server features)

1. In the repository settings under **Pages**, set the source to **GitHub Actions**.
2. Push to `main`. The `Deploy to GitHub Pages` workflow builds with `BASE_PATH=/<repository name>` and publishes the site.

Without a server the app keeps everything in the browser; the player page and the online leaderboard say that the server is not available.

### Cloudflare Workers (with server features)

One-time setup:

1. Create the database: `npx wrangler d1 create vibe-puzzles`.
2. Add the repository secrets `CLOUDFLARE_API_TOKEN` (with Workers and D1 edit permissions), `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_D1_DATABASE_ID` (the ID printed in step 1).
3. Set the repository variable `CLOUDFLARE_DEPLOY` to `true` to deploy on every push to `main`, or run the `Deploy to Cloudflare Workers` workflow by hand.

#### Server-generated puzzles

By default the browser generates every puzzle. Because a puzzle ID is also the generator seed, anyone who knows the ID can compute the solution. Setting `SERVER_PUZZLES` to `"true"` in `wrangler.jsonc` moves generation to the server for signed-in players:

- The server picks a secret seed, stores the puzzle and returns it with a ticket. The puzzle ID is shown only after the puzzle is solved.
- A ranked time is measured by the server, from issuing the puzzle to receiving the correct answer.
- Only server-issued puzzles are ranked. Puzzles opened by ID or shared links still work but are not ranked.
- If the server cannot create a puzzle, the browser generates one and the game is not ranked.

Large puzzles need more CPU time than the Workers free plan allows per request (10 ms), so this mode needs the paid plan. Raise `limits.cpu_ms` in `wrangler.jsonc` if large puzzles time out.

To deploy from a local machine instead, put the database ID into `wrangler.jsonc` and run `npm run cf:deploy`.

### API

| Method         | Path              | Purpose                                        |
| -------------- | ----------------- | ---------------------------------------------- |
| GET            | `/api/health`     | Server availability                            |
| POST/GET/PATCH | `/api/player`     | Register, look up (by token), rename           |
| GET/PUT        | `/api/saves/:key` | Load and store a saved game (newest wins)      |
| POST           | `/api/puzzles`    | New server puzzle (with `SERVER_PUZZLES`)      |
| POST           | `/api/scores`     | Submit a solve; the server verifies the answer |
| GET            | `/api/scores`     | Leaderboard for a game and variant             |

Players authenticate with a random token (the sync code); only its SHA-256 hash is stored. Submitted answers are always checked on the server. Without `SERVER_PUZZLES` the solve times come from the client, so leaderboards are easy to cheat; with it, times are measured by the server, though a player can still feed a puzzle to a solver program.

# Vibe Puzzles

[![CI](https://github.com/FionaPreroll/vibe-puzzles/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FionaPreroll/vibe-puzzles/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/FionaPreroll/vibe-puzzles/graph/badge.svg?branch=main)](https://codecov.io/gh/FionaPreroll/vibe-puzzles)

A collection of logic puzzles that runs in the browser, in English and German. Every puzzle has a unique solution; puzzles are generated on the device or taken from a pre-generated collection.

- **Tetroid**: shade one tetromino in every region so that all shaded cells connect, no 2×2 block is shaded and equal tetrominoes never touch.
- **Pinwheel**: divide the grid into regions that are point-symmetric around their centre dot.
- **Sudoku**: fill the 9×9 grid so that every row, column and 3×3 box holds the digits 1 to 9 once, with notes and three difficulty levels.
- **Calcudoku**, a mode of Sudoku: 5×5, 7×7 or 9×9 without boxes; every row and column holds each digit once, and the digits of each cage give its target with its operation (+, −, ×, ÷).

Built with SvelteKit 3, Svelte 5, TypeScript and Tailwind CSS 4.

## Features

- Deterministic generators: a puzzle ID (shown under the board) always produces the same puzzle on every device.
- Normal and hard puzzles in several sizes (Sudoku and Calcudoku also easy), plus daily, weekly and monthly specials.
- Undo and redo, checkpoints, timers, error highlighting, zoom, keyboard and touch controls, print and share.
- An interactive tutorial puzzle on the first visit of each game.
- English and German, picked from the browser language and switchable in the header.
- Installable as an app (PWA) and playable offline after the first visit.
- A growing collection of pre-generated puzzles (see below); players choose between the collection, puzzles generated on their device, or both.
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
npm run test:e2e   # browser tests (run `npx playwright install chromium` once)
npm run test:server # browser tests against the server: two devices syncing a game
npm run test:soak  # long play sessions (desktop, phone): nothing leaks (SOAK_ACTIONS=600, SOAK_SEED)
npm run test:perf  # generator, page load and move latency budgets (PERF_BUDGET_SCALE=1)
npm run bank:grow  # add puzzles to the collection (--per-variant N --max-minutes M)
```

## Project layout

```
src/lib/core/         shared types, seeded RNG, puzzle IDs, settings
src/lib/games/<id>/   one folder per game: rules, solver, generator, logic, Board.svelte, index.ts
src/lib/games/logic.ts   registry of game logic (used by the client and the server)
src/lib/games/index.ts   registry of game modules (logic plus UI)
src/lib/client/       browser-side storage, API client, game session, generator web worker
src/lib/components/   game shell, tutorial and dialogs
src/lib/i18n/         translations (en.ts is the reference, de.ts must have the same keys)
src/service-worker/   offline cache
src/routes/           pages
static/puzzles/       the puzzle collection, one JSON file per game and puzzle type
scripts/              grow-puzzle-bank.ts, licenses.ts (licence notices of shipped packages)
worker/               Cloudflare Worker: REST API and storage
migrations/           D1 schema
```

### Adding a game

1. Create `src/lib/games/<id>/` with a `logic.ts` exporting a `GameLogic` (variants, generator, solution counter, state encoding, answer check) and an `index.ts` exporting a `GameModule` (name, tools, settings, an optional tutorial puzzle and a `Board.svelte` component).
2. Add the texts (tagline, rules, notes, control hints, tutorial steps) under `games.<id>` in every file in `src/lib/i18n/`.
3. Register the logic in `src/lib/games/logic.ts` and the module in `src/lib/games/index.ts`.
4. Generators must be deterministic for a seed and must not depend on time, so puzzle IDs work everywhere.
5. Only ever append new puzzle types to a game's variant list (at most 16): a puzzle ID stores the type's position in the list, so moving or inserting one changes every ID, save, link and leaderboard entry. A unit test pins the order.

## Puzzle collection

`static/puzzles/<game>/<type>.json` holds pre-generated puzzles with their IDs. The `Grow puzzle collection` workflow runs weekly (or by hand, with the number of new puzzles per type and a time limit) and proposes the new puzzles in a pull request against `main` from the branch `feature/grow_puzzle_collection`; while that pull request is open, later runs add to it. It first stores the special puzzles of the coming periods, then adds puzzles with fresh random seeds to every type in turns, so a time limit still leaves each type with new puzzles. Each puzzle is checked for a unique solution before it is committed, so the collection keeps growing. The unit tests check every stored puzzle again. The workflow needs **Allow GitHub Actions to create and approve pull requests** (repository settings, Actions, General). Pull requests opened with the default token start no other workflows, so CI does not run on them; a fine-grained token with contents and pull requests write access in the repository secret `BANK_PR_TOKEN` fixes that.

In the settings, players choose where new puzzles come from: the collection, their device, or both at random (the default). The collection also saves generating time when a puzzle is opened by an ID it contains.

## Branches and pull requests

- `main` is the stable branch and is deployed. Nobody pushes to it directly.
- `dev` is optional, for testing.
- Every feature or fix gets its own branch off `origin/main` (`feature/<name_in_snake_case>`, or `fix/<name>`) and one pull request against `main`. Keep each pull request to one feature or fix.
- A change that builds on an open pull request (or touches the same lines) branches off that pull request's branch and uses it as its base; the description names the pull request it builds on. Once the base is merged, the pull request is retargeted to `main`.
- CI runs lint, type checks, unit tests and browser tests on every push and pull request, whatever its base.
- The `Soak test` workflow plays a long session every night (or by hand) and checks that nothing leaks: memory, DOM nodes (also detached ones), listeners, timers, animation frames, observers, object URLs, workers and storage. A failed night opens an issue; the run's artifacts hold the measurements of every round.

## Deployment

Both deploy workflows only publish the newest commit of their branch: a newer push cancels a run that is still in progress, and each run checks again right before going live, so a run for an older commit never replaces a newer site.

### GitHub Pages (static, no server features)

1. In the repository settings under **Pages**, set the source to **GitHub Actions**.
2. Push to `main`. The `Deploy to GitHub Pages` workflow builds with `BASE_PATH=/<repository name>` and publishes the site.

Without a server the app keeps everything in the browser; the player page and the online leaderboard say that the server is not available.

### Cloudflare Workers (with server features)

One-time setup:

1. Create the database: `npx wrangler d1 create vibe-puzzles`.
2. Add the repository secrets `CLOUDFLARE_API_TOKEN` (with Workers and D1 edit permissions), `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_D1_DATABASE_ID` (the ID printed in step 1).
3. Set the repository variable `CLOUDFLARE_DEPLOY` to `true` to deploy on every push to `main`, or run the `Deploy to Cloudflare Workers` workflow by hand.

#### Server puzzles

The Cloudflare deployment hands out puzzles from the server (`SERVER_PUZZLES` is `"true"` in `wrangler.jsonc`). The server never generates a puzzle itself: it only uses the pre-generated collection in `static/puzzles`, which is deployed with the app. That keeps every request well within the CPU limits of the Workers free plan.

- A signed-in player gets a random collection puzzle they have not had yet, with a ticket. The puzzle ID is shown only after the puzzle is solved.
- Daily, weekly and monthly specials come from the collection too: the `Grow puzzle collection` workflow stores the puzzle of each coming period ahead of time (about 400 days, 60 weeks and 14 months).
- A ranked time is measured by the server, from issuing the puzzle to receiving the correct answer.
- Only server-issued puzzles are ranked. Puzzles opened by ID or shared links still work but are not ranked.
- If the collection has no puzzle for a type, the server says so and the browser generates one; that game is not ranked.

Because the collection is public, a determined player can look a puzzle up in it or feed it to a solver program; the server clock still keeps ranked times honest about when the puzzle was handed out.

The server deletes old tickets once a day (a cron trigger in `wrangler.jsonc`): unsolved ones 45 days after they were issued, solved ones 7 days after the solve. A game whose ticket is gone can still be solved, but is not ranked.

To deploy from a local machine instead, put the database ID into `wrangler.jsonc` and run `npm run cf:deploy`.

### API

| Method         | Path              | Purpose                                        |
| -------------- | ----------------- | ---------------------------------------------- |
| GET            | `/api/health`     | Server availability                            |
| POST/GET/PATCH | `/api/player`     | Register, look up (by token), rename           |
| GET/PUT        | `/api/saves/:key` | Load and store a saved game (newest wins)      |
| POST           | `/api/puzzles`    | Puzzle from the collection (`SERVER_PUZZLES`)  |
| POST           | `/api/scores`     | Submit a solve; the server verifies the answer |
| GET            | `/api/scores`     | Leaderboard for a game and variant             |

Players authenticate with a random token (the sync code); only its SHA-256 hash is stored. Submitted answers are always checked on the server. Without `SERVER_PUZZLES` the solve times come from the client, so leaderboards are easy to cheat; with it, times are measured by the server, though a player can still feed a puzzle to a solver program.

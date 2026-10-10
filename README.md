# Vibe Puzzles

[![CI](https://github.com/FionaPreroll/vibe-puzzles/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FionaPreroll/vibe-puzzles/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/FionaPreroll/vibe-puzzles/graph/badge.svg?branch=main)](https://codecov.io/gh/FionaPreroll/vibe-puzzles)

A collection of logic puzzles that runs in the browser, in English and German. Every puzzle has a unique solution; puzzles are generated on the device or taken from a pre-generated collection.

- **Tetroid**: shade one tetromino in every region so that all shaded cells connect, no 2×2 block is shaded and equal tetrominoes never touch.
- **Pinwheel**: divide the grid into regions with one circle each, every region point-symmetric around its circle.
- **Sudoku**: fill the 9×9 grid so that every row, column and 3×3 box holds the digits 1 to 9 once.
- **Calcudoku**, a mode of Sudoku: 5×5, 7×7 or 9×9 without boxes; every row and column holds each digit once, and the digits of each cage give its target with its operation (+, −, ×, ÷).

Built with SvelteKit 3, Svelte 5, TypeScript and Tailwind CSS 4. The optional server runs on Cloudflare Workers with D1.

## Features

- **Puzzles**: deterministic generators, so a puzzle ID (shown under the board) gives the same puzzle on every device. Normal and hard puzzles in several sizes (Sudoku and Calcudoku also easy), plus daily, weekly and monthly specials.
- **Playing**: undo and redo, checkpoints, notes (Sudoku; Space switches between digits and notes), timers, error highlighting, zoom, keyboard and touch controls ("?" lists the shortcuts), print and share. An interactive tutorial puzzle on the first visit of each game.
- **Hints** in every game, in two stages: the Hint button (key H) first tints where to look (a box, a cage, a region) and names the rule, without the result; pressing it again (or "Show the step") points at what follows from the player's marks (Tetroid: cells to shade or cross; Sudoku and Calcudoku: a digit and why it goes there; Pinwheel: edges that need a line). Marks that do not match the solution are shown at once. On hard Tetroid and Pinwheel puzzles, where no rule decides a cell, the hint tries a placement and shows that it fails. A game with a hint counts as solved, but its time is no best time and it is not ranked; sharing the solve says how many hints it took. A setting hides the button (turned on mid-game, the game stays hinted). Sudoku's "Paint wrong digits red" compares every digit with the solution, so it counts as a hint too: once per puzzle, as soon as it is on before the puzzle is solved (the settings say so). A setting does this with `countsAsHint`.
- **Puzzle collection**: a growing set of pre-generated puzzles (see [Puzzle collection](#puzzle-collection)). Players choose between the collection, puzzles generated on their device, or both at random (the default).
- **Appearance**: English and German, picked from the browser language and switchable in the header. Night mode for the whole site including the boards; it follows the system's colour scheme until switched in the header. Screenshots and prints stay light.
- **Offline**: installable as an app (PWA) and playable offline after the first visit. Files of the puzzle collection are cached when a puzzle type first needs them and kept across app updates; offline, a type without a cached file gets puzzles generated on the device.
- **Your data**: progress, settings and statistics (solves, streaks, best and average times) stay in the browser. The About page exports them to a backup file and imports it again; the file format is published as a JSON Schema (`static/backup.schema.json`).
- **Optional server**: anonymous players with a name, games and settings synced across devices with a sync code, server-issued puzzles and online leaderboards. Without it, everything else works the same.

## Development

Requires Node 24 and pnpm. The pnpm version is pinned in the `packageManager` field of `package.json`; any installed pnpm (e.g. from `npm install -g pnpm`) switches to it on its own.

```sh
pnpm install
pnpm dev            # dev server without the API
pnpm cf:dev         # build and run with the API and a local D1 database
pnpm lint           # prettier and eslint (pnpm format fixes the formatting)
pnpm check          # svelte-check and type checks of the worker and service worker
pnpm test           # unit tests (pnpm test:unit watches, pnpm test:coverage measures coverage); *.fuzz.test.ts feed the API, game logic and storage random input (FUZZ_RUNS, FUZZ_SEED)
pnpm test:e2e       # browser tests
pnpm test:server    # browser tests against the server: a ranked solve and the leaderboard, sync between devices, settings, offline start
pnpm test:soak      # long play sessions (desktop, phone): nothing leaks (SOAK_ACTIONS=600, SOAK_SEED)
pnpm test:perf      # generator, page load and move latency budgets (PERF_BUDGET_SCALE=1)
pnpm bank:grow      # add puzzles to the collection (--per-variant N --max-minutes M)
pnpm bank:regrade   # replace collection puzzles that miss their type's difficulty
```

The browser tests need Chromium: run `pnpm exec playwright install chromium` once, or point `CHROMIUM_PATH` at an installed Chromium.

pnpm settings live in `pnpm-workspace.yaml`. pnpm runs the install scripts of dependencies only when they are listed under `allowBuilds` there, and fails the install for any other dependency that has one; decide for each new one whether it needs its script.

## Project layout

```
src/lib/core/            shared types, seeded RNG, puzzle IDs, settings, collection format, board colours
src/lib/games/<id>/      one folder per game: rules, solver, generator, logic, Board.svelte, index.ts
src/lib/games/logic.ts   registry of game logic (used by the client and the server)
src/lib/games/index.ts   registry of game modules (logic plus UI)
src/lib/client/          browser-side storage and its keys, backup, API client, game session, generator web worker
src/lib/components/      game shell, tutorial and dialogs
src/lib/i18n/            translations (en.ts is the reference, de.ts must have the same keys)
src/service-worker/      offline cache
src/routes/              pages: home, games, statistics (scores), player, about
static/puzzles/          the puzzle collection, one folder per game and puzzle type
static/backup.schema.json   JSON Schema of the backup file
scripts/                 grow-puzzle-bank.ts, collection.ts (collection files), licenses.ts (licence notices)
worker/                  Cloudflare Worker: REST API and storage
migrations/              D1 schema
e2e/                     browser tests
e2e-server/              browser tests against the server
e2e-load/, perf/         soak and performance tests
docs/                    technical documentation (generators.md: how puzzles and their difficulty are made)
```

### Adding a game

1. Create `src/lib/games/<id>/` with a `settings.ts` (the game's settings, `withCommon([...])`, and the type of their keys), a `logic.ts` exporting a `GameLogic` (variants, generator, solution counter, difficulty rating, state encoding, answer check) and an `index.ts` exporting a `GameModule` (name, tools, settings, an optional tutorial puzzle, an optional `hint` for the Hint button and a `Board.svelte` component). The puzzle type extends `BasePuzzle` (`width`, `height`); both take the settings' key type as their third parameter, so the board's `settings` only has the common settings and the game's own.
2. Take every board colour from `src/lib/core/palette.ts` (`colours.<name>`), never a colour literal: that is how boards follow night mode and keep screenshots and prints light. A unit test rejects colour literals in boards and checks the contrast of the palette's colour pairs in both themes.
3. Add the texts (tagline, rules, notes, control hints, tutorial steps) under `games.<id>` in every file in `src/lib/i18n/`.
4. Register the logic in `src/lib/games/logic.ts` and the module in `src/lib/games/index.ts`.
5. Generators must be deterministic for a seed and must not depend on time, so puzzle IDs work everywhere. [docs/generators.md](docs/generators.md) describes how the existing generators build unique puzzles and grade their difficulty. Pin a few IDs of each new generator setting in `src/lib/games/generator-ids.test.ts` (a test fails until every setting is pinned).
6. Only ever append new puzzle types to a game's variant list (at most 16): a puzzle ID stores the type's position in the list, so moving or inserting one changes every ID, save, link and leaderboard entry. A unit test pins the order.

## Puzzle collection

### Layout

`static/puzzles/<game>/<type>/` holds pre-generated puzzles with their IDs; `scripts/collection.ts` reads and writes this layout.

- A regular type is split into chunks of 100 puzzles (`0000.json`, `0001.json`, …) in the order they were added, with an `index.json` listing the IDs of each chunk. New puzzles fill the last chunk, so full chunks never change.
- `puzzles/sizes.json` holds the number of puzzles of every regular type. The app and the server bundle it at build time, so a random pick loads one chunk and no index: it takes a puzzle from that chunk that the device (or, on the server, the player) has not had yet, and tries another chunk if every one in it was played. Opening a puzzle by its ID (links, history) loads the index and one chunk, or generates the puzzle on the device when the ID is not in the collection.
- A regular type holds at most 5000 puzzles (`MAX_PER_TYPE` in `src/lib/core/bank.ts`), which bounds its index at about 50 KB (25 KB compressed). Daily, weekly and monthly types have no cap; the calendar bounds them. A puzzle ID is a seed, so nothing is lost at the cap: other puzzles are generated on the device.
- A device remembers every collection puzzle it played, up to the cap of 5000 per type (about 55 KB in the browser's storage at most), so it sees no puzzle twice until it has played all of a type; then it generates new ones on the device.
- Special types keep one file per month (daily) or year (weekly, monthly), e.g. `daily/2026-10.json`.

The collection also saves generating time when a puzzle is opened by an ID it contains.

### Growing it

The `Grow puzzle collection` workflow runs every Monday, or by hand with the number of new puzzles per type and a time limit.

1. It stores the special puzzles of the coming periods first.
2. Then it adds puzzles with fresh random seeds to every type in turns, so a time limit still leaves each type with new puzzles. A type at the cap of 5000 gets none; its turns go to the others. The run ends by updating `puzzles/sizes.json`. Each puzzle is checked for a unique solution and for its type's difficulty before it is stored; a seed that fails is skipped, which changes no ID.
3. It proposes the new puzzles in a pull request against `main` from the branch `feature/grow_puzzle_collection`. While that pull request is open, later runs add to it, and it merges itself once CI passes (auto-merge).

The unit tests check every stored puzzle again (valid, one solution, the difficulty of its type): on `main` all of them, in a pull request only the collection files it changes, unless it changes the game logic (`src/lib/games`, `src/lib/core`). Locally, `BANK_TEST_SINCE=origin/main pnpm test` does the same. Special puzzles of periods before `DIFFICULTY_CHECKED_FROM` (`scripts/collection.ts`) are exempt from the difficulty check: they were stored before the generators were fixed and may have been played. `pnpm bank:regrade` replaces puzzles that miss their difficulty with new ones in their place, for example after a generator change (see [docs/generators.md](docs/generators.md#changing-a-generator)).

### Repository settings it needs

- **Allow GitHub Actions to create and approve pull requests** (Settings, Actions, General).
- A fine-grained token with contents and pull requests write access in the repository secret `BANK_PR_TOKEN`. Pull requests opened with the default token start no other workflows, so CI would not run on them.
- **Allow auto-merge** (Settings, General) and a branch protection rule on `main` with required status checks for auto-merge to wait for.

## Branches and pull requests

- `main` is the stable branch and is deployed. Nobody pushes to it directly.
- `dev` is optional, for testing.
- Every feature or fix gets its own branch off `origin/main` (`feature/<name_in_snake_case>`, or `fix/<name>`) and one pull request against `main`. Keep each pull request to one feature or fix.
- A change that builds on an open pull request (or touches the same lines) branches off that pull request's branch and uses it as its base; the description names the pull request it builds on. Once the base is merged, the pull request is retargeted to `main`.

## Continuous integration

- **CI** runs on every push to `main` and `dev` and on every pull request, whatever its base: lint and type checks, unit tests with coverage (reported to Codecov), browser tests and the server tests. Coverage counts the TypeScript modules; Svelte components and the service worker are covered by the browser tests.
- **Soak test** plays a long session every night (or by hand) and checks that nothing leaks: memory, DOM nodes (also detached ones), listeners, timers, animation frames, observers, object URLs, workers and storage. A failed night opens an issue, or comments on the one still open; the run's artifacts hold the measurements of every round.
- **Grow puzzle collection**: see [Growing it](#growing-it).
- **Deploy to GitHub Pages** and **Deploy to Cloudflare Workers**: see [Deployment](#deployment).

## Deployment

Both deploy workflows only publish the newest commit of their branch: a newer push cancels a run that is still in progress, and each run checks again right before going live, so a run for an older commit never replaces a newer site.

### GitHub Pages (static, no server features)

1. In the repository settings under **Pages**, set the source to **GitHub Actions**.
2. Push to `main`. The `Deploy to GitHub Pages` workflow builds with `BASE_PATH=/<repository name>` and publishes the site.

Without a server the app keeps everything in the browser; the player page and the online leaderboard say that the server is not available. The workflow builds with `HAS_SERVER=false`, so the app never asks for one.

### Cloudflare Workers (with server features)

One-time setup:

1. Create the database: `pnpm exec wrangler d1 create vibe-puzzles`.
2. Add the repository secrets `CLOUDFLARE_API_TOKEN` (with Workers and D1 edit permissions), `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_D1_DATABASE_ID` (the ID printed in step 1).
3. Set the repository variable `CLOUDFLARE_DEPLOY` to `true` to deploy on every push to `main`, or run the `Deploy to Cloudflare Workers` workflow by hand.

To deploy from a local machine instead, put the database ID into `wrangler.jsonc` and run `pnpm cf:deploy`.

### Connection defaults

The connection button in the header (a cloud) shows whether the server answers and how fast. Its menu switches offline mode, syncs by hand and turns the update check on or off. A player's choice is kept on that device only. The build sets the defaults with these environment variables (`true`/`false`, also `1`/`0`, `yes`/`no`, `on`/`off`):

| Variable               | Default | Effect                                                                                                  |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `HAS_SERVER`           | `true`  | `false`: the build has no server, so the app never calls the API (the GitHub Pages workflow sets this). |
| `DEFAULT_OFFLINE_MODE` | `false` | `true`: offline mode is on until the player switches it off.                                            |
| `DEFAULT_UPDATE_CHECK` | `true`  | `false`: the app does not look for new versions by itself until the player switches it on.              |

So a Cloudflare build syncs by default, and a GitHub Pages build never calls an API.

- **Offline mode** sends nothing by itself: no health check, no sync, no score uploads, no update checks, and the service worker serves pages from its cache (a puzzle file that is not cached is generated on the device instead). **Sync now** in the menu still sends what waits and fetches the open game and its settings, once per tap; **Check now** looks for a new version.
- **Outbox**: saves and settings that could not be uploaded (no connection, a server error, or offline mode) wait in local storage, newest version per key, and go out when the device is back online, the page is shown again, the server answers again, or on **Sync now**. Solves timed on the device wait the same way; a solve of a server-issued (ranked) puzzle does not, because the server measures its time up to the moment the answer arrives.
- **Update check**: while online, the app asks for `_app/version.json` every 30 minutes and when the page is shown again (at most every 5 minutes) and offers to reload when there is a new version.

## Server

### Server puzzles

The Cloudflare deployment hands out puzzles from the server (`SERVER_PUZZLES` is `"true"` in `wrangler.jsonc`). The server never generates a puzzle itself: it only uses the pre-generated collection in `static/puzzles`, which is deployed with the app. That keeps every request well within the CPU limits of the Workers free plan.

- A signed-in player gets a random collection puzzle they have not had yet, with a ticket. The puzzle ID is shown only after the puzzle is solved.
- Daily, weekly and monthly specials come from the collection too: the `Grow puzzle collection` workflow stores the puzzle of each coming period ahead of time (about 400 days, 60 weeks and 14 months).
- A ranked time is measured by the server, from issuing the puzzle to receiving the correct answer.
- Only server-issued puzzles are ranked. Puzzles opened by ID or shared links still work but are not ranked.
- A game solved with a hint is not ranked either (`hinted` in the submission).
- If the collection has no puzzle for a type, the server says so and the browser generates one; that game is not ranked.

Because the collection is public, a determined player can look a puzzle up in it or feed it to a solver program; the server clock still keeps ranked times honest about when the puzzle was handed out.

The server deletes old tickets once a day (a cron trigger in `wrangler.jsonc`): unsolved ones 45 days after they were issued, solved ones 7 days after the solve. A game whose ticket is gone can still be solved, but is not ranked.

### API

| Method         | Path              | Purpose                                        |
| -------------- | ----------------- | ---------------------------------------------- |
| GET            | `/api/health`     | Server availability                            |
| POST/GET/PATCH | `/api/player`     | Register, look up (by token), rename           |
| GET/PUT        | `/api/saves/:key` | Load and store a saved game (newest wins)      |
| POST           | `/api/puzzles`    | Puzzle from the collection (`SERVER_PUZZLES`)  |
| POST           | `/api/scores`     | Submit a solve; the server verifies the answer |
| GET            | `/api/scores`     | Leaderboard for a game and variant             |

### Security

- Players authenticate with a random token (the sync code); only its SHA-256 hash is stored.
- Requests that add rows to the database are rate limited on Cloudflare (`ratelimits` in `wrangler.jsonc`): registering a player to 5 per minute per client address, `POST /api/puzzles` to 30 per minute per player. Above that the API answers 429.
- Submitted answers are always checked on the server. Without `SERVER_PUZZLES` the solve times come from the client, so leaderboards are easy to cheat; with it, times are measured by the server, though a player can still feed a puzzle to a solver program.

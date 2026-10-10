# Puzzle generators

How the four generators build puzzles, guarantee a unique solution and set the difficulty. Code: `src/lib/games/<game>/generator.ts` (Calcudoku: `src/lib/games/sudoku/calc/generator.ts`), with the solvers next to them.

## Common ground

### Puzzle IDs and seeds

A puzzle ID encodes the puzzle type and a generator seed (`src/lib/core/variants.ts`):

```
id = seed × 16 + variantIndex        seed in [1, 2^26), variantIndex in [0, 16)
```

`variantIndex` is the type's position in the game's variant list, which is why new types may only be appended. Special puzzles use a seed derived from game, kind and period (`specialSeed`: FNV-1a hash of `"<game>:<kind>:<period>"`), so every player gets the same daily, weekly and monthly puzzle.

### Determinism

The same ID must give the same puzzle on every device, in every browser and on the server:

- All randomness comes from `Rng` (`src/lib/core/rng.ts`, mulberry32 seeded with the puzzle seed). Nothing reads `Math.random`, the clock or the platform.
- Budgets are counted in search nodes, iterations and attempts, never in time, so a slow device does not cut a search short where a fast one finishes it.
- Changing a generator, a solver it calls or even the order in which it draws random numbers changes the puzzle behind existing IDs. Shared links and leaderboard entries then point at a different puzzle, and the collection (`static/puzzles`) no longer matches what devices generate for the same ID. `src/lib/games/generator-ids.test.ts` pins a few IDs of every generator setting, so such a change fails loudly; treat it like a format migration (see [Changing a generator](#changing-a-generator)).

### Where generation runs

- In the browser, `src/lib/client/generate.ts` runs generators in a Web Worker (on the main thread if workers are blocked), caches a prefetched next puzzle, and gives up after 180 s (`GENERATE_TIMEOUT_MS`), which only catches a generator that never finishes.
- `scripts/grow-puzzle-bank.ts` runs the same generators to fill the collection, checks each puzzle for a unique solution and for its type's difficulty (`fitsDifficulty`) again, and stores it under its ID. A seed that fails a check is skipped.
- The server never generates; it hands out collection puzzles.

### The shared recipe

Every generator follows the same three steps:

1. **Build a solution** at random: a filled grid, a set of tetrominoes, a partition into regions.
2. **Make it unique.**
   - Sudoku goes the other way round: it starts from the full grid and removes givens only while a logical solver still solves the puzzle, which proves the solution unique.
   - Calcudoku, Tetroid and Pinwheel use a complete solver (propagation plus backtracking) to look for a second solution, with `limit: 2` and a node budget. While it finds one, the generator changes the puzzle where the two solutions differ (a cell becomes its own cage, a cell moves to another region, a galaxy is split) and tries again. A search that runs out of nodes discards the attempt.
3. **Grade it.** A logical solver that never guesses replays the puzzle with a limited set of techniques. The difficulty is the weakest set of techniques that solves it. Easy and normal Sudoku and normal Tetroid are right by construction: their last step already uses that logical solver (Sudoku digs with singles only; Tetroid reshapes regions until propagation solves the puzzle). Otherwise, if the result does not match the requested difficulty, the generator starts a new attempt with the same `Rng` (so still deterministic), up to an attempt limit, and then keeps the best or first puzzle it found (see [Fallbacks](#fallbacks)).

Each game's `GameLogic.fitsDifficulty(puzzle, variant)` applies the same rating to any stored puzzle; the collection script and tests use it.

## Difficulty at a glance

| Game      | Easy                                       | Normal                                                                     | Hard                                                                         |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Sudoku    | Singles only, at least 36 givens           | Singles only, as few givens as singles allow                               | Needs locked candidates or naked/hidden pairs or triples; never guessing     |
| Calcudoku | Cage arithmetic and line eliminations only | Also hidden singles and naked pairs in lines (may need them, need not)     | Needs hidden singles or naked pairs; never guessing; larger cages, fewer − ÷ |
| Tetroid   | –                                          | Solvable by propagation with the connectivity look-ahead, without guessing | Not solvable without guessing                                                |
| Pinwheel  | –                                          | Solvable by propagation alone                                              | Not solvable without case analysis                                           |

Specials use these levels too: Sudoku and Tetroid daily normal, weekly and monthly hard; Pinwheel all three hard.

## Sudoku

`generateSudoku(size, difficulty, seed)` in `src/lib/games/sudoku/generator.ts`.

1. **Solution**: `solveSudoku` on an empty grid with the `Rng` shuffling the digit order at each branch: a random valid grid.
2. **Digging** (`dig`): visit cell pairs that are point-symmetric to each other (`i` and `n − 1 − i`) in random order and remove both givens if the puzzle stays solvable by `ratePuzzle` up to `maxLevel`. Being solvable by logic also proves the solution unique, so no search is needed while digging. Givens stay point-symmetric.
3. **Difficulty**:
   - _Easy_ digs with singles only and stops removing at 36 givens (`EASY_GIVENS`, scaled for smaller grids), so there are always several obvious next steps.
   - _Normal_ digs with singles only, as far as it gets.
   - _Hard_ digs allowing subsets, then accepts the puzzle only if singles alone do not solve it. About one attempt in eight does, so it tries up to 200 solutions (`HARD_ATTEMPTS`; with 30, about 1 seed in 60 ran out) and otherwise keeps the one that needs the most (hard first, then fewest givens).

**Rating solver** (`ratePuzzle` in `solver.ts`) works with pencil marks the way a person does: naked and hidden singles first; only when none is left, locked candidates (pointing and claiming) and naked and hidden subsets of two or three. `Level.Singles` and `Level.Subsets` are the two levels.

**Complete solver** (`solveSudoku`): backtracking over row, column and box bit masks, always branching on the empty cell with the fewest candidates.

**Hints** (`sudokuHint` in `hint.ts`) start from the player's board: the digits rule out their peers, and a cell with notes keeps only the noted digits. Wrong digits, and notes that leave out the right digit, come first. Otherwise the hint looks for a single: a hidden single in a box, then in a row or column, then a naked single. Without one it applies the eliminations of `ratePuzzle` (locked candidates, then naked, then hidden subsets) one at a time until a single shows up, and names the hardest one it needed. Following the hints solves every easy, normal and hard puzzle, since they use the techniques that grade them. Calcudoku has no hints yet (`hintsFor`).

## Calcudoku

`generateCalc(n, difficulty, seed)` in `src/lib/games/sudoku/calc/generator.ts`; the Sudoku game shows the result as a board with cages and no givens.

1. **Solution**: a random Latin square (`randomLatinSquare`: the complete solver on an empty puzzle with shuffled digits).
2. **Cages** (`partition`): grow connected groups from random start cells, with sizes drawn from the difficulty's weights (`PROFILES[difficulty].sizes` for sizes 1, 2, 3, 4). Hard allows no single cells; a leftover single joins a neighbouring cage of fewer than four cells, if there is one.
3. **Operations** (`makeCage`): one cell shows its digit (`=`). Two cells get − or ÷ with the profile's probability (`diffDivShare`, ÷ only when it divides evenly), otherwise + or ×. Larger cages get + (60 %) or ×.
4. **Unique** (`makeUnique`): if the advanced logical solver solves the puzzle it is unique. Otherwise the complete solver (`limit: 2`, 2,000 nodes) looks for two solutions; a cell where they differ is cut out as a single-cell cage (showing its digit), and the rest of its cage is split into connected pieces. Repeat until unique.
5. **Difficulty**: an attempt is accepted when it fits the profile's `maxLevel` and, for hard, needs more than `CalcLevel.Basic`, and when it has few single-cell cages (at most `n` on easy, `n / 3` otherwise). Up to 40 attempts (`ATTEMPTS`); otherwise the best one by fit, then fewest single-cell cages. If no attempt ends unique (never observed), it throws `generation failed` like the other generators.

| Profile | Cage size weights (1, 2, 3, 4) | − or ÷ on two cells | Allowed techniques | Must need advanced |
| ------- | ------------------------------ | ------------------- | ------------------ | ------------------ |
| Easy    | 1, 6, 3, –                     | 70 %                | Basic              | no                 |
| Normal  | 0.3, 5, 4, 1                   | 50 %                | Advanced           | no                 |
| Hard    | 0, 4, 4, 2                     | 30 %                | Advanced           | yes                |

**Rating solver** (`rateCalc` in `calc/solver.ts`), applied until nothing changes:

- `CalcLevel.Basic`: each cage keeps only digits that occur in some digit tuple meeting its target (cells of the cage in one line must differ), and a placed digit leaves its row and column.
- `CalcLevel.Advanced`: also hidden singles and naked pairs in rows and columns.

## Tetroid

`generateTetroid(width, height, difficulty, seed)` in `src/lib/games/tetroid/generator.ts`. The solution is planted first and the regions are drawn around it.

1. **Plant** (`plant`): place tetrominoes (L, I, T, S, in all orientations; never O) one by one at random, each touching the ones before, never forming a shaded 2×2 block and never touching a tetromino of the same type, until none fits any more. Every tetromino becomes the seed of one region.
2. **Grow regions** (`growRegions`): assign the unshaded cells to neighbouring regions by random flood fill, preferring the region where the cell opens the fewest _alternatives_. An alternative is another placement in that region that fits with all other planted tetrominoes, i.e. a second solution that differs in this region only. These are cheap to count.
3. **Unique** (`makeUnique`), up to `2 × cells` iterations:
   - While some region has alternatives, move an unshaded cell of it to a neighbouring region where that removes the most alternatives (a short tabu list keeps it from undoing recent moves; worse moves are sometimes accepted to escape dead ends). If no move helps, swap the region's planted tetromino for one of its alternatives, which reshapes the pockets around it.
   - Once no region has single-region alternatives, the complete solver (`limit: 2`, 1,500 nodes) looks for combined alternatives; a cell the other solution shades is moved to another region. Normal puzzles skip this phase and leave combined alternatives to the next step.
   - Moving an unshaded cell never invalidates the planted solution.
4. **Solvable by logic** (`makeLogical`, normal only), up to `cells` iterations: run propagation with the look-ahead (`TetroidSolver.propagated`). If every region is down to one placement, the puzzle is solved by deduction, which also proves the solution unique. Otherwise propagation is stuck: some regions still have placements besides their planted tetromino. Each of those covers an unshaded cell of its region, and moving such a cell to a neighbouring region rules it out.
   - The move prefers cells that many stuck placements share and avoids targets where the cell would open a new single-region alternative (a short tabu list again).
   - If every such cell holds its region together (moving it would split the region), another unshaded cell of a stuck region moves instead, preferably one next to them, which frees them for a later move.
   - Then propagation runs again. Most puzzles need a few dozen moves at most. An attempt that runs out of iterations or moves is discarded; about 3 in 5 attempts succeed on 6×6, more on bigger boards.
5. **Difficulty**: _normal_ is right by construction. _Hard_ must not be solved by propagation with the look-ahead: up to 100 attempts (`ATTEMPTS`); about one unique attempt in four fits on 6×6, one in two on 10×10; if none fits, the first unique puzzle (see [Fallbacks](#fallbacks)).

**Solver** (`TetroidSolver` in `solver.ts`): one domain per region, the placements of an L, I, T or S inside it. Propagation, to a fixpoint:

- Arc consistency: a placement dies when every remaining placement of a neighbouring region conflicts with it (same type touching, or a shaded 2×2 together), or when it would complete a 2×2 with cells that are certainly shaded.
- Connectivity: all certainly shaded cells must lie in one component of possibly shaded cells; placements outside it die.
- Look-ahead (`advanced`): choosing a placement must leave all certain cells connectable. At the root it runs to a fixpoint, below it once per node, since it is the expensive part.

With `branch: false` the solver stops after propagation; otherwise it branches on the region with the fewest placements left.

**Hints** (`tetroidHint` in `hint.ts`) use the same deductions one at a time, starting from the player's marks: placements that contradict a cross or miss a shaded cell are gone first. Then the simplest technique that rules out any placement runs, in this order: same shape touching, 2×2 block, a mix of both against a neighbouring region, look-ahead. After each round the hint looks for empty cells that all remaining placements of their region cover (shade) or none covers (cross), and names the region whose eliminations needed the simplest technique. Connectivity on its own is left out: the look-ahead covers it. Marks that disagree with the solution come first; when nothing follows, the hint names the region with the fewest placements as a place to start case analysis. Following the hints solves every normal puzzle, because they run the same propagation that grades it.

## Pinwheel

`generatePinwheel(width, height, difficulty, seed)` in `src/lib/games/pinwheel/generator.ts`. Centres can sit on a cell, an edge or a corner (coordinates in half cells).

1. **Partition** (`partition`): start at a free cell with few free neighbours (with some randomness), put a centre on it or on an adjacent edge or corner whose covered cells are free, and grow the galaxy by adding cells together with their mirror image through the centre, up to a random target size. Repeat until every cell belongs to a galaxy. Then let galaxies swallow single-cell galaxies in symmetric pairs (`absorbSingles`), so there are few 1×1 pieces.
2. **Unique** (`makeUnique`), up to `cells` iterations: the complete solver (`limit: 2`, 3,000 nodes) looks for a second partition; a cell where it differs is cut out of its galaxy together with its mirror, as long as the rest stays connected. The pair becomes a new galaxy (a domino if the two cells touch, two single cells otherwise).
3. **Hiding the construction**: centres are sorted in reading order before they are stored.
4. **Difficulty**: _normal_ must be solved by propagation alone; _hard_ must not be. Up to 10,000 attempts (`ATTEMPTS`), then the first unique puzzle. Puzzles that need case analysis are rare on small boards (about one unique partition in 500 on 5×5, one in 90 on 7×7, one in 17 on 10×10 and one in 3 on 15×15), but an attempt on a small board takes a fraction of a millisecond. The hard puzzles found are still varied: 200 seeds of 5×5 hard gave 177 distinct puzzles, counting rotations and mirror images as the same.

Two other ways to make hard puzzles did not help and are not used: larger galaxies (a bigger `maxSize` in `partition`) did not raise the share of hard partitions, and removing centres while the puzzle stays unique left small boards solvable by propagation.

**Solver** (`PinwheelSolver` in `solver.ts`): a domain of possible centres per cell (bitmaps cell × centre). Propagation enforces symmetry (a centre stays possible for a cell only while it is possible for the cell's mirror, and a decided cell decides its mirror) and connectivity (a cell can belong to a centre only if it reaches the centre's covered cells through cells that may also belong to it). Branching picks the cell with the fewest possible centres and tries each.

## Fallbacks

Each generator has an attempt limit, so it always ends in bounded work. When no attempt hits the requested difficulty, the puzzle may not match it:

| Generator      | Attempts | When none fits                                                 |
| -------------- | -------- | -------------------------------------------------------------- |
| Sudoku hard    | 200      | Best attempt: needs subsets if any did, then fewest givens     |
| Calcudoku      | 40       | Best attempt: fits the level, then fewest single-cell cages    |
| Tetroid normal | 100      | None: `generation failed` (never a puzzle that needs guessing) |
| Tetroid hard   | 100      | First unique puzzle, whatever its difficulty                   |
| Pinwheel       | 10,000   | First unique puzzle, whatever its difficulty                   |

The limits are far above what the measurements below need, so in practice the difficulty is always right. A returned puzzle is always valid and unique.

Until 2026-10 (issue #84), Tetroid took the first unique puzzle after its 5th attempt, Pinwheel after its 9th and Sudoku hard tried 30 solutions. Some Tetroid normal puzzles then needed guessing (5 of 12 at 20×20) and most Pinwheel hard puzzles below 15×15 did not need case analysis (2 of 40 at 5×5).

## Measurements

Measured on 2026-10-09 (commit `e88783b`, after issue #84) with each game's `fitsDifficulty`, which rates a puzzle with the generator's own solver. A puzzle counts as graded right when the rating matches its type: for Sudoku, singles only for easy and normal and subsets needed for hard; for Calcudoku, the rules in the profile table; for Tetroid and Pinwheel, solvable without guessing exactly when normal. Times are for generation alone, single-threaded on the build container (three measurements at a time), not a phone.

### Fresh puzzles (seeds 1 to N)

| Type                  | N   | Graded right | Median  | Max    |
| --------------------- | --- | ------------ | ------- | ------ |
| Sudoku 9×9 easy       | 40  | 40           | 2 ms    | 23 ms  |
| Sudoku 9×9 normal     | 40  | 40           | 3 ms    | 48 ms  |
| Sudoku 9×9 hard       | 40  | 40           | 53 ms   | 154 ms |
| Calcudoku 5×5, all    | 30  | 30 each      | ≤ 4 ms  | 55 ms  |
| Calcudoku 7×7, all    | 30  | 30 each      | ≤ 40 ms | 181 ms |
| Calcudoku 9×9 easy    | 30  | 30           | 120 ms  | 215 ms |
| Calcudoku 9×9 normal  | 30  | 30           | 201 ms  | 397 ms |
| Calcudoku 9×9 hard    | 30  | 30           | 523 ms  | 2.9 s  |
| Tetroid 6×6 normal    | 40  | 40           | 12 ms   | 262 ms |
| Tetroid 6×6 hard      | 40  | 40           | 44 ms   | 236 ms |
| Tetroid 8×8 normal    | 40  | 40           | 46 ms   | 379 ms |
| Tetroid 8×8 hard      | 40  | 40           | 55 ms   | 334 ms |
| Tetroid 10×10 normal  | 40  | 40           | 90 ms   | 657 ms |
| Tetroid 10×10 hard    | 40  | 40           | 119 ms  | 548 ms |
| Tetroid 15×15 normal  | 12  | 12           | 0.4 s   | 1.2 s  |
| Tetroid 15×15 hard    | 12  | 12           | 0.5 s   | 1.7 s  |
| Tetroid 20×20 normal  | 12  | 12           | 0.9 s   | 2.6 s  |
| Tetroid 20×20 hard    | 12  | 12           | 3.9 s   | 10.8 s |
| Pinwheel 5×5 normal   | 40  | 40           | < 1 ms  | 5 ms   |
| Pinwheel 5×5 hard     | 40  | 40           | 48 ms   | 283 ms |
| Pinwheel 7×7 normal   | 40  | 40           | 1 ms    | 10 ms  |
| Pinwheel 7×7 hard     | 40  | 40           | 24 ms   | 132 ms |
| Pinwheel 10×10 normal | 40  | 40           | 2 ms    | 17 ms  |
| Pinwheel 10×10 hard   | 40  | 40           | 12 ms   | 78 ms  |
| Pinwheel 15×15 normal | 12  | 12           | 8 ms    | 29 ms  |
| Pinwheel 15×15 hard   | 12  | 12           | 7 ms    | 90 ms  |
| Pinwheel 20×20 hard   | 6   | 6            | 101 ms  | 401 ms |

Before the fix (2026-10-08, commit `9a96875`), Tetroid missed on up to 12 of 40 per type and on 5 of 12 at 20×20 normal, Pinwheel hard below 15×15 was graded right for only 2 to 16 of 40, and Tetroid 20×20 normal took a median of 8.3 s.

### Stored collection

Every regular puzzle, and every special puzzle from `DIFFICULTY_CHECKED_FROM` on, fits its type's difficulty; `bank.test.ts` checks this whenever the collection changes. Of the 8 dailies before those dates (2026-10-07 to 2026-10-09), kept because they have been played, the 3 Pinwheel dailies miss.

### What this means

- **Every type** hits its level on fresh puzzles. Sudoku and Calcudoku did before; Tetroid normal is now right by construction, and Tetroid hard, Pinwheel hard and Sudoku hard search long enough.
- **Tetroid 20×20 normal** got much faster (median 0.9 s instead of 8.3 s), because `makeLogical` replaces most of the complete solver's work in `makeUnique`.
- **Small Pinwheel hard boards** cost the most attempts, but each is so cheap that they stay well within budget.

## Changing a generator

Any change to a generator, to a solver it calls or to the order of its random draws can change the puzzle behind existing IDs. Treat it as a migration:

1. `src/lib/games/generator-ids.test.ts` fails for the pinned IDs whose puzzle changed. Make sure only the intended ones changed, then replace their hashes in the same pull request, so the migration is visible in review.
2. What happens to existing IDs:
   - **Collection puzzles keep their puzzle.** The app loads a stored puzzle before generating one, and the server only hands out stored puzzles, so their IDs stay stable even if the generator would now make something else (only an offline device without the cached collection file generates the new puzzle). Saved games store their puzzle too.
   - **Other generated IDs** (shared links, a device's own puzzles) show the new puzzle. The server remembers the first puzzle submitted for an ID (`fingerprint` in `worker/store.ts`), so solving the new puzzle of an ID that someone solved before the change is refused as not matching its ID. Generated IDs rarely repeat (2^26 seeds per type), so this mostly concerns shared links.
3. If the rating got stricter, `pnpm bank:regrade` replaces stored puzzles that miss their type's difficulty:
   - A regular puzzle gets a new one with a fresh seed in its place, so all other puzzles keep their chunk and position. A device whose cached chunk is older than the index then simply generates the new ID, which gives the same puzzle as the stored one. The removed ID keeps working: devices generate its puzzle.
   - A special puzzle is generated again for its period (its seed is fixed), or dropped and left to on-device generation if it still misses.
   - Special puzzles of periods before `DIFFICULTY_CHECKED_FROM` (`scripts/collection.ts`) are kept even when misgraded, because players may already have solved them. Move those dates to a few days after the change will be deployed, so that no current period changes its puzzle.

The fix for issue #84 went this way. It changed all Tetroid normal puzzles and the Tetroid hard, Pinwheel and Sudoku hard seeds that used to end in a fallback; every other ID kept its puzzle. In the collection it replaced 1,569 misgraded puzzles, then generated every special again from the next day (dailies), the week in progress (weeklies) and the month in progress (monthlies) on, so that they are what the generator now makes for their IDs: 358 Tetroid dailies, 4 Pinwheel dailies and the Tetroid weekly of 2026-W41 changed.

## Tests and budgets

- Unit tests per game check uniqueness, validity, determinism and the difficulty of generated puzzles: Sudoku (9×9, and a seed whose first 30 attempts failed), Calcudoku (4×4 to 7×7), Tetroid (6×6 and 8×8 normal and hard, 10×10 normal) and Pinwheel (5×5 normal and hard, 7×7 and 10×10 hard).
- `src/lib/games/generator-ids.test.ts` pins the puzzle behind a few IDs of every distinct generator setting (rule set, size, difficulty) and checks that every setting is pinned.
- `src/lib/games/bank.test.ts` checks every stored puzzle for validity, a unique solution and its type's difficulty (special puzzles from `DIFFICULTY_CHECKED_FROM` on; see the README on `BANK_TEST_SINCE`).
- `perf/generate.perf.ts` (`pnpm test:perf`) holds median time budgets per board size over five fixed seeds: 200 ms (5×5) up to 20 s (20×20), four times as much for Calcudoku. `PERF_BUDGET_SCALE` relaxes them on slow machines.

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
- Changing a generator, a solver it calls or even the order in which it draws random numbers changes the puzzle behind existing IDs. Shared links and leaderboard entries then point at a different puzzle, and the collection (`static/puzzles`) no longer matches what devices generate for the same ID. Treat such a change like a format migration.

### Where generation runs

- In the browser, `src/lib/client/generate.ts` runs generators in a Web Worker (on the main thread if workers are blocked), caches a prefetched next puzzle, and gives up after 180 s (`GENERATE_TIMEOUT_MS`), which only catches a generator that never finishes.
- `scripts/grow-puzzle-bank.ts` runs the same generators to fill the collection, checks each puzzle for a unique solution again, and stores it under its ID.
- The server never generates; it hands out collection puzzles.

### The shared recipe

Every generator follows the same three steps:

1. **Build a solution** at random: a filled grid, a set of tetrominoes, a partition into regions.
2. **Make it unique.**
   - Sudoku goes the other way round: it starts from the full grid and removes givens only while a logical solver still solves the puzzle, which proves the solution unique.
   - Calcudoku, Tetroid and Pinwheel use a complete solver (propagation plus backtracking) to look for a second solution, with `limit: 2` and a node budget. While it finds one, the generator changes the puzzle where the two solutions differ (a cell becomes its own cage, a cell moves to another region, a galaxy is split) and tries again. A search that runs out of nodes discards the attempt.
3. **Grade it.** A logical solver that never guesses replays the puzzle with a limited set of techniques. The difficulty is the weakest set of techniques that solves it (easy and normal Sudoku are right by construction, since their digging allows singles only). If the result does not match the requested difficulty, the generator starts a new attempt with the same `Rng` (so still deterministic), up to an attempt limit, and otherwise keeps the best or first puzzle it found (see [Fallbacks](#fallbacks)).

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
   - _Hard_ digs allowing subsets, then accepts the puzzle only if singles alone do not solve it. It tries up to 30 solutions (`HARD_ATTEMPTS`) and otherwise keeps the one that needs the most (hard first, then fewest givens).

**Rating solver** (`ratePuzzle` in `solver.ts`) works with pencil marks the way a person does: naked and hidden singles first; only when none is left, locked candidates (pointing and claiming) and naked and hidden subsets of two or three. `Level.Singles` and `Level.Subsets` are the two levels.

**Complete solver** (`solveSudoku`): backtracking over row, column and box bit masks, always branching on the empty cell with the fewest candidates.

## Calcudoku

`generateCalc(n, difficulty, seed)` in `src/lib/games/sudoku/calc/generator.ts`; the Sudoku game shows the result as a board with cages and no givens.

1. **Solution**: a random Latin square (`randomLatinSquare`: the complete solver on an empty puzzle with shuffled digits).
2. **Cages** (`partition`): grow connected groups from random start cells, with sizes drawn from the difficulty's weights (`PROFILES[difficulty].sizes` for sizes 1, 2, 3, 4). Hard allows no single cells; a leftover single joins a neighbouring cage of fewer than four cells, if there is one.
3. **Operations** (`makeCage`): one cell shows its digit (`=`). Two cells get − or ÷ with the profile's probability (`diffDivShare`, ÷ only when it divides evenly), otherwise + or ×. Larger cages get + (60 %) or ×.
4. **Unique** (`makeUnique`): if the advanced logical solver solves the puzzle it is unique. Otherwise the complete solver (`limit: 2`, 2,000 nodes) looks for two solutions; a cell where they differ is cut out as a single-cell cage (showing its digit), and the rest of its cage is split into connected pieces. Repeat until unique.
5. **Difficulty**: an attempt is accepted when it fits the profile's `maxLevel` and, for hard, needs more than `CalcLevel.Basic`, and when it has few single-cell cages (at most `n` on easy, `n / 3` otherwise). Up to 40 attempts (`ATTEMPTS`); otherwise the best one by fit, then fewest single-cell cages.

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
   - Once no region has single-region alternatives, the complete solver (`limit: 2`, 1,500 nodes) looks for combined alternatives; a cell the other solution shades is moved to another region.
   - Moving an unshaded cell never invalidates the planted solution.
4. **Difficulty**: _normal_ must be solved by propagation with the look-ahead and without branching; _hard_ must not be. Up to 100 attempts; after the 5th attempt the first unique puzzle is returned whatever its difficulty (see [Fallbacks](#fallbacks)).

**Solver** (`TetroidSolver` in `solver.ts`): one domain per region, the placements of an L, I, T or S inside it. Propagation, to a fixpoint:

- Arc consistency: a placement dies when every remaining placement of a neighbouring region conflicts with it (same type touching, or a shaded 2×2 together), or when it would complete a 2×2 with cells that are certainly shaded.
- Connectivity: all certainly shaded cells must lie in one component of possibly shaded cells; placements outside it die.
- Look-ahead (`advanced`): choosing a placement must leave all certain cells connectable. At the root it runs to a fixpoint, below it once per node, since it is the expensive part.

With `branch: false` the solver stops after propagation; otherwise it branches on the region with the fewest placements left.

## Pinwheel

`generatePinwheel(width, height, difficulty, seed)` in `src/lib/games/pinwheel/generator.ts`. Centres can sit on a cell, an edge or a corner (coordinates in half cells).

1. **Partition** (`partition`): start at a free cell with few free neighbours (with some randomness), put a centre on it or on an adjacent edge or corner whose covered cells are free, and grow the galaxy by adding cells together with their mirror image through the centre, up to a random target size. Repeat until every cell belongs to a galaxy. Then let galaxies swallow single-cell galaxies in symmetric pairs (`absorbSingles`), so there are few 1×1 pieces.
2. **Unique** (`makeUnique`), up to `cells` iterations: the complete solver (`limit: 2`, 3,000 nodes) looks for a second partition; a cell where it differs is cut out of its galaxy together with its mirror, as long as the rest stays connected. The pair becomes a new galaxy (a domino if the two cells touch, two single cells otherwise).
3. **Hiding the construction**: centres are sorted in reading order before they are stored.
4. **Difficulty**: _normal_ must be solved by propagation alone; _hard_ must not be. Up to 100 attempts; after the 9th the first unique puzzle is returned whatever its difficulty.

**Solver** (`PinwheelSolver` in `solver.ts`): a domain of possible centres per cell (bitmaps cell × centre). Propagation enforces symmetry (a centre stays possible for a cell only while it is possible for the cell's mirror, and a decided cell decides its mirror) and connectivity (a cell can belong to a centre only if it reaches the centre's covered cells through cells that may also belong to it). Branching picks the cell with the fewest possible centres and tries each.

## Fallbacks

Each generator has an attempt limit, so it always returns a puzzle in bounded work. When no attempt hits the requested difficulty, the puzzle may not match it:

| Generator | Attempts  | When none fits                                              |
| --------- | --------- | ----------------------------------------------------------- |
| Sudoku    | 30 (hard) | Best attempt: needs subsets if any did, then fewest givens  |
| Calcudoku | 40        | Best attempt: fits the level, then fewest single-cell cages |
| Tetroid   | 5 of 100  | First unique puzzle, whatever its difficulty                |
| Pinwheel  | 9 of 100  | First unique puzzle, whatever its difficulty                |

The puzzle is always valid and unique; only its difficulty can be off. How often that happens is measured below.

## Measurements

Measured on 2026-10-08 (commit `9a96875`) with the generators' own rating solvers. A puzzle counts as graded right when the rating matches its type: for Sudoku, singles only for easy and normal and subsets needed for hard; for Calcudoku, the rules in the profile table; for Tetroid and Pinwheel, solvable without guessing exactly when normal. Times are single-threaded on the build container, not a phone.

### Fresh puzzles (seeds 1 to N)

| Type                  | N   | Graded right | Median  | Max    |
| --------------------- | --- | ------------ | ------- | ------ |
| Sudoku 9×9 easy       | 40  | 40           | 2 ms    | 23 ms  |
| Sudoku 9×9 normal     | 40  | 40           | 3 ms    | 24 ms  |
| Sudoku 9×9 hard       | 40  | 40           | 69 ms   | 198 ms |
| Calcudoku 5×5, all    | 30  | 30 each      | ≤ 4 ms  | 46 ms  |
| Calcudoku 7×7, all    | 30  | 30 each      | ≤ 46 ms | 229 ms |
| Calcudoku 9×9 easy    | 30  | 30           | 139 ms  | 197 ms |
| Calcudoku 9×9 normal  | 30  | 30           | 254 ms  | 394 ms |
| Calcudoku 9×9 hard    | 30  | 30           | 541 ms  | 3.0 s  |
| Tetroid 6×6 normal    | 40  | 39           | 23 ms   | 118 ms |
| Tetroid 6×6 hard      | 40  | 28           | 58 ms   | 180 ms |
| Tetroid 8×8 normal    | 40  | 40           | 78 ms   | 231 ms |
| Tetroid 8×8 hard      | 40  | 35           | 78 ms   | 266 ms |
| Tetroid 10×10 normal  | 40  | 36           | 178 ms  | 559 ms |
| Tetroid 10×10 hard    | 40  | 35           | 168 ms  | 503 ms |
| Tetroid 15×15 normal  | 12  | 10           | 1.0 s   | 2.3 s  |
| Tetroid 15×15 hard    | 12  | 12           | 0.5 s   | 2.1 s  |
| Tetroid 20×20 normal  | 12  | 7            | 8.3 s   | 13.3 s |
| Tetroid 20×20 hard    | 12  | 11           | 4.9 s   | 11.6 s |
| Pinwheel 5×5 normal   | 40  | 40           | 1 ms    | 3 ms   |
| Pinwheel 5×5 hard     | 40  | 2            | 2 ms    | 11 ms  |
| Pinwheel 7×7 normal   | 40  | 40           | 1 ms    | 6 ms   |
| Pinwheel 7×7 hard     | 40  | 7            | 4 ms    | 18 ms  |
| Pinwheel 10×10 normal | 40  | 40           | 2 ms    | 11 ms  |
| Pinwheel 10×10 hard   | 40  | 16           | 11 ms   | 42 ms  |
| Pinwheel 15×15 normal | 12  | 12           | 8 ms    | 27 ms  |
| Pinwheel 15×15 hard   | 12  | 12           | 12 ms   | 79 ms  |
| Pinwheel 20×20 hard   | 6   | 6            | 144 ms  | 484 ms |

### Stored collection (20 puzzles per type, evenly spread)

Every sampled puzzle was exactly what the generator makes for its ID. Graded right, for the types that missed:

| Type                        | Graded right |
| --------------------------- | ------------ |
| Tetroid 6×6 hard            | 13 of 20     |
| Tetroid 8×8 hard            | 18 of 20     |
| Tetroid 10×10 normal        | 15 of 20     |
| Tetroid 10×10 hard          | 15 of 20     |
| Pinwheel 5×5 hard           | 1 of 20      |
| Pinwheel 7×7 hard           | 3 of 20      |
| Pinwheel 10×10 hard         | 4 of 20      |
| Pinwheel daily (10×10 hard) | 7 of 20      |
| Sudoku 9×9 hard             | 19 of 20     |
| Sudoku monthly (hard)       | 13 of 14     |

All other types up to 10×10 had every sampled puzzle graded right; larger types were not sampled.

### What this means

- **Sudoku and Calcudoku** hit their level almost always; a hard Sudoku occasionally falls back to one that singles solve.
- **Tetroid** misses in both directions. Some _normal_ puzzles need guessing, and more so on large boards (5 of 12 at 20×20), because after five attempts the first unique puzzle is taken. Some _hard_ puzzles are solvable by logic.
- **Pinwheel hard** is mostly not hard on small boards: case analysis is rarely needed below 15×15, and after nine attempts the generator takes what it has. Most stored 5×5 to 10×10 hard puzzles, and most daily puzzles, are as easy as normal ones.

Proposed fixes are tracked in [issue #84](https://github.com/FionaPreroll/vibe-puzzles/issues/84).

## Tests and budgets

- Unit tests per game check uniqueness, validity and determinism of generated puzzles. Sudoku (9×9) and Calcudoku (4×4 to 7×7, seeds 1–3) also check the difficulty; Tetroid and Pinwheel do not yet.
- `src/lib/games/bank.test.ts` checks every stored puzzle for validity and a unique solution (see the README on `BANK_TEST_SINCE`).
- `perf/generate.perf.ts` (`pnpm test:perf`) holds median time budgets per board size over five fixed seeds: 200 ms (5×5) up to 20 s (20×20), four times as much for Calcudoku. `PERF_BUDGET_SCALE` relaxes them on slow machines.

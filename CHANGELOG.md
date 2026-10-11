# Changelog

What changes for players, newest first. The app shows this list on its About page.

Changes go under `## [Unreleased]` until they get a version; see "Changelog and versions" in the README. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Two fingers** scroll a board that is larger than the screen, and pinch to zoom it, with the touch input "Always draw" (the default). One finger still draws.

## [0.8.0] - 2026-10-11

The first version with a number of its own and this changelog. It lists what changed lately; Tetroid, Pinwheel, Sudoku with Calcudoku and Loop (early access) were all playable before.

### Added

- **Changelog** on the About page.
- **Contact address** on the About page, for questions, ideas and bugs.
- **Wrong marks** a hint finds are framed in red and stay framed until you change them or close the hint with ✕. Undo brings them back.
- **Streaks across devices**: a daily, weekly or monthly streak goes on from whichever signed-in device you solve on.
- **New daily puzzle**: a daily, weekly or monthly puzzle still open when its period ends says that the new one is out, and its button opens it.

### Changed

- **Loop hints** name the next line before any cross. The crosses a line rests on are tinted, with a sentence on why they stay empty, so a hint moves the puzzle on instead of asking for crosses first.
- **Pinwheel hints** name the next line before any cross.
- **Tetroid hints** shade cells after trying a placement that fails, where they used to name cells that stay empty.
- **Hint texts** show right below the play bar on wide screens, as wide as the board, so long ones read in full.
- **Solved specials**: the daily, weekly or monthly puzzle of the current period stays solved once solved, also on your other devices, and cannot start over.

### Fixed

- Cells under a message in the top bar take clicks again.
- The connection menu opens above messages, and says "No server" in a version without one.

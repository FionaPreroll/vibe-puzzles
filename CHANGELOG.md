# Changelog

What changes for players, newest first. The app shows this list on its About page.

Changes go under `## [Unreleased]` until they get a version; see "Changelog and versions" in the README. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Inside**: a new page, linked from the About page (and from the footer on larger screens), shows how a Sudoku is made, like a short film on the Sudoku board. The computer fills an empty grid, backing out of dead ends; it takes digits out two at a time, putting back those a person could not do without; and it solves the result the way a person does, with pencil marks, to find how hard it is. Pause it, step through it, rewind chapter by chapter or play it slower or faster. "More detail" adds the technical side, and "Another example" shows the making of another puzzle. In English and German.
- **Loop tutorial**: six short steps on a 5×5 board teach the three ideas Loop needs. A 0 has no line on any side, so the 3s next to it have lines on their other three; every dot gets two lines or none; and the loop must not close early. Then you finish the loop on your own, with the Hint button at hand. It opens on your first visit to Loop and has its button on the home page.
- **Widescreen** on tablets and phones on their side, and on desktop screens less than 1000 pixels tall: the board takes the full height of the screen, and the clock, the tools (in a grid, each with room for its name), the buttons and the puzzle types sit in a column on the left. The column folds into a narrow strip with the tools; hints and messages then show beside it. Small boards grow beyond their usual largest size. On a phone on its side the header bar hides (the logo button in the column brings it down), the column gets tighter with the tools in a grid, and the folded strip shows just their icons. Large desktop screens keep the standard layout. The settings switch between the layouts on any screen in landscape and move the column to the right, on each device; "Use game default" (the setting until you pick another) follows the game's default for your device, also when it changes.
- **Two fingers** scroll a board that is larger than the screen, and pinch to zoom it, with the touch input "Always draw" (the default). One finger still draws.

### Fixed

- **Menu ticks**: a solved daily, weekly or monthly puzzle gets its ✓ in the puzzle type menu right away, and a type solved 100 times in a row its ★, instead of only after reloading the page. A solve in another tab shows too, and the ✓ goes when a new period begins.

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

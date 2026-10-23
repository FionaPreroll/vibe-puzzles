# Changelog

What changes for players, newest first. The app shows this list on its About page.

Changes go under `## [Unreleased]` until they get a version; see "Changelog and versions" in the README. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Loop in every size**: 10×10, 15×15, 20×20 and 25×30, each Normal and Hard, and Loop's own daily (10×10 Normal), weekly (15×15 Hard) and monthly (25×30 Hard) puzzles, with their streaks and leaderboards. On the bigger boards the loop winds across the whole board, so no corner is left empty. Loop is no longer marked as early access.
- **Inside**: a new page, linked from the About page (and from the footer on larger screens), shows how a Sudoku is made, like a short film on the Sudoku board. The computer fills an empty grid, backing out of dead ends; it takes digits out two at a time, putting back those a person could not do without; and it solves the result the way a person does, with pencil marks, to find how hard it is. Pause it, step through it, rewind chapter by chapter or play it slower or faster. "More detail" adds the technical side, and "Another example" shows the making of another puzzle. In English and German.
- **How was this puzzle made?**: once you have solved a puzzle, the "More" menu opens the Inside film of how that very puzzle was made. It does so for Sudoku 9×9 Easy and Normal (the daily one too), Pinwheel 5×5 and 7×7, Tetroid 6×6 and 8×8 Normal, and Loop 5×5 and 7×7 Normal. For other puzzles, and for some older puzzles of the collection, the page says why there is no film of it and shows how a smaller one is made. There, "Another example" makes another puzzle of the same type.
- **Inside: Loop**: a fourth film shows how a Loop is made. A region of cells grows on an empty board, and its border is always one loop; a cell that would make the loop touch itself or leave a hole stays out. Every cell gets the number of loop edges around it. Then numbers come out while the rules still find the loop; where they would get stuck, the film shows how far they get, and the number goes back. Last, the rules solve the puzzle one cell or dot at a time.
- **Inside: Tetroid**: a third film shows how a Tetroid is made. Tetrominoes are planted on an empty board, and the free cells grow into regions around them. Where a region could hold a second tetromino (drawn in teal), its cells are moved or its tetromino is swapped. Then cells move until deduction alone settles every region, and the film solves the puzzle pass by pass.
- **Inside: Pinwheel**: a second film shows how a Pinwheel is made. Galaxies grow on an empty board, always a cell together with its mirror image. Then the computer looks for a second way to split the board around the centres, draws it in teal and cuts it away. Last, it tries to solve the puzzle by deduction alone, round by round, and gets stuck: that is what makes the puzzle hard.
- **Loop tutorial**: six short steps on a 5×5 board teach the three ideas Loop needs. A 0 has no line on any side, so the 3s next to it have lines on their other three; every dot gets two lines or none; and the loop must not close early. Then you finish the loop on your own, with the Hint button at hand. It opens on your first visit to Loop and has its button on the home page.
- **Widescreen** on tablets and phones on their side, and on desktop screens less than 1000 pixels tall: the board takes the full height of the screen, and the clock, the tools (in a grid, each with room for its name), the buttons and the puzzle types sit in a column on the left. The column folds into a narrow strip with the tools; hints and messages then show beside it. Small boards grow beyond their usual largest size. On a phone on its side the header bar hides (the logo button in the column brings it down), the column gets tighter with the tools in a grid, and the folded strip shows just their icons. Large desktop screens keep the standard layout. The settings switch between the layouts on any screen in landscape and move the column to the right, on each device; "Use game default" (the setting until you pick another) follows the game's default for your device, also when it changes.
- **Two fingers** scroll a board that is larger than the screen, and pinch to zoom it, with the touch input "Always draw" (the default). One finger still draws.
- **Keyboard on the board**: the list of keyboard shortcuts ("?") says how to play Tetroid, Pinwheel and Loop with the keys. The arrow keys move a cursor, and Ctrl (⌘ on a Mac) with the arrows marks cells or draws lines as dragging does.
- **Screen readers**: Tab brings the focus to the board, with a ring around it, and a screen reader says how to play it with the keys. As the cursor moves it says where it is and what lies there: "Row 3, column 4, region 2: shaded" in Tetroid, the digit or notes of a Sudoku cell (and its cage in Calcudoku), the lines and crosses at a Loop or Pinwheel dot with the numbers or circles around it, and what is marked as an error.

### Fixed

- **Accessibility**: grey texts on the About, Scores and Inside pages and next to the puzzle ID are easier to read, by night too, and links in running text are underlined. Screen readers name the daily, weekly and monthly buttons as they read on screen, size included, and so the menu button and the logo on phones. A long dialog, such as the list of keyboard shortcuts, scrolls with the keys in every browser.
- **"More" menu** in the widescreen layout: it lies over the board instead of partly hiding behind it.
- **"Creating puzzle…"** no longer gets selected like text when you drag across the board while a new puzzle is being made.
- **Menu ticks**: a solved daily, weekly or monthly puzzle gets its ✓ in the puzzle type menu right away, and a type solved 100 times in a row its ★, instead of only after reloading the page. A solve in another tab shows too, and the ✓ goes when a new period begins.
- **Loop hints** that try out an edge name the right step at the end. They asked for a line where the edge gets a cross, and the other way round.
- **Playing on two devices**: coming back to a game left open on one device continues what you played on the other one meanwhile, also once you had made moves on the first. It used to keep the older game there, and its next move overwrote the newer one.
- **Games and solves waiting to be uploaded** are no longer thrown away when the server turns the app away for a moment (too many requests, a blocked or timed-out request). The app asks again a little later and sends them then. It used to take the server for missing until the page was reloaded.
- **Sudoku auto notes** no longer count as a move. Opening a puzzle with "Fill in notes automatically" on leaves it untouched: "New puzzle" neither asks about it nor breaks your streak, it does not replace your game on another device, and undoing back to the start keeps your moves to redo. The notes still show right away.
- **Your last moves** before leaving a game, closing the page or switching to another app reach your other devices. They used to stay on this device until you played there again.
- **Recent solves** of puzzles from the server show their puzzle ID once the server tells it, and solving such a puzzle again after starting over no longer counts as a new solve or best time. A solve whose ID never came no longer links to a puzzle that does not exist.
- **Moving on right after a solve**: when the server's answer to a solve comes only after the next puzzle has opened, it no longer gives that puzzle the solved one's ID or shows its rank there.
- **A game you gave up**, with "New puzzle" or for a puzzle from a link, no longer comes back from the server when you return to the page, sync or reload, and your other devices no longer pick it up.
- **A touch the system breaks off**, for example by a swipe in from the edge of the screen or an incoming call, no longer leaves the start of a move on the board, and in Pinwheel no longer locks or unlocks a galaxy a moment later.
- **Streaks across devices** after 400 solved daily puzzles of one type: a day solved on another device counts on this one too. It used to be left out, so the streak on this device broke.
- **Leaderboards** on the Scores page belong to the game and puzzle type chosen, also after a quick switch. A late answer for the one chosen before could take their place.
- **Tetroid with the keyboard**: pressing Shift or Ctrl alone no longer changes the cell at the keyboard cursor, for example when you hold Shift to see the group under the mouse. With the arrow keys, Ctrl or Shift still mark the cells the cursor passes (Shift like a right click), from the cell it leaves on.
- **Export backup** in Safari: the app keeps the file ready until the browser has saved it. Letting go of it at once can break the download there.
- **Switching right after a move or a solve**, to another puzzle type or to a new puzzle, no longer keeps that move or solve from your other devices. A daily puzzle solved and left at once used to stay unsolved there.
- **Taking back every move** of a game, with Undo or Start over, reaches your other devices too. The moves used to come back there, since a game without moves was not uploaded.
- **A puzzle opened by link or ID** on a second device goes on where you left it on the first. It used to start afresh there, and its first move replaced your game on the other device.
- **Drawing with the keyboard**: a move drawn with Ctrl (⌘ on a Mac) or Shift and the arrow keys is dropped when you switch to another window before letting go. It used to stay on the board as a preview, and the next press of the key applied it.

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

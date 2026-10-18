/**
 * Texts of the Inside page, apart from the app's dictionaries (which every page loads): only the
 * page loads these. `de.ts` must have the same keys.
 */
const en = {
	title: 'Inside the puzzles',
	intro:
		'How does a computer make a puzzle with exactly one solution, and how does it know how hard the puzzle is? Watch it happen on a real puzzle, step by step.',
	films: {
		label: 'Films',
		sudoku: 'How a Sudoku is made',
		pinwheel: 'How a Pinwheel is made',
		tetroid: 'How a Tetroid is made'
	},
	player: {
		play: 'Play',
		pause: 'Pause',
		back: 'Back to the start of the chapter',
		next: 'Next chapter',
		stepBack: 'One step back',
		stepForward: 'One step forward',
		speed: 'Speed',
		detail: 'More detail',
		another: 'Another example',
		position: 'Position in the film',
		chapters: 'Chapters',
		step: 'Step {n} of {count}',
		keys: 'Space plays and pauses, ← and → go one step, Page Up and Page Down jump between chapters.'
	},
	sudoku: {
		chapters: {
			fill: 'A full grid',
			dig: 'Digging',
			solve: 'Solving like a person'
		},
		fill: {
			start:
				'Every Sudoku starts empty. First the computer fills the whole grid: that becomes the solution.',
			place:
				'It picks the cell where the fewest digits still fit, and one of those digits at random.',
			stuck: 'Dead end: no digit fits in the ringed cell any more.',
			back: 'So the last digit comes out again, and the next one is tried there.',
			done: 'Full: every row, column and box holds each digit once.',
			detail:
				'Backtracking search: it always branches on the empty cell with the fewest candidates. Rows, columns and boxes are bit masks, so checking a digit takes a single AND. A random number generator seeded with the puzzle ID shuffles the digits, so the same ID always gives the same grid.'
		},
		dig: {
			start:
				'Now digits come out again, two at a time: a cell and its mirror image through the centre.',
			try: 'Can a person still solve it without guessing?',
			keep: 'Yes, so they stay out. {givens} digits left.',
			restore: 'No: a person would get stuck. They go back in.',
			done: 'Every pair has been tried. {givens} digits are left: that is the puzzle.',
			detail:
				'After each removal the rating solver runs with naked and hidden singles only. If it fills the grid, every digit was forced, which also proves that the solution is unique: no search for a second solution is needed. Removing pairs keeps the givens point-symmetric.'
		},
		solve: {
			start:
				'To grade it, the computer solves the puzzle the way a person does. First it notes every digit that still fits in each cell.',
			startDetail:
				'Candidates are bit masks: a placed digit is cleared from the masks of its 20 peers in its row, column and box.',
			naked: 'Only the {digit} is left in this cell.',
			nakedDetail: "A naked single: every other digit is already in the cell's row, column or box.",
			hidden: {
				row: 'In this row, the {digit} fits in one cell only.',
				column: 'In this column, the {digit} fits in one cell only.',
				box: 'In this box, the {digit} fits in one cell only.'
			},
			hiddenDetail: 'A hidden single: no other cell of the row, column or box can take the digit.',
			done: 'Solved with {singles} singles and no guessing: a Normal Sudoku.',
			doneDetail:
				'The difficulty is the weakest set of techniques that solves the puzzle. Normal needs singles only. Hard also needs locked candidates, or naked and hidden pairs and triples.'
		}
	},
	pinwheel: {
		chapters: {
			grow: 'Galaxies grow',
			unique: 'One solution only',
			grade: 'Normal or hard?'
		},
		grow: {
			start:
				'A Pinwheel board is split into galaxies. Each one looks the same after a half turn around its centre. The computer starts with an empty 7×7 board.',
			centre:
				'A new galaxy starts at a free cell with few free neighbours. Its centre sits on a cell, an edge or a corner.',
			grow: 'It grows by a cell and its mirror image through the centre, so it stays symmetric.',
			absorb:
				'A galaxy swallows two single-cell galaxies that are mirror images of each other: fewer tiny pieces.',
			done: 'Every cell belongs to a galaxy. But is this the only way to split the board around these centres?',
			detail:
				'Centres are in half-cell coordinates, so a centre on an edge covers two cells and one on a corner four. Each galaxy grows towards a random size, and takes a free cell only together with its free mirror cell.'
		},
		unique: {
			start:
				'The player will see only the centres. The solver checks whether they allow a second way to split the board.',
			second:
				'It finds one: the ringed cells could belong to other galaxies. The teal lines show that other solution.',
			cut: 'So one of those cells is cut out together with its mirror image, and each becomes a galaxy of its own.',
			done: 'Now the solver finds no other way: the solution is unique.',
			already: 'The solver finds no other way: the solution is unique as it is.',
			detail:
				'For every cell, the solver keeps the centres it may still belong to (a bitmap). Propagation removes those that break symmetry or connection. When it gets stuck, the solver tries the options of the cell with the fewest left. It stops at the second solution, or after 3,000 search nodes.'
		},
		grade: {
			start:
				'To grade the puzzle, the solver now only deduces, without trying anything. At first {settled} cells are settled: the ones under the centres.',
			round: 'Round {round}: mirror images and connections settle {count} more cells.',
			stuck:
				'Stuck: {open} cells could still belong to more than one galaxy. Going on means trying cases, so this is a Hard puzzle.',
			solved: 'Every cell is settled by deduction alone: a Normal puzzle.',
			levels:
				'Propagation repeats two rules until nothing changes: a cell may belong to a centre only while its mirror image may too, and only if cells that may belong to the centre as well connect it to the centre. Normal puzzles are solved this way; Hard ones need case analysis.',
			attempts:
				'This was attempt {attempt}. Before it: {easy} too easy for Hard, {dropped} given up.',
			attemptsDetail:
				'Hard partitions are rare on small boards, but an attempt takes a fraction of a millisecond, so the generator simply tries again with the same random number generator, up to 10,000 times.',
			solution: 'The solution, which the player has to find from the centres alone.'
		}
	},
	tetroid: {
		chapters: {
			plant: 'Planting tetrominoes',
			grow: 'Regions grow',
			reshape: 'One way only',
			solve: 'Solving by deduction'
		},
		plant: {
			start:
				'A Tetroid solution is a chain of tetrominoes in L, I, T and S shapes, one in each region. They all connect, never form a 2×2 block, and the same shape never touches across a region border. The computer starts from an empty 6×6 board.',
			plant:
				'It plants a tetromino where it touches the ones before, makes no 2×2 block and touches no tetromino of its own shape.',
			done: 'No tetromino fits any more. Each one becomes the seed of a region; the colours show their shapes.',
			detail:
				'Every free position of every shape in every rotation is a candidate, and one of those that keep the rules is drawn at random. The planted tetrominoes are the solution: the regions are built around them.'
		},
		grow: {
			assign:
				'A free cell joins a neighbouring region: the one where it opens the fewest other ways to place a tetromino.',
			done: 'Every cell has a region. But some regions could still hold other tetrominoes.',
			detail:
				'Cells join in random order from the edges of the regions. An "other way" is a tetromino in the region that fits with all the other planted ones: a second solution that differs in this region only. These are quick to count, so each cell picks the region where it adds the fewest.'
		},
		reshape: {
			alternative:
				'This region could also hold the teal tetromino, and everything else would still fit: a second solution.',
			move: 'So a free cell moves to a neighbouring region, where it opens fewer other ways.',
			replant:
				'No move helps here. So the region gets the other tetromino instead, which changes the gaps around it.',
			alone:
				'No region has a second tetromino of its own any more. Now the computer tries to solve the puzzle by deduction alone.',
			stuck:
				'Deduction gets stuck: in the tinted cells, some regions still have more than one way.',
			logicalMove:
				'A cell those other ways need moves to a neighbouring region, which rules them out.',
			unique: 'Now deduction alone settles every region: one solution, and a Normal puzzle.',
			attempts:
				'This was attempt {attempt}: the ones before could not be made solvable by deduction.',
			detail:
				'Moving a free cell never breaks the planted solution. The move taken is the one that removes the most other ways, with a short memory of recent moves so that it does not undo them. Now and then a worse move is taken to get out of a dead end.',
			logicalDetail:
				'Propagation (see the next chapter) runs after each move. The placements it cannot rule out cover free cells of their region, and moving such a cell to a neighbour rules them out. Cells that many of them share go first.'
		},
		solve: {
			start:
				'Solving by deduction, the way the computer checks it: cells that every possible tetromino of their region covers are shaded, cells that none covers are crossed.',
			startDetail:
				'Each region keeps the list of tetrominoes that still fit in it. A cell is certain when all of them cover it, and empty when none does.',
			shapes:
				'Neighbouring regions rule out tetrominoes that would touch the same shape or make a 2×2 block. Newly decided cells: {count}.',
			shapesDetail:
				'Arc consistency: a placement goes when every placement left in a neighbouring region conflicts with it, or when it completes a 2×2 block with certain cells.',
			connect:
				'All shaded cells must connect: tetrominoes cut off from them go. Newly decided cells: {count}.',
			connectDetail:
				'All certain cells must lie in one connected area of cells that may still be shaded; placements outside it are ruled out.',
			lookAhead:
				'Looking ahead: a tetromino after which the shaded cells could no longer connect goes. Newly decided cells: {count}.',
			lookAheadDetail:
				'For each placement left, the solver checks whether all certain cells could still connect with it. This is the expensive part, so it runs only when the cheaper rules are stuck.',
			done: 'Every region is settled, without guessing: this is the solution.'
		}
	}
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type InsideDictionary = Widen<typeof en>;

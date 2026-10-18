/**
 * Texts of the Inside page, apart from the app's dictionaries (which every page loads): only the
 * page loads these. `de.ts` must have the same keys.
 */
const en = {
	title: 'Inside the puzzles',
	intro:
		'How does a computer make a puzzle with exactly one solution, and how does it know how hard the puzzle is? Watch it happen on a real puzzle, step by step.',
	films: {
		sudoku: 'How a Sudoku is made'
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
	}
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type InsideDictionary = Widen<typeof en>;

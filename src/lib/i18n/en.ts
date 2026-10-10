/** English texts. The source of truth: every other language has exactly these keys. */
const en = {
	app: {
		name: 'Vibe Puzzles',
		close: 'Close',
		language: 'Language'
	},
	/** Questions in the app's own dialog before something is lost. */
	confirm: {
		cancel: 'Cancel',
		newPuzzle: {
			title: 'Start a new puzzle?',
			text: 'Your unfinished game of this type will be lost.',
			ok: 'New puzzle'
		},
		replace: {
			title: 'Replace your unfinished game?',
			text: 'This puzzle replaces your unfinished game of the same type, which will be lost.',
			ok: 'Open anyway'
		},
		startOver: {
			title: 'Start over?',
			text: 'This clears the board and restarts the timer.',
			ok: 'Start over'
		},
		deleteCheckpoint: {
			title: 'Delete checkpoint {n}?',
			text: 'This cannot be undone.',
			ok: 'Delete'
		},
		storageFull: {
			title: 'Browser storage is full',
			text: 'Delete the unfinished games you played longest ago to make room?',
			ok: 'Delete old games'
		},
		signOut: {
			title: 'Sign out on this device?',
			text: 'Keep your sync code to sign back in.',
			ok: 'Sign out'
		},
		import: {
			title: 'Restore {count} entries from this backup?',
			text: 'Entries with the same name are overwritten.',
			ok: 'Restore'
		}
	},
	nav: {
		games: 'Games',
		scores: 'Scores',
		player: 'Player',
		dayMode: 'Switch to day mode',
		nightMode: 'Switch to night mode'
	},
	home: {
		title: 'Logic puzzles, one click away',
		intro: 'Every puzzle has exactly one solution. Pick a game to start.',
		continue: 'Continue',
		continueGame: '{game} · {variant}',
		dailyOpen: 'Daily puzzle waiting',
		dailyDone: 'Daily puzzle solved',
		streak: 'Streak {count}',
		newHere: 'New here? Each tutorial takes a minute.',
		learn: 'Learn {game}',
		play: 'Play'
	},
	game: {
		menu: '{game} menu',
		openMenu: 'Puzzle types and rules',
		closeMenu: 'Close menu',
		expandPanel: 'Expand panel',
		collapsePanel: 'Collapse panel',
		rules: 'Rules',
		controls: 'Controls',
		show: 'Show',
		hide: 'Hide',
		puzzleType: 'Puzzle type',
		size: 'Size',
		specials: 'Specials',
		puzzleId: 'Puzzle ID',
		openById: 'Open puzzle by ID',
		open: 'Open',
		scoresLink: 'Hall of fame & statistics',
		tutorial: 'Tutorial',
		zoom: 'Zoom',
		fit: 'Fit',
		resetZoom: 'Back to automatic size',
		settings: 'Settings',
		timer: 'Timer',
		pause: 'Pause',
		resume: 'Resume',
		undo: 'Undo',
		redo: 'Redo',
		hint: 'Hint',
		hintTitle: 'Hint (H): point at the next step. The puzzle then gets no best time and no rank.',
		hintMistake: 'The highlighted marks do not match the solution.',
		tools: 'Tools',
		colour: 'Colour {name}',
		touch: 'Touch input',
		touchAuto: 'Auto',
		touchDraw: 'Always draw',
		touchPan: 'Always pan',
		checkpoints: 'Checkpoints',
		save: 'Save',
		add: 'Add',
		loadCheckpoint: 'Load checkpoint {n} (right click deletes)',
		deleteCheckpoint: 'Delete checkpoint {n}',
		idLine: '{variant} · Puzzle ID',
		idHidden: 'shown once solved',
		idHiddenTitle: 'Ranked server puzzle',
		fromBank: 'from the puzzle collection',
		done: 'Done',
		startOver: 'Start over',
		print: 'Print…',
		more: 'More actions',
		share: 'Share board',
		newPuzzle: 'New puzzle',
		shareLink: 'Link to your progress:',
		screenshot: 'Screenshot (PNG)',
		closeShare: 'Close share panel',
		shareSolve: 'Share success',
		brag: 'I solved {game} {variant} (puzzle {id}) in {time}! Can you beat my time?',
		bragHint:
			'I solved {game} {variant} (puzzle {id}) in {time}, with 1 hint. Can you do it without?',
		bragHints:
			'I solved {game} {variant} (puzzle {id}) in {time}, with {count} hints. Can you do it without?',
		bragCopied: 'Copied your result and the link. Paste it anywhere to share.',
		creating: 'Creating puzzle…',
		notCreated: 'The puzzle could not be created.',
		retry: 'Try again',
		paused: 'Paused. Click to resume',
		dismiss: 'Dismiss',
		board: 'Puzzle board'
	},
	shortcuts: {
		title: 'Keyboard shortcuts',
		open: 'Keyboard shortcuts (?)',
		general: 'Game',
		undo: 'Undo',
		redo: 'Redo',
		hint: 'Hint',
		newPuzzle: 'New puzzle',
		done: 'Check the solution',
		save: 'Save checkpoint',
		add: 'Add a checkpoint',
		colourTool: 'Colour tool and back',
		escape: 'Close a menu or the zoom',
		help: 'This list',
		tools: 'Tools',
		colours: 'Colours',
		board: 'On the board',
		or: 'or'
	},
	daily: {
		next: 'New daily puzzle in {time}, at {at}'
	},
	session: {
		createFailed: 'Could not create the puzzle: {error}',
		serverFailed:
			'The server could not create a puzzle, so this one is played offline and not ranked.',
		continued: 'Continued your game from another device.',
		notSolved: 'Not solved yet. Keep going!',
		solved: 'Solved in {time}!',
		uploadFailed: 'Solved in {time}! (Score not uploaded: {error})',
		wrong: 'That is not the solution yet.',
		repeat: 'Solved in {time}! (You solved this puzzle before.)',
		ranked: 'Solved in {time}! Rank {rank} of {total} on {variant}.',
		yourBest: 'Your best is {time}.',
		unrankedPersonal: 'Solved in {time}! Personal timer: not ranked.',
		unrankedLocal: 'Solved in {time}! Not ranked: only puzzles from the server are ranked.',
		unrankedHinted: 'Solved in {time}, with a hint: not ranked.',
		expired: 'Solved in {time}! Not ranked: the server no longer keeps this old puzzle.'
	},
	difficulty: {
		easy: 'Easy',
		normal: 'Normal',
		hard: 'Hard'
	},
	special: {
		daily: 'Daily',
		weekly: 'Weekly',
		monthly: 'Monthly'
	},
	/** Rule sets of a game other than its main one. */
	mode: {
		calc: 'Calcudoku'
	},
	/** Short names for the narrow specials row of the puzzle type picker. */
	specialShort: {
		daily: 'Daily',
		weekly: 'Weekly',
		monthly: 'Monthly'
	},
	tool: {
		rotate: 'Cycle',
		black: 'Black',
		cross: 'Cross',
		blank: 'Blank',
		color: 'Colour',
		digit: 'Digit',
		note: 'Note'
	},
	swatch: ['', 'Violet', 'Red', 'Yellow', 'Green', 'Blue'],
	setting: {
		hideControls: 'Hide game controls',
		stickyToolbar: 'Keep toolbar and tools at the top while scrolling',
		autoSubmit: 'Auto submit',
		showCheckpoints: 'Show checkpoints',
		showCoordinates: 'Show board coordinates',
		hideTimer: 'Hide the timer',
		hideHint: 'Hide the hint button',
		personalTimer: 'Non-competitive (personal) timer',
		highlightErrors: 'Highlight errors',
		blueErrors: 'Use blue for errors',
		highlightLastChange: 'Highlight last change',
		solvedAnimation: 'Animate a solved puzzle',
		highlightBlock: 'Highlight current block',
		highlightGroup: 'Highlight current group of cells [Shift]',
		thickBorders: 'Thicker block borders',
		colorTetrominoes: 'Colour tetrominoes',
		autoCrossCorners: 'Auto place X on corners',
		autoCrossRegions: 'Auto place X in completed regions',
		showGrid: 'Show grid',
		continuousLine: 'Draw continuous line',
		symmetryHelper: 'Enable symmetry helper',
		blackHoles: 'Black hole in completed regions',
		autoColor: 'Auto colour completed regions',
		markMistakes: 'Paint wrong digits red',
		autoNotes: 'Fill in notes automatically',
		autoRemoveNotes: 'Remove notes ruled out by a new digit',
		highlightLines: 'Highlight row, column and box',
		highlightSame: 'Highlight the same digit',
		showRemaining: 'Show how many of each digit are left',
		digitFirst: 'Pick the digit first, then the cells (left click: digit, right click: note)'
	},
	source: {
		title: 'Where new puzzles come from',
		local: 'Generated on this device',
		bank: 'From the puzzle collection',
		mixed: 'Both, picked at random',
		note: 'The collection holds pre-made puzzles that are checked for a unique solution. Generating on this device works offline and never runs out.'
	},
	scores: {
		title: 'Hall of fame & statistics',
		game: 'Game',
		puzzleType: 'Puzzle type',
		yourStats: 'Your statistics',
		keptLocally: 'Kept on this device.',
		solved: 'Solved',
		streak: 'Current streak',
		bestStreak: 'Best streak',
		bestTime: 'Best time',
		average: 'Average',
		recent: 'Recent solves',
		bestTimes: 'Best times',
		currentPuzzle: '{variant}: current puzzle',
		noServer: 'Online leaderboards need the optional server, which this deployment does not run.',
		loading: 'Loading…',
		empty: 'No times yet. Be the first!',
		players: '{count} players',
		player: '1 player',
		you: 'You: rank {rank} with {time}',
		pickName: 'Pick a player name',
		toAppear: ' to appear here.'
	},
	player: {
		title: 'Player',
		checking: 'Checking for the server…',
		noServer:
			'This deployment has no server, so games are saved in this browser only and there are no online leaderboards. Everything else works as usual.',
		pickName: 'Pick a name',
		pickNameText:
			'Your name appears on the leaderboards. Your games and settings sync to the server so you can continue on another device. No email or password needed.',
		name: 'Name',
		start: 'Start',
		otherDevice: 'Already playing on another device?',
		otherDeviceText: 'Enter the sync code shown on that device.',
		link: 'Link device',
		rename: 'Rename',
		syncCode: 'Sync code',
		syncCodeText:
			'Enter this code on another device to continue your games there. Keep it private: it is the key to your player.',
		show: 'Show',
		hide: 'Hide',
		signOut: 'Sign out',
		unknownCode: 'Unknown sync code'
	},
	tutorial: {
		title: '{game} tutorial',
		step: 'Step {n} of {total}',
		next: 'Next',
		back: 'Back',
		finish: 'Play a real puzzle',
		skip: 'Skip tutorial',
		yourTurn: 'Your turn',
		showMe: 'Show me',
		hint: 'Stuck? Hint points at the next step, just like in a real puzzle.',
		wellDone: 'Well done!',
		solvedAll: 'You solved your first puzzle. Ready for a real one?'
	},
	pwa: {
		install: 'Install app'
	},
	update: {
		available: 'A new version is available.',
		reload: 'Reload',
		dismiss: 'Not now'
	},
	about: {
		link: 'About',
		title: 'About Vibe Puzzles',
		intro: 'Logic puzzles in the browser. Every puzzle has exactly one solution.',
		build: 'Build',
		version: 'Version',
		commit: 'Commit',
		built: 'Built',
		source: 'Source code',
		licenses: 'Licences',
		licenseText: 'Licence text of {name}',
		licensesNote: 'The app is built with these open source libraries:',
		puzzleTypes:
			'Tetroid follows the rules of LITS, Pinwheel those of Tentai Show (Galaxies), both classic puzzle types from Japan. Sudoku and its mode Calcudoku keep their usual rules.',
		privacy: 'Privacy',
		privacyLocal:
			'Your games, stats and settings are stored only in this browser (local storage). There are no cookies, no tracking and no ads.',
		privacyServer:
			'If you create a player on the server, it stores your player name, a hash of your random player code, your scores, the puzzles it issued to you and, for syncing between devices, your saves and settings. Nothing else.',
		privacyHost:
			'The site is hosted on GitHub Pages; GitHub may log technical data such as your IP address when the page loads.',
		backup: 'Backup',
		backupNote:
			'Download everything this browser stores for Vibe Puzzles as a JSON file, or restore it from such a file. The file contains your player code, so keep it private.',
		export: 'Export backup',
		import: 'Import backup',
		schema: 'File format (JSON Schema)',
		imported: 'Restored {count} entries. Reloading…',
		importFailed: 'This file cannot be restored: {error}.'
	},
	games: {
		tetroid: {
			tagline: 'Shade one tetromino in every region.',
			rules: [
				'Shade exactly one tetromino (4 connected cells) in each region.',
				'Two identical tetrominoes may not share an edge. Rotated or mirrored ones count as identical.',
				'All shaded cells form one connected area.',
				'No 2×2 block may be fully shaded.'
			],
			notes: ['So the possible shapes are L, I, T and S. The square O is ruled out by rule 4.'],
			toolHint: {
				rotate:
					'Each click on a cell steps it from empty to shaded to cross and back. Right click goes the other way.',
				black: 'Click a cell to shade it, click again to clear it. Right click sets a cross.',
				cross: 'Click a cell to mark it with a cross: it stays unshaded. Click again to remove it.',
				blank: 'Clears every cell you click or drag over.'
			},
			controlsMouse:
				'Click a cell to shade it, right click to place a cross. Drag to paint several cells. Keys 1–4 pick a tool.',
			controlsTouch:
				'Tap a cell to cycle through shaded, cross and empty. Hold a moment, then drag to paint several cells.',
			/** What the hint button says: why tetrominoes are ruled out, then what follows. */
			hints: {
				region:
					'Look at which tetrominoes still fit in this region, given its shape and your marks.',
				sameShape:
					'Rule out tetrominoes that would touch an identical one: everything left in a neighbouring region has that shape.',
				square: 'Rule out tetrominoes that would complete a shaded 2×2 block.',
				neighbour:
					'Rule out tetrominoes that clash with everything left in a neighbouring region: each option there would touch an identical shape or complete a 2×2 block.',
				lookAhead:
					'Rule out tetrominoes that would cut the shaded cells apart: ask whether everything could still connect if the tetromino went there.',
				shade: 'Every tetromino left in this region covers the highlighted cells: shade them.',
				cross: 'No tetromino left in this region covers the highlighted cells: they stay empty.',
				stuck:
					'No rule decides a cell here. Hard puzzles need case analysis: put a tetromino in the highlighted region in your head and follow it until a rule breaks.'
			},
			tutorial: [
				{
					text: 'Each region with a thick border needs exactly one tetromino: four shaded cells joined along their sides. There are four shapes, I, L, T and S, which may be turned or mirrored. The top-left region is already done: it holds an S, and crosses mark its empty cells. Just look for now: you start shading in step 2.'
				},
				{
					text: 'The region at the top right has exactly four cells, so its tetromino fills it completely.',
					task: 'Shade all four cells of that region.',
					done: 'Done: that tetromino is an L. This works in bigger regions too: a cell that every tetromino still possible there covers is always shaded.'
				},
				{
					text: 'No 2×2 block may be fully shaded. The two marked cells each sit next to three shaded cells of a 2×2 block, so shading them would complete it.',
					task: 'Mark both cells with a cross: pick the Cross tool (✕) and click or tap them. A cross means the cell stays empty.',
					done: 'Right: these cells stay empty, and you have ruled them out for good.'
				},
				{
					text: 'Two more rules. All shaded cells together form one connected group. And two tetrominoes of the same shape may not touch across a region border; turned or mirrored ones count as the same shape. So an L on the marked cell is ruled out: it would touch the L above it.'
				},
				{
					text: 'Two regions are left: the one at the bottom and the big one on the right. Use the rules from the steps before. Cells that break a rule turn red.',
					task: 'Shade one tetromino in each of the two regions.'
				}
			]
		},
		pinwheel: {
			tagline: 'Split the grid into regions that look the same upside down.',
			rules: [
				'Split the grid along its lines into regions with exactly one circle each.',
				'Each region is symmetric around its circle: turned by 180° around it, the region covers itself exactly.',
				'Lines only separate different regions, never two cells of the same one.'
			],
			notes: [],
			tool: { black: 'Line' },
			toolHint: {
				rotate:
					'Each click on an edge steps it from empty to line to cross and back. Right click goes the other way.',
				black: 'Click an edge to draw a line, click again to remove it. Right click sets a cross.',
				cross:
					'Click an edge to mark it with a cross: no line goes there. Click again to remove it.',
				blank: 'Clears every edge you click or drag over.',
				color: 'Colours a cell in the chosen colour. Click a coloured cell to clear it.'
			},
			controlsMouse:
				'Click between dots to draw a line, right click to set a cross, Shift+click to colour a cell. Right click a circle to lock a finished region.',
			controlsTouch:
				'Tap between dots to draw a line. Pick the Colour tool to colour cells. Hold a circle to lock a finished region.',
			/** What the hint button says: why a circle's region is ruled out, then what follows. */
			hints: {
				centre:
					"A circle's own cells belong to its region, and a cell whose partner across a circle would lie outside the grid cannot belong to that circle's region.",
				marks: 'Your lines keep cells in different regions, and your crosses join cells into one.',
				symmetry:
					"A cell can belong to a circle's region only if its partner across that circle can too.",
				reach:
					'A region is connected: a cell its circle cannot reach through cells that may belong to it is not part of it.',
				line: 'So the cells on either side of the highlighted edges lie in different regions: draw lines there.',
				cross:
					'So the cells on either side of the highlighted edges lie in the same region: no line goes there.',
				stuck:
					'No rule decides an edge here. Hard puzzles need case analysis: try a region for the highlighted cell in your head and follow it until a rule breaks.'
			},
			tutorial: [
				{
					text: 'Pinwheel is about splitting the board into regions. Every circle is the centre of exactly one region, and every region holds exactly one circle. Just look for now: you start drawing in step 3.'
				},
				{
					text: 'The key rule: turn a region by 180° around its circle, and it covers exactly the same cells again. So every cell of a region has a partner straight across the circle, and that partner belongs to the region too.'
				},
				{
					text: 'A circle can sit in the middle of a cell, like the one in the top-left corner. Its region is just that cell: any other cell would need a partner across the circle, and that would lie outside the board.',
					task: 'Draw lines between the dots to close off the top-left cell. The border of the board already counts as a line, so two lines are enough.',
					done: 'Done: one circle, one region.'
				},
				{
					text: 'A circle on an edge sits between two cells, and both belong to its region. The next circle in the top row cannot grow downwards: the partners of those cells would lie above the board.',
					task: 'Close off the two cells of the next circle in the top row.',
					done: 'Right. No line can run through a circle: it would cut the region in two.'
				},
				{
					text: 'A circle on a corner touches four cells, and all four belong to its region. In the top right, those four cells are already the whole region.',
					task: 'Close off the four cells around the circle in the top right.',
					done: 'Three regions done. The next one is a little trickier.'
				},
				{
					text: 'Regions do not have to be rectangles. The symmetry helper finds partners for you: press a circle and drag onto a cell (on a touch screen, hold the circle briefly, then slide). The cell and its partner light up.',
					task: 'The marked cell belongs to the circle in the middle. Find its partner with the helper, then close off the region: four cells in a zigzag.',
					done: 'Exactly: turned around its circle, the zigzag looks the same.'
				},
				{
					text: 'Four regions are left, and two of them are zigzags too. If a closed area turns red, it has no circle. If a circle turns red, its region is not symmetric yet.',
					task: 'Split the rest of the board on your own.'
				}
			]
		},
		sudoku: {
			tagline: 'Fill the grid so that no row, column or box repeats a digit.',
			rules: [
				'Fill every empty cell with a digit from 1 to 9.',
				'Each row, each column and each 3×3 box with a thick border holds every digit exactly once.'
			],
			notes: [
				'Small digits in a cell are notes: the digits you still consider possible there. They do not count for the solution.'
			],
			controlsMouse:
				'Click a cell, then type a digit or use the number pad. Shift+digit adds or removes a note, Space switches between digits and notes. Backspace or 0 erases. Arrow keys move. Prefer to pick the digit first? Turn on "Pick the digit first" in the settings.',
			controlsTouch:
				'Tap a cell, then a digit on the number pad. Pick the Note tool to add or remove small notes instead. ⌫ erases.',
			/** What the hint button says. With an elimination first, then the digit it leads to. */
			hints: {
				hidden: {
					box: 'In its box, {digit} fits only in the highlighted cell: the other free cells there see a {digit} in their row or column, or your notes rule it out.',
					row: 'In its row, {digit} fits only in the highlighted cell: the other free cells there see a {digit} in their column or box, or your notes rule it out.',
					column:
						'In its column, {digit} fits only in the highlighted cell: the other free cells there see a {digit} in their row or box, or your notes rule it out.'
				},
				naked:
					'Only {digit} fits in the highlighted cell: its row, column and box hold every other digit, or your notes rule them out.',
				lockedCandidates:
					'Note the candidates first. When a digit fits in a box only in cells of one row (or column), it leaves the rest of that row; and the other way round.',
				nakedSubset:
					'Note the candidates first. Two cells of a row, column or box with the same two candidates (or three cells with three) take those digits: they leave the other cells there.',
				hiddenSubset:
					'Note the candidates first. Two digits that fit in a row, column or box only in the same two cells (or three in three) fill those cells: their other candidates go.',
				then: {
					box: 'Then {digit} fits only in the highlighted cell of its box.',
					row: 'Then {digit} fits only in the highlighted cell of its row.',
					column: 'Then {digit} fits only in the highlighted cell of its column.'
				},
				thenNaked: 'Then only {digit} is left for the highlighted cell.',
				stuck:
					'None of the usual techniques finds a digit here. Start with the highlighted cell: it has the fewest candidates.'
			},
			modes: {
				calc: {
					rules: [
						'Calcudoku ("Math Sudoku"): fill every cell with a digit from 1 to the grid size. Each row and each column holds every digit exactly once; there are no boxes.',
						'Each cage with a thick border shows a result, then an operation. Its digits must give that result: "12+" adds up to 12, "60×" multiplies to 60.',
						'"1−" and "5÷" cages have two cells: the larger digit minus or divided by the smaller one gives the result, e.g. 7 − 6 = 1 or 5 ÷ 1 = 5.',
						'A cage with just a number holds that digit. Digits may repeat inside a cage, but never in a row or column.'
					],
					/** Hint texts for Calcudoku; the conclusions come from `games.sudoku.hints`. */
					hints: {
						hidden: {
							row: 'In its row, {digit} fits only in the highlighted cell: the other free cells there see a {digit} in their column, or your notes rule it out.',
							column:
								'In its column, {digit} fits only in the highlighted cell: the other free cells there see a {digit} in their row, or your notes rule it out.'
						},
						naked:
							'Only {digit} fits in the highlighted cell: its row and column hold every other digit, or your notes rule them out.',
						cage: "Work out which digits can give each cage's result with its operation; digits in one row or column must differ.",
						nakedPair:
							'Note the candidates first. Two cells of a row or column with the same two candidates take those digits: they leave the other cells there.'
					},
					tutorial: [
						{
							text: 'Calcudoku is a Sudoku without boxes: each row and each column holds the digits 1 to 4 exactly once. Instead of given digits, the grid has cages, groups of cells with a thick border. Just look for now: you start filling in step 3.'
						},
						{
							text: 'The label in a cage\'s corner is a result and an operation. The digits in the cage must give that result: "7+" means they add up to 7, "18×" (marked) that they multiply to 18. In a "3−" or "2÷" cage, the larger of its two digits minus or divided by the smaller one gives the result.'
						},
						{
							text: 'A cage with one cell and just a number holds that digit. That is your free start.',
							task: 'Enter the digit of the cell at the top right: select the cell, then tap the digit on the number pad or type it.',
							done: 'Done: one cell, one digit.'
						},
						{
							text: 'The "3−" cage below it needs two digits that differ by 3. From 1 to 4, only 4 and 1 do. Which goes where? The right column already has its 4.',
							task: 'Fill in the "3−" cage.',
							done: 'Right: the 1 goes on the right, because that column already has a 4.'
						},
						{
							text: 'The "7+" cage on the left of the third row needs 3 and 4, but nothing tells you the order yet. That is what notes are for: small digits that keep both options open.',
							task: 'Pick the Note tool (✎) and note 3 and 4 in both cells of the "7+" cage.',
							done: 'Good: the order will come out later.'
						},
						{
							text: 'Digits may repeat inside a cage, as long as they sit in different rows and columns: "18×" is 2 × 3 × 3. Repeated digits in a row or column turn red, and so does the label of a full cage that misses its result.',
							task: 'Fill in all the other cells on your own.'
						}
					]
				}
			},
			pad: 'Number pad',
			erase: 'Erase',
			left: '{count} left',
			tutorial: [
				{
					text: 'This small Sudoku uses the digits 1 to 4. Each row, each column and each 2×2 box with a thick border (like the marked one) holds every digit exactly once. Just look for now: you start filling in step 2.'
				},
				{
					text: 'Start where little is missing. The top row already has 1, 2 and 4, so its empty cell can only be the one digit left.',
					task: 'Fill the empty cell of the top row: select it, then tap the digit on the number pad or type it.',
					done: 'Right: a 3. When you select a cell, its row, column and box light up to help you look.'
				},
				{
					text: 'Boxes work the same way. The top-left box has 1, 2 and 4, so its empty cell takes the missing digit.',
					task: 'Fill the empty cell of the top-left box.',
					done: 'Exactly: the box needed its 3.'
				},
				{
					text: 'And columns too. Now that the 3 is in, the left column lacks only one digit.',
					task: 'Fill the next empty cell of the left column.',
					done: 'Well done: row, box or column, the trick is always to find the one missing digit.'
				},
				{
					text: 'Three cells are left. For each, check its row, column and box. Not sure yet? The Note tool (✎) jots down small digits as reminders. Repeated digits turn red.',
					task: 'Fill in the last three cells on your own.'
				}
			]
		}
	}
};

export default en;

type Widen<T> = T extends string
	? string
	: T extends readonly string[]
		? string[]
		: { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;

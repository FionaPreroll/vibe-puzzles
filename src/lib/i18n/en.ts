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
		today: 'Today',
		dailyOpen: 'Daily puzzle waiting',
		dailyDone: 'Daily puzzle solved',
		streak: 'Streak {count}',
		tutorial: 'New here? Learn {game} in a minute',
		play: 'Play',
		daily: 'Daily',
		weekly: 'Weekly',
		monthly: 'Monthly'
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
	/** Short names for the narrow specials row of the puzzle type picker. */
	/** Rule sets of a game other than its main one. */
	mode: {
		calc: 'Calcudoku'
	},
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
		blackHoles: 'Black hole in completed galaxies',
		autoColor: 'Auto colour completed galaxies',
		markMistakes: 'Paint wrong digits red',
		autoNotes: 'Fill in notes automatically',
		autoRemoveNotes: 'Remove notes ruled out by a new digit',
		highlightLines: 'Highlight row, column and box',
		highlightSame: 'Highlight the same digit',
		showRemaining: 'Show how many of each digit are left'
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
		tryIt: 'Try it on the board.',
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
			tutorial: [
				'Each region with a thick border needs exactly one tetromino: four shaded cells in a row, an L, a T or an S shape.',
				'This small board has four regions. The top-left region is already done: it holds an S.',
				'Shaded cells must all connect, and no 2×2 block may be shaded. Same shapes may not touch across a region border.',
				'Now finish the board: shade one tetromino in each of the other regions. Wrong spots turn red.'
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
			tutorial: [
				'Every circle is the centre of one region. Turned by 180° around its circle, a region looks exactly the same.',
				'A circle on a cell, an edge or a corner tells you where the middle of the region is.',
				'Draw lines between the dots to separate the regions. The symmetry helper mirrors your lines for you.',
				'Now split this board so that each region holds one circle and is symmetric around it.'
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
				'Click a cell, then type a digit or use the number pad. Shift+digit adds or removes a note, Space switches between digits and notes. Backspace or 0 erases. Arrow keys move.',
			controlsTouch:
				'Tap a cell, then a digit on the number pad. Pick the Note tool to add or remove small notes instead. ⌫ erases.',
			modes: {
				calc: {
					rules: [
						'Calcudoku ("Math Sudoku"): fill every cell with a digit from 1 to the grid size. Each row and each column holds every digit exactly once; there are no boxes.',
						'Each cage with a thick border shows a result, then an operation. Its digits must give that result: "12+" adds up to 12, "60×" multiplies to 60.',
						'"1−" and "5÷" cages have two cells: the larger digit minus or divided by the smaller one gives the result, e.g. 7 − 6 = 1 or 5 ÷ 1 = 5.',
						'A cage with just a number holds that digit. Digits may repeat inside a cage, but never in a row or column.'
					]
				}
			},
			pad: 'Number pad',
			erase: 'Erase',
			left: '{count} left',
			tutorial: [
				'This small Sudoku uses the digits 1 to 4. Every row, column and 2×2 box needs each of them exactly once.',
				'Look at the top row: 1, 2 and 4 are there already, so the empty cell must be a 3.',
				'Not sure yet? Pick the Note tool and jot down small digits as reminders of what is still possible.',
				'Now fill in all empty cells. Repeated digits turn red.'
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

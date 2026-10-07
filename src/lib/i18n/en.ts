/** English texts. The source of truth: every other language has exactly these keys. */
const en = {
	app: {
		name: 'Vibe Puzzles',
		close: 'Close',
		language: 'Language'
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
		touch: 'Touch',
		touchAuto: 'Auto',
		touchDraw: 'Always draw',
		touchPan: 'Always pan',
		checkpoints: 'Checkpoints',
		save: 'Save',
		add: 'Add',
		loadCheckpoint: 'Load checkpoint {n} (right click deletes)',
		deleteCheckpoint: 'Delete checkpoint {n}',
		confirmDeleteCheckpoint: 'Delete checkpoint {n}?',
		idLine: '{variant} · Puzzle ID',
		idHidden: 'shown once solved',
		idHiddenTitle: 'Ranked server puzzle',
		fromBank: 'from the puzzle collection',
		done: 'Done',
		startOver: 'Start over',
		confirmStartOver: 'Are you sure? This clears the board and restarts the timer.',
		print: 'Print…',
		share: 'Share',
		newPuzzle: 'New puzzle',
		shareLink: 'Link to your progress:',
		screenshot: 'Screenshot (PNG)',
		closeShare: 'Close share panel',
		creating: 'Creating puzzle…',
		paused: 'Paused. Click to resume',
		storageFull: 'Your browser storage is full. Clear old saved games?',
		board: 'Puzzle board'
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
		unrankedLocal: 'Solved in {time}! Not ranked: only puzzles from the server are ranked.'
	},
	difficulty: {
		normal: 'Normal',
		hard: 'Hard'
	},
	special: {
		daily: 'Daily',
		weekly: 'Weekly',
		monthly: 'Monthly'
	},
	tool: {
		rotate: 'Rotate',
		black: 'Black',
		cross: 'Cross',
		blank: 'Blank',
		color: 'Colour'
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
		nightMode: 'Night mode',
		highlightErrors: 'Highlight errors',
		blueErrors: 'Use blue for errors',
		highlightLastChange: 'Highlight last change',
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
		autoColor: 'Auto colour completed galaxies'
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
		confirmSignOut: 'Sign out on this device? Keep your sync code to sign back in.',
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
	games: {
		tetroid: {
			tagline: 'Shade one tetromino in every region.',
			rules: [
				'Place one tetromino in each region.',
				'Two tetrominoes of matching types cannot touch each other horizontally or vertically. Rotations and reflections count as matching.',
				'The shaded cells should form a single connected area.',
				'2×2 shaded areas are not allowed.'
			],
			notes: [
				'A tetromino is a shape made of 4 connected cells. There are 5 types, named L, I, T, S and O after their shape. O is not used because it is a 2×2 shape, which is not allowed.'
			],
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
				'Each region has exactly one white circle in it.',
				'The circle is the centre of its rotational symmetry: rotating the region by 180° around the circle gives the same shape, position and orientation.',
				'A region cannot be a neighbour to itself.'
			],
			notes: [],
			tool: { black: 'Line' },
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

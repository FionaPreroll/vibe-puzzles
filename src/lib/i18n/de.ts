import type { Dictionary } from './en';

/** German texts. */
const de: Dictionary = {
	app: {
		name: 'Vibe Puzzles',
		close: 'Schließen',
		language: 'Sprache'
	},
	nav: {
		games: 'Spiele',
		scores: 'Bestenliste',
		player: 'Spieler',
		dayMode: 'Zum Tagmodus wechseln',
		nightMode: 'Zum Nachtmodus wechseln'
	},
	home: {
		title: 'Logikrätsel, nur einen Klick entfernt',
		intro: 'Jedes Rätsel hat genau eine Lösung. Wähle ein Spiel und leg los.',
		continue: 'Weiterspielen',
		continueGame: '{game} · {variant}',
		today: 'Heute',
		dailyOpen: 'Tagesrätsel wartet',
		dailyDone: 'Tagesrätsel gelöst',
		streak: 'Serie {count}',
		tutorial: 'Neu hier? Lerne {game} in einer Minute',
		play: 'Spielen',
		daily: 'Täglich',
		weekly: 'Wöchentlich',
		monthly: 'Monatlich'
	},
	game: {
		menu: '{game}-Menü',
		openMenu: 'Rätseltypen und Regeln',
		closeMenu: 'Menü schließen',
		expandPanel: 'Seitenleiste ausklappen',
		collapsePanel: 'Seitenleiste einklappen',
		rules: 'Regeln',
		controls: 'Steuerung',
		show: 'Zeigen',
		hide: 'Ausblenden',
		puzzleType: 'Rätseltyp',
		size: 'Größe',
		specials: 'Specials',
		puzzleId: 'Rätsel-ID',
		openById: 'Rätsel per ID öffnen',
		open: 'Öffnen',
		scoresLink: 'Bestenliste & Statistik',
		tutorial: 'Tutorial',
		zoom: 'Zoom',
		fit: 'Einpassen',
		resetZoom: 'Zurück zur automatischen Größe',
		settings: 'Einstellungen',
		timer: 'Zeit',
		pause: 'Pause',
		resume: 'Weiter',
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		tools: 'Werkzeuge',
		colour: 'Farbe {name}',
		touch: 'Touch-Bedienung',
		touchAuto: 'Automatisch',
		touchDraw: 'Immer zeichnen',
		touchPan: 'Immer verschieben',
		checkpoints: 'Zwischenstände',
		save: 'Speichern',
		add: 'Neu',
		loadCheckpoint: 'Zwischenstand {n} laden (Rechtsklick löscht)',
		deleteCheckpoint: 'Zwischenstand {n} löschen',
		confirmDeleteCheckpoint: 'Zwischenstand {n} löschen?',
		idLine: '{variant} · Rätsel-ID',
		idHidden: 'wird nach dem Lösen angezeigt',
		idHiddenTitle: 'Gewertetes Server-Rätsel',
		fromBank: 'aus der Rätselsammlung',
		done: 'Fertig',
		startOver: 'Neu beginnen',
		confirmStartOver: 'Wirklich? Das leert das Brett und startet die Zeit neu.',
		print: 'Drucken…',
		more: 'Weitere Aktionen',
		share: 'Teilen',
		newPuzzle: 'Neues Rätsel',
		shareLink: 'Link zu deinem Spielstand:',
		screenshot: 'Bildschirmfoto (PNG)',
		closeShare: 'Teilen schließen',
		creating: 'Rätsel wird erstellt…',
		paused: 'Pausiert. Zum Fortsetzen klicken',
		storageFull: 'Der Browserspeicher ist voll. Alte Spielstände löschen?',
		board: 'Spielbrett'
	},
	session: {
		createFailed: 'Das Rätsel konnte nicht erstellt werden: {error}',
		serverFailed:
			'Der Server konnte kein Rätsel erstellen. Dieses wird offline gespielt und nicht gewertet.',
		continued: 'Dein Spiel von einem anderen Gerät wurde fortgesetzt.',
		notSolved: 'Noch nicht gelöst. Weiter so!',
		solved: 'Gelöst in {time}!',
		uploadFailed: 'Gelöst in {time}! (Zeit nicht hochgeladen: {error})',
		wrong: 'Das ist noch nicht die Lösung.',
		repeat: 'Gelöst in {time}! (Du hast dieses Rätsel schon einmal gelöst.)',
		ranked: 'Gelöst in {time}! Platz {rank} von {total} bei {variant}.',
		yourBest: 'Deine Bestzeit ist {time}.',
		unrankedPersonal: 'Gelöst in {time}! Persönliche Zeit: nicht gewertet.',
		unrankedLocal: 'Gelöst in {time}! Nicht gewertet: Nur Rätsel vom Server kommen in die Wertung.',
		expired: 'Gelöst in {time}! Nicht gewertet: Der Server hebt dieses alte Rätsel nicht mehr auf.'
	},
	difficulty: {
		normal: 'Normal',
		hard: 'Schwer'
	},
	special: {
		daily: 'Tagesrätsel',
		weekly: 'Wochenrätsel',
		monthly: 'Monatsrätsel'
	},
	specialShort: {
		daily: 'Tag',
		weekly: 'Woche',
		monthly: 'Monat'
	},
	tool: {
		rotate: 'Wechseln',
		black: 'Schwarz',
		cross: 'Kreuz',
		blank: 'Leeren',
		color: 'Farbe'
	},
	swatch: ['', 'Violett', 'Rot', 'Gelb', 'Grün', 'Blau'],
	setting: {
		hideControls: 'Spielsteuerung ausblenden',
		stickyToolbar: 'Leiste und Werkzeuge beim Scrollen oben halten',
		autoSubmit: 'Automatisch abgeben',
		showCheckpoints: 'Zwischenstände anzeigen',
		showCoordinates: 'Koordinaten anzeigen',
		hideTimer: 'Zeit ausblenden',
		personalTimer: 'Persönliche Zeit (ohne Wertung)',
		highlightErrors: 'Fehler markieren',
		blueErrors: 'Fehler blau statt rot',
		highlightLastChange: 'Letzte Änderung hervorheben',
		solvedAnimation: 'Animation beim Lösen',
		highlightBlock: 'Aktuellen Bereich hervorheben',
		highlightGroup: 'Aktuelle Zellgruppe hervorheben [Shift]',
		thickBorders: 'Dickere Bereichsgrenzen',
		colorTetrominoes: 'Tetrominos einfärben',
		autoCrossCorners: 'Automatisch X an Ecken setzen',
		autoCrossRegions: 'Automatisch X in fertigen Bereichen setzen',
		showGrid: 'Gitter anzeigen',
		continuousLine: 'Durchgehende Linie zeichnen',
		symmetryHelper: 'Symmetriehilfe',
		blackHoles: 'Schwarzes Loch in fertigen Galaxien',
		autoColor: 'Fertige Galaxien automatisch einfärben'
	},
	source: {
		title: 'Woher neue Rätsel kommen',
		local: 'Auf diesem Gerät erzeugt',
		bank: 'Aus der Rätselsammlung',
		mixed: 'Beides, zufällig gemischt',
		note: 'Die Sammlung enthält vorab erzeugte Rätsel, die auf eine eindeutige Lösung geprüft sind. Auf dem Gerät erzeugte Rätsel gehen auch offline und nie aus.'
	},
	scores: {
		title: 'Bestenliste & Statistik',
		game: 'Spiel',
		puzzleType: 'Rätseltyp',
		yourStats: 'Deine Statistik',
		keptLocally: 'Auf diesem Gerät gespeichert.',
		solved: 'Gelöst',
		streak: 'Aktuelle Serie',
		bestStreak: 'Beste Serie',
		bestTime: 'Bestzeit',
		average: 'Durchschnitt',
		recent: 'Zuletzt gelöst',
		bestTimes: 'Bestzeiten',
		currentPuzzle: '{variant}: aktuelles Rätsel',
		noServer: 'Online-Bestenlisten brauchen den optionalen Server, der hier nicht läuft.',
		loading: 'Lädt…',
		empty: 'Noch keine Zeiten. Sei die erste Person!',
		players: '{count} Spieler',
		player: '1 Spieler',
		you: 'Du: Platz {rank} mit {time}',
		pickName: 'Wähle einen Spielernamen',
		toAppear: ', um hier zu erscheinen.'
	},
	player: {
		title: 'Spieler',
		checking: 'Suche nach dem Server…',
		noServer:
			'Diese Version hat keinen Server. Spielstände bleiben in diesem Browser, und es gibt keine Online-Bestenlisten. Alles andere funktioniert wie gewohnt.',
		pickName: 'Wähle einen Namen',
		pickNameText:
			'Dein Name erscheint in den Bestenlisten. Spielstände und Einstellungen werden mit dem Server abgeglichen, damit du auf einem anderen Gerät weiterspielen kannst. Ohne E-Mail und Passwort.',
		name: 'Name',
		start: 'Los',
		otherDevice: 'Spielst du schon auf einem anderen Gerät?',
		otherDeviceText: 'Gib den Sync-Code ein, der dort angezeigt wird.',
		link: 'Gerät verbinden',
		rename: 'Umbenennen',
		syncCode: 'Sync-Code',
		syncCodeText:
			'Gib diesen Code auf einem anderen Gerät ein, um dort weiterzuspielen. Halte ihn geheim: Er ist der Schlüssel zu deinem Spieler.',
		show: 'Zeigen',
		hide: 'Ausblenden',
		signOut: 'Abmelden',
		confirmSignOut: 'Auf diesem Gerät abmelden? Mit dem Sync-Code kannst du dich wieder anmelden.',
		unknownCode: 'Unbekannter Sync-Code'
	},
	tutorial: {
		title: '{game}-Tutorial',
		step: 'Schritt {n} von {total}',
		next: 'Weiter',
		back: 'Zurück',
		finish: 'Ein echtes Rätsel spielen',
		skip: 'Tutorial überspringen',
		tryIt: 'Probier es auf dem Brett aus.',
		wellDone: 'Gut gemacht!',
		solvedAll: 'Du hast dein erstes Rätsel gelöst. Bereit für ein echtes?'
	},
	pwa: {
		install: 'App installieren'
	},
	games: {
		tetroid: {
			tagline: 'Schattiere ein Tetromino in jedem Bereich.',
			rules: [
				'Schattiere in jedem Bereich genau ein Tetromino (4 zusammenhängende Zellen).',
				'Zwei gleiche Tetrominos dürfen sich nicht an einer Kante berühren. Gedrehte oder gespiegelte zählen als gleich.',
				'Alle schattierten Zellen hängen zusammen.',
				'Kein 2×2-Block darf ganz schattiert sein.'
			],
			notes: ['Mögliche Formen sind also L, I, T und S. Das Quadrat O fällt durch Regel 4 weg.'],
			controlsMouse:
				'Klicke eine Zelle zum Schattieren, Rechtsklick setzt ein Kreuz. Ziehen markiert mehrere Zellen. Tasten 1–4 wählen ein Werkzeug.',
			controlsTouch:
				'Tippe eine Zelle an, um zwischen schattiert, Kreuz und leer zu wechseln. Kurz halten und ziehen markiert mehrere Zellen.',
			tutorial: [
				'Jeder dick umrandete Bereich braucht genau ein Tetromino: vier schattierte Zellen in einer Reihe, als L, T oder S.',
				'Dieses kleine Brett hat vier Bereiche. Der Bereich oben links ist schon fertig: Er enthält ein S.',
				'Alle schattierten Zellen müssen verbunden sein, und keine 2×2-Fläche darf schattiert sein. Gleiche Formen dürfen sich über eine Bereichsgrenze nicht berühren.',
				'Jetzt löse das Brett: Schattiere in jedem anderen Bereich ein Tetromino. Falsche Stellen werden rot.'
			]
		},
		pinwheel: {
			tagline: 'Teile das Gitter in Bereiche, die auf dem Kopf gleich aussehen.',
			rules: [
				'Teile das Gitter entlang der Linien in Bereiche mit je genau einem Kreis.',
				'Jeder Bereich ist punktsymmetrisch zu seinem Kreis: Um 180° gedreht, deckt er sich genau mit sich selbst.',
				'Linien trennen nur verschiedene Bereiche, nie zwei Zellen desselben Bereichs.'
			],
			notes: [],
			tool: { black: 'Linie' },
			controlsMouse:
				'Klicke zwischen zwei Punkte, um eine Linie zu ziehen. Rechtsklick setzt ein Kreuz, Shift+Klick färbt eine Zelle. Rechtsklick auf einen Kreis sperrt einen fertigen Bereich.',
			controlsTouch:
				'Tippe zwischen zwei Punkte, um eine Linie zu ziehen. Mit dem Farbwerkzeug färbst du Zellen. Einen Kreis halten sperrt einen fertigen Bereich.',
			tutorial: [
				'Jeder Kreis ist die Mitte eines Bereichs. Um 180° um seinen Kreis gedreht, sieht ein Bereich genau gleich aus.',
				'Ein Kreis auf einer Zelle, einer Kante oder einer Ecke zeigt dir, wo die Mitte des Bereichs liegt.',
				'Ziehe Linien zwischen den Punkten, um die Bereiche zu trennen. Die Symmetriehilfe spiegelt deine Linien automatisch.',
				'Jetzt teile dieses Brett so, dass jeder Bereich einen Kreis enthält und um ihn symmetrisch ist.'
			]
		}
	}
};

export default de;

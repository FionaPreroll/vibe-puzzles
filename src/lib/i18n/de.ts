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
		confirmNewPuzzle: 'Neues Rätsel beginnen? Dein angefangenes Spiel dieser Art geht verloren.',
		confirmReplace:
			'Dieses Rätsel ersetzt dein angefangenes Spiel derselben Art, das dabei verloren geht. Trotzdem öffnen?',
		print: 'Drucken…',
		more: 'Weitere Aktionen',
		share: 'Spielstand teilen',
		newPuzzle: 'Neues Rätsel',
		shareLink: 'Link zu deinem Spielstand:',
		screenshot: 'Bildschirmfoto (PNG)',
		closeShare: 'Teilen schließen',
		shareSolve: 'Erfolg teilen',
		brag: 'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst! Schaffst du es schneller?',
		bragCopied: 'Ergebnis und Link kopiert. Füge sie ein, wo du sie teilen möchtest.',
		creating: 'Rätsel wird erstellt…',
		notCreated: 'Das Rätsel konnte nicht erstellt werden.',
		retry: 'Erneut versuchen',
		paused: 'Pausiert. Zum Fortsetzen klicken',
		storageFull:
			'Der Browserspeicher ist voll. Die am längsten nicht gespielten angefangenen Spiele löschen, um Platz zu schaffen?',
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
		easy: 'Leicht',
		normal: 'Normal',
		hard: 'Schwer'
	},
	special: {
		daily: 'Tagesrätsel',
		weekly: 'Wochenrätsel',
		monthly: 'Monatsrätsel'
	},
	mode: {
		calc: 'Calcudoku'
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
		color: 'Farbe',
		digit: 'Ziffer',
		note: 'Notiz'
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
		autoColor: 'Fertige Galaxien automatisch einfärben',
		markMistakes: 'Falsche Ziffern rot färben',
		autoNotes: 'Notizen automatisch eintragen',
		autoRemoveNotes: 'Notizen entfernen, die eine neue Ziffer ausschließt',
		highlightLines: 'Zeile, Spalte und Block hervorheben',
		highlightSame: 'Gleiche Ziffer hervorheben',
		showRemaining: 'Anzeigen, wie oft jede Ziffer noch fehlt'
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
	update: {
		available: 'Eine neue Version ist da.',
		reload: 'Neu laden',
		dismiss: 'Später'
	},
	about: {
		link: 'Über',
		title: 'Über Vibe Puzzles',
		intro: 'Logikrätsel im Browser. Jedes Rätsel hat genau eine Lösung.',
		build: 'Build',
		version: 'Version',
		commit: 'Commit',
		built: 'Erstellt',
		source: 'Quellcode',
		licenses: 'Lizenzen',
		licenseText: 'Lizenztext von {name}',
		licensesNote: 'Die App baut auf diesen Open-Source-Bibliotheken auf:',
		puzzleTypes:
			'Tetroid folgt den Regeln von LITS, Pinwheel denen von Tentai Show (Galaxies), beides klassische Rätselarten aus Japan. Sudoku und seine Spielart Calcudoku folgen ihren üblichen Regeln.',
		privacy: 'Datenschutz',
		privacyLocal:
			'Deine Spiele, Statistiken und Einstellungen liegen nur in diesem Browser (Local Storage). Es gibt keine Cookies, kein Tracking und keine Werbung.',
		privacyServer:
			'Wenn du einen Spieler auf dem Server anlegst, speichert er deinen Spielernamen, deinen zufälligen Spieler-Code (nur als Hash), deine Ergebnisse, die dir ausgegebenen Rätsel und, zum Abgleich zwischen Geräten, deine Spielstände und Einstellungen. Sonst nichts.',
		privacyHost:
			'Die Seite liegt bei GitHub Pages; GitHub kann beim Laden technische Daten wie deine IP-Adresse protokollieren.',
		backup: 'Datensicherung',
		backupNote:
			'Lade alles, was dieser Browser für Vibe Puzzles speichert, als JSON-Datei herunter, oder stelle es aus so einer Datei wieder her. Die Datei enthält deinen Spieler-Code, gib sie also nicht weiter.',
		export: 'Sicherung exportieren',
		import: 'Sicherung importieren',
		schema: 'Dateiformat (JSON-Schema)',
		confirmImport:
			'{count} Einträge aus dieser Sicherung wiederherstellen? Einträge mit gleichem Namen werden überschrieben.',
		imported: '{count} Einträge wiederhergestellt. Seite wird neu geladen…',
		importFailed: 'Diese Datei lässt sich nicht wiederherstellen: {error}.'
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
			toolHint: {
				rotate:
					'Jeder Klick auf eine Zelle schaltet weiter: leer, schattiert, Kreuz und wieder leer. Rechtsklick schaltet rückwärts.',
				black:
					'Klick schattiert eine Zelle, ein zweiter Klick leert sie. Rechtsklick setzt ein Kreuz.',
				cross:
					'Klick markiert eine Zelle mit einem Kreuz: Sie bleibt unschattiert. Ein zweiter Klick entfernt es.',
				blank: 'Leert jede Zelle, die du anklickst oder überstreichst.'
			},
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
			toolHint: {
				rotate:
					'Jeder Klick auf eine Kante schaltet weiter: leer, Linie, Kreuz und wieder leer. Rechtsklick schaltet rückwärts.',
				black:
					'Klick auf eine Kante zieht eine Linie, ein zweiter Klick entfernt sie. Rechtsklick setzt ein Kreuz.',
				cross:
					'Klick markiert eine Kante mit einem Kreuz: Dort kommt keine Linie hin. Ein zweiter Klick entfernt es.',
				blank: 'Leert jede Kante, die du anklickst oder überstreichst.',
				color: 'Färbt eine Zelle in der gewählten Farbe. Klick auf eine gefärbte Zelle leert sie.'
			},
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
		},
		sudoku: {
			tagline:
				'Fülle das Gitter so, dass sich in keiner Zeile, Spalte und keinem Block eine Ziffer wiederholt.',
			rules: [
				'Trage in jedes leere Feld eine Ziffer von 1 bis 9 ein.',
				'Jede Zeile, jede Spalte und jeder dick umrandete 3×3-Block enthält jede Ziffer genau einmal.'
			],
			notes: [
				'Kleine Ziffern in einem Feld sind Notizen: die Ziffern, die dort noch möglich sind. Für die Lösung zählen sie nicht.'
			],
			controlsMouse:
				'Klicke ein Feld an und tippe eine Ziffer oder nutze das Zahlenfeld. Umschalt+Ziffer setzt oder entfernt eine Notiz, die Leertaste wechselt zwischen Ziffern und Notizen. Rücktaste oder 0 löscht. Pfeiltasten bewegen.',
			controlsTouch:
				'Tippe ein Feld an, dann eine Ziffer im Zahlenfeld. Mit dem Notiz-Werkzeug setzt oder entfernst du stattdessen kleine Notizen. ⌫ löscht.',
			modes: {
				calc: {
					rules: [
						'Calcudoku („Rechen-Sudoku“): Trage in jedes Feld eine Ziffer von 1 bis zur Gittergröße ein. Jede Zeile und jede Spalte enthält jede Ziffer genau einmal; Blöcke gibt es nicht.',
						'Jeder dick umrandete Käfig zeigt ein Ergebnis und danach eine Rechenart. Seine Ziffern müssen dieses Ergebnis ergeben: „12+“ ergibt addiert 12, „60×“ multipliziert 60.',
						'„1−“- und „5÷“-Käfige haben zwei Felder: Die größere Ziffer minus oder geteilt durch die kleinere ergibt das Ergebnis, z. B. 7 − 6 = 1 oder 5 ÷ 1 = 5.',
						'Ein Käfig mit nur einer Zahl enthält genau diese Ziffer. Innerhalb eines Käfigs dürfen sich Ziffern wiederholen, aber nie in einer Zeile oder Spalte.'
					]
				}
			},
			pad: 'Zahlenfeld',
			erase: 'Löschen',
			left: 'noch {count}',
			tutorial: [
				'Dieses kleine Sudoku nutzt die Ziffern 1 bis 4. Jede Zeile, Spalte und jeder 2×2-Block braucht jede davon genau einmal.',
				'Sieh dir die oberste Zeile an: 1, 2 und 4 stehen schon da, also muss in das leere Feld eine 3.',
				'Noch unsicher? Nimm das Notiz-Werkzeug und notiere kleine Ziffern als Erinnerung, was noch möglich ist.',
				'Jetzt fülle alle leeren Felder. Doppelte Ziffern werden rot.'
			]
		}
	}
};

export default de;

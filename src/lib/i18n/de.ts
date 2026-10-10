import type { Dictionary } from './en';

/** German texts. */
const de: Dictionary = {
	app: {
		name: 'Vibe Puzzles',
		close: 'Schließen',
		language: 'Sprache'
	},
	confirm: {
		cancel: 'Abbrechen',
		newPuzzle: {
			title: 'Neues Rätsel beginnen?',
			text: 'Dein angefangenes Spiel dieser Art geht verloren.',
			ok: 'Neues Rätsel'
		},
		replace: {
			title: 'Angefangenes Spiel ersetzen?',
			text: 'Dieses Rätsel ersetzt dein angefangenes Spiel derselben Art, das dabei verloren geht.',
			ok: 'Trotzdem öffnen'
		},
		startOver: {
			title: 'Neu beginnen?',
			text: 'Das leert das Brett und startet die Zeit neu.',
			ok: 'Neu beginnen'
		},
		deleteCheckpoint: {
			title: 'Zwischenstand {n} löschen?',
			text: 'Das lässt sich nicht rückgängig machen.',
			ok: 'Löschen'
		},
		storageFull: {
			title: 'Der Browserspeicher ist voll',
			text: 'Die am längsten nicht gespielten angefangenen Spiele löschen, um Platz zu schaffen?',
			ok: 'Alte Spiele löschen'
		},
		signOut: {
			title: 'Auf diesem Gerät abmelden?',
			text: 'Mit dem Sync-Code kannst du dich wieder anmelden.',
			ok: 'Abmelden'
		},
		import: {
			title: '{count} Einträge aus dieser Sicherung wiederherstellen?',
			text: 'Einträge mit gleichem Namen werden überschrieben.',
			ok: 'Wiederherstellen'
		}
	},
	nav: {
		games: 'Spiele',
		scores: 'Bestenliste',
		player: 'Spieler',
		dayMode: 'Zum Tagmodus wechseln',
		nightMode: 'Zum Nachtmodus wechseln'
	},
	look: {
		label: 'Design',
		auto: 'Automatisch ({look})',
		classic: 'Klassisch',
		halloween: 'Halloween',
		tagline: 'Süßes oder Rätsel?',
		taglineNight: 'Rätsel bei Mondschein'
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
		newHere: 'Neu hier? Jedes Tutorial dauert nur wenige Minuten.',
		learn: '{game} lernen',
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
		hint: 'Tipp',
		hintTitle: 'Tipp (H): zeigt den nächsten Schritt. Das Spiel gilt dann als mit Hilfe gelöst.',
		hintMistake: 'Die markierten Zellen stimmen nicht mit der Lösung überein.',
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
		idLine: '{variant} · Rätsel-ID',
		idHidden: 'wird nach dem Lösen angezeigt',
		idHiddenTitle: 'Gewertetes Server-Rätsel',
		fromBank: 'aus der Rätselsammlung',
		done: 'Fertig',
		startOver: 'Neu beginnen',
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
		dismiss: 'Schließen',
		board: 'Spielbrett'
	},
	shortcuts: {
		title: 'Tastenkürzel',
		open: 'Tastenkürzel (?)',
		general: 'Spiel',
		undo: 'Rückgängig',
		redo: 'Wiederholen',
		hint: 'Tipp',
		newPuzzle: 'Neues Rätsel',
		done: 'Lösung prüfen',
		save: 'Zwischenstand speichern',
		add: 'Neuen Zwischenstand anlegen',
		colourTool: 'Farbwerkzeug und zurück',
		escape: 'Menü oder Zoom schließen',
		help: 'Diese Liste',
		tools: 'Werkzeuge',
		colours: 'Farben',
		board: 'Auf dem Brett',
		or: 'oder'
	},
	daily: {
		next: 'Neues Tagesrätsel in {time}, um {at} Uhr'
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
		unrankedHinted: 'Gelöst in {time}, mit Tipp: nicht gewertet.',
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
		showRemaining: 'Anzeigen, wie oft jede Ziffer noch fehlt',
		digitFirst: 'Erst die Ziffer wählen, dann die Felder (Linksklick: Ziffer, Rechtsklick: Notiz)'
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
		unknownCode: 'Unbekannter Sync-Code'
	},
	tutorial: {
		title: '{game}-Tutorial',
		step: 'Schritt {n} von {total}',
		next: 'Weiter',
		back: 'Zurück',
		finish: 'Ein echtes Rätsel spielen',
		skip: 'Tutorial überspringen',
		yourTurn: 'Du bist dran',
		showMe: 'Zeig es mir',
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
			hints: {
				region:
					'Schau, welche Tetrominos in diesen Bereich noch passen, nach seiner Form und deinen Markierungen.',
				sameShape:
					'Streiche Tetrominos, die ein gleiches berühren würden: Alles, was im Nachbarbereich noch passt, hat diese Form.',
				square: 'Streiche Tetrominos, die einen schattierten 2×2-Block vervollständigen würden.',
				neighbour:
					'Streiche Tetrominos, die mit allem kollidieren, was im Nachbarbereich noch passt: Jede Möglichkeit dort würde eine gleiche Form berühren oder einen 2×2-Block vervollständigen.',
				lookAhead:
					'Streiche Tetrominos, die die schattierten Zellen trennen würden: Frag dich, ob noch alles zusammenhängen könnte, wenn das Tetromino dort läge.',
				shade:
					'Jedes Tetromino, das in diesem Bereich übrig bleibt, bedeckt die markierten Zellen: Schattiere sie.',
				cross:
					'Kein Tetromino, das in diesem Bereich übrig bleibt, bedeckt die markierten Zellen: Sie bleiben leer.',
				stuck:
					'Hier entscheidet keine Regel eine Zelle. Schwere Rätsel brauchen eine Fallunterscheidung: Leg im Kopf ein Tetromino in den markierten Bereich und verfolge es, bis eine Regel bricht.'
			},
			tutorial: [
				{
					text: 'Jeder dick umrandete Bereich braucht genau ein Tetromino: vier schattierte Zellen, die mit ihren Seiten aneinanderstoßen. Es gibt vier Formen, I, L, T und S, die auch gedreht oder gespiegelt sein dürfen. Der Bereich oben links ist schon fertig: Er enthält ein S, und Kreuze markieren seine leeren Zellen. Schau dir das Brett erst einmal nur an: Ab Schritt 2 schattierst du.'
				},
				{
					text: 'Der Bereich oben rechts hat genau vier Zellen, sein Tetromino füllt ihn also ganz aus.',
					task: 'Schattiere alle vier Zellen dieses Bereichs.',
					done: 'Geschafft: Dieses Tetromino ist ein L.'
				},
				{
					text: 'Keine 2×2-Fläche darf ganz schattiert sein. Die beiden markierten Zellen liegen jeweils neben drei schattierten Zellen einer 2×2-Fläche: Schattiert würden sie sie vervollständigen.',
					task: 'Markiere beide Zellen mit einem Kreuz: Wähle das Werkzeug Kreuz (✕) und klicke oder tippe sie an. Ein Kreuz heißt, die Zelle bleibt leer.',
					done: 'Richtig: Diese Zellen bleiben leer, du hast sie endgültig ausgeschlossen.'
				},
				{
					text: 'Zwei weitere Regeln. Alle schattierten Zellen bilden zusammen eine verbundene Gruppe. Und zwei Tetrominos derselben Form dürfen sich über eine Bereichsgrenze nicht berühren; gedrehte oder gespiegelte zählen als dieselbe Form.'
				},
				{
					text: 'Zwei Bereiche sind noch übrig: der unten und der große rechts. Nutze die Regeln aus den Schritten davor. Zellen, die eine Regel verletzen, werden rot.',
					task: 'Schattiere in beiden Bereichen je ein Tetromino.'
				}
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
			hints: {
				centre:
					'Die Zellen unter einem Kreis gehören zu seinem Bereich, und eine Zelle, deren Spiegelbild durch einen Kreis außerhalb des Gitters läge, kann nicht zu dessen Bereich gehören.',
				marks:
					'Deine Linien trennen Zellen in verschiedene Bereiche, deine Kreuze verbinden Zellen zu einem.',
				symmetry:
					'Eine Zelle kann nur dann zum Bereich eines Kreises gehören, wenn ihr Spiegelbild durch diesen Kreis es auch kann.',
				reach:
					'Ein Bereich hängt zusammen: Eine Zelle, die sein Kreis nicht über Zellen erreicht, die zu ihm gehören können, gehört nicht dazu.',
				line: 'Also liegen die Zellen beiderseits der markierten Kanten in verschiedenen Bereichen: Zieh dort Linien.',
				cross:
					'Also liegen die Zellen beiderseits der markierten Kanten im selben Bereich: Dort kommt keine Linie hin.',
				stuck:
					'Hier entscheidet keine Regel eine Kante. Schwere Rätsel brauchen eine Fallunterscheidung: Probier im Kopf einen Bereich für die markierte Zelle aus und verfolge ihn, bis eine Regel bricht.'
			},
			tutorial: [
				{
					text: 'Bei Pinwheel teilst du das Brett in Bereiche. Jeder Kreis ist die Mitte von genau einem Bereich, und jeder Bereich enthält genau einen Kreis. Schau dir das Brett erst einmal nur an: Ab Schritt 3 zeichnest du.'
				},
				{
					text: 'Die wichtigste Regel: Dreh einen Bereich um 180° um seinen Kreis, und er deckt wieder genau dieselben Zellen ab. Jede Zelle eines Bereichs hat also eine Partnerzelle genau gegenüber auf der anderen Seite des Kreises, und die gehört auch dazu.'
				},
				{
					text: 'Ein Kreis kann mitten in einer Zelle sitzen, so wie der in der Ecke oben links. Sein Bereich ist nur diese eine Zelle: Jede weitere Zelle bräuchte eine Partnerzelle gegenüber, und die läge außerhalb des Bretts.',
					task: 'Ziehe Linien zwischen den Punkten, um die Zelle oben links abzutrennen. Der Rand des Bretts zählt schon als Linie, zwei Linien genügen also.',
					done: 'Geschafft: ein Kreis, ein Bereich.'
				},
				{
					text: 'Ein Kreis auf einer Kante sitzt zwischen zwei Zellen, und beide gehören zu seinem Bereich. Der nächste Kreis in der oberen Reihe kann nicht nach unten wachsen: Die Partnerzellen lägen über dem Brett.',
					task: 'Trenne die beiden Zellen des nächsten Kreises in der oberen Reihe ab.',
					done: 'Richtig. Durch einen Kreis kann keine Linie gehen: Sie würde seinen Bereich zerschneiden.'
				},
				{
					text: 'Ein Kreis auf einer Ecke berührt vier Zellen, und alle vier gehören zu seinem Bereich. Oben rechts sind diese vier Zellen schon der ganze Bereich.',
					task: 'Trenne die vier Zellen um den Kreis oben rechts ab.',
					done: 'Drei Bereiche fertig. Der nächste ist etwas kniffliger.'
				},
				{
					text: 'Bereiche müssen keine Rechtecke sein. Die Symmetriehilfe findet Partnerzellen für dich: Drücke auf einen Kreis und ziehe auf eine Zelle (auf einem Touchscreen den Kreis kurz halten, dann wischen). Die Zelle und ihre Partnerzelle leuchten auf.',
					task: 'Die markierte Zelle gehört zum Kreis in der Mitte. Finde mit der Hilfe ihre Partnerzelle und trenne dann den Bereich ab: vier Zellen im Zickzack.',
					done: 'Genau: Um seinen Kreis gedreht, sieht der Zickzack gleich aus.'
				},
				{
					text: 'Vier Bereiche sind noch übrig, zwei davon sind auch Zickzacks. Wird ein abgetrennter Bereich rot, hat er keinen Kreis. Wird ein Kreis rot, ist sein Bereich noch nicht symmetrisch.',
					task: 'Teile den Rest des Bretts allein auf.'
				}
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
				'Klicke ein Feld an und tippe eine Ziffer oder nutze das Zahlenfeld. Umschalt+Ziffer setzt oder entfernt eine Notiz, die Leertaste wechselt zwischen Ziffern und Notizen. Rücktaste oder 0 löscht. Pfeiltasten bewegen. Lieber erst die Ziffer wählen? Schalte „Erst die Ziffer wählen“ in den Einstellungen ein.',
			controlsTouch:
				'Tippe ein Feld an, dann eine Ziffer im Zahlenfeld. Mit dem Notiz-Werkzeug setzt oder entfernst du stattdessen kleine Notizen. ⌫ löscht.',
			hints: {
				hidden: {
					box: 'In ihrem Block passt die {digit} nur ins markierte Feld: Die anderen freien Felder dort sehen eine {digit} in ihrer Zeile oder Spalte, oder deine Notizen schließen sie aus.',
					row: 'In ihrer Zeile passt die {digit} nur ins markierte Feld: Die anderen freien Felder dort sehen eine {digit} in ihrer Spalte oder ihrem Block, oder deine Notizen schließen sie aus.',
					column:
						'In ihrer Spalte passt die {digit} nur ins markierte Feld: Die anderen freien Felder dort sehen eine {digit} in ihrer Zeile oder ihrem Block, oder deine Notizen schließen sie aus.'
				},
				naked:
					'Ins markierte Feld passt nur die {digit}: Zeile, Spalte und Block enthalten alle anderen Ziffern, oder deine Notizen schließen sie aus.',
				lockedCandidates:
					'Notiere zuerst die Kandidaten. Passt eine Ziffer in einem Block nur in Felder einer Zeile (oder Spalte), fällt sie im Rest dieser Zeile weg; und umgekehrt.',
				nakedSubset:
					'Notiere zuerst die Kandidaten. Zwei Felder einer Zeile, Spalte oder eines Blocks mit denselben zwei Kandidaten (oder drei Felder mit drei) belegen diese Ziffern: In den anderen Feldern dort fallen sie weg.',
				hiddenSubset:
					'Notiere zuerst die Kandidaten. Zwei Ziffern, die in einer Zeile, Spalte oder einem Block nur in dieselben zwei Felder passen (oder drei in drei), füllen diese Felder: Deren andere Kandidaten fallen weg.',
				then: {
					box: 'Dann passt die {digit} in ihrem Block nur ins markierte Feld.',
					row: 'Dann passt die {digit} in ihrer Zeile nur ins markierte Feld.',
					column: 'Dann passt die {digit} in ihrer Spalte nur ins markierte Feld.'
				},
				thenNaked: 'Dann bleibt fürs markierte Feld nur die {digit}.',
				stuck:
					'Keine der üblichen Techniken findet hier eine Ziffer. Fang mit dem markierten Feld an: Es hat die wenigsten Kandidaten.'
			},
			modes: {
				calc: {
					rules: [
						'Calcudoku („Rechen-Sudoku“): Trage in jedes Feld eine Ziffer von 1 bis zur Gittergröße ein. Jede Zeile und jede Spalte enthält jede Ziffer genau einmal; Blöcke gibt es nicht.',
						'Jeder dick umrandete Käfig zeigt ein Ergebnis und danach eine Rechenart. Seine Ziffern müssen dieses Ergebnis ergeben: „12+“ ergibt addiert 12, „60×“ multipliziert 60.',
						'„1−“- und „5÷“-Käfige haben zwei Felder: Die größere Ziffer minus oder geteilt durch die kleinere ergibt das Ergebnis, z. B. 7 − 6 = 1 oder 5 ÷ 1 = 5.',
						'Ein Käfig mit nur einer Zahl enthält genau diese Ziffer. Innerhalb eines Käfigs dürfen sich Ziffern wiederholen, aber nie in einer Zeile oder Spalte.'
					],
					hints: {
						hidden: {
							row: 'In ihrer Zeile passt die {digit} nur ins markierte Feld: Die anderen freien Felder dort sehen eine {digit} in ihrer Spalte, oder deine Notizen schließen sie aus.',
							column:
								'In ihrer Spalte passt die {digit} nur ins markierte Feld: Die anderen freien Felder dort sehen eine {digit} in ihrer Zeile, oder deine Notizen schließen sie aus.'
						},
						naked:
							'Ins markierte Feld passt nur die {digit}: Zeile und Spalte enthalten alle anderen Ziffern, oder deine Notizen schließen sie aus.',
						cage: 'Rechne aus, welche Ziffern mit der Rechenart das Ergebnis jedes Käfigs ergeben können; in einer Zeile oder Spalte müssen sie verschieden sein.',
						nakedPair:
							'Notiere zuerst die Kandidaten. Zwei Felder einer Zeile oder Spalte mit denselben zwei Kandidaten belegen diese Ziffern: In den anderen Feldern dort fallen sie weg.'
					},
					tutorial: [
						{
							text: 'Calcudoku ist ein Sudoku ohne Blöcke: Jede Zeile und jede Spalte enthält die Ziffern 1 bis 4 genau einmal. Statt vorgegebener Ziffern hat das Gitter Käfige, dick umrandete Gruppen von Zellen. Schau dir das Gitter erst einmal nur an: Ab Schritt 3 trägst du ein.'
						},
						{
							text: 'Die Beschriftung in der Ecke eines Käfigs ist ein Ergebnis und eine Rechenart. Die Ziffern im Käfig müssen dieses Ergebnis ergeben: „7+“ heißt, sie ergeben zusammen 7, „18×“ (markiert), dass ihr Produkt 18 ist. In einem „3−“- oder „2÷“-Käfig ergibt die größere seiner beiden Ziffern minus oder geteilt durch die kleinere das Ergebnis.'
						},
						{
							text: 'Ein Käfig mit nur einer Zelle und nur einer Zahl enthält genau diese Ziffer. Das ist dein geschenkter Anfang.',
							task: 'Trage die Ziffer der Zelle oben rechts ein: Zelle auswählen, dann die Ziffer im Zahlenfeld antippen oder auf der Tastatur tippen.',
							done: 'Geschafft: eine Zelle, eine Ziffer.'
						},
						{
							text: 'Der „3−“-Käfig darunter braucht zwei Ziffern mit dem Abstand 3. Von 1 bis 4 passen nur 4 und 1. Welche kommt wohin? Die rechte Spalte hat ihre 4 schon.',
							task: 'Fülle den „3−“-Käfig aus.',
							done: 'Richtig: Die 1 kommt nach rechts, weil diese Spalte schon eine 4 hat.'
						},
						{
							text: 'Der „7+“-Käfig links in der dritten Zeile braucht 3 und 4, aber die Reihenfolge verrät noch nichts. Dafür gibt es Notizen: kleine Ziffern, die beide Möglichkeiten offenhalten.',
							task: 'Wähle das Werkzeug Notiz (✎) und notiere 3 und 4 in beiden Zellen des „7+“-Käfigs.',
							done: 'Gut: Die Reihenfolge ergibt sich später.'
						},
						{
							text: 'Ziffern dürfen sich in einem Käfig wiederholen, solange sie in verschiedenen Zeilen und Spalten stehen: „18×“ ist 2 × 3 × 3. Doppelte Ziffern in einer Zeile oder Spalte werden rot, ebenso die Beschriftung eines vollen Käfigs, der sein Ergebnis verfehlt.',
							task: 'Fülle alle übrigen Zellen allein aus.'
						}
					]
				}
			},
			pad: 'Zahlenfeld',
			erase: 'Löschen',
			left: 'noch {count}',
			tutorial: [
				{
					text: 'Dieses kleine Sudoku nutzt die Ziffern 1 bis 4. Jede Zeile, jede Spalte und jeder dick umrandete 2×2-Block (wie der markierte) enthält jede Ziffer genau einmal. Schau dir das Gitter erst einmal nur an: Ab Schritt 2 trägst du ein.'
				},
				{
					text: 'Fang dort an, wo wenig fehlt. Die oberste Zeile hat schon 1, 2 und 4, ihre leere Zelle kann also nur die übrige Ziffer sein.',
					task: 'Fülle die leere Zelle der obersten Zeile: Zelle auswählen, dann die Ziffer im Zahlenfeld antippen oder auf der Tastatur tippen.',
					done: 'Richtig: eine 3. Wenn du eine Zelle auswählst, leuchten ihre Zeile, Spalte und ihr Block auf und helfen dir beim Schauen.'
				},
				{
					text: 'Blöcke funktionieren genauso. Der Block oben links hat 1, 2 und 4, seine leere Zelle bekommt die fehlende Ziffer.',
					task: 'Fülle die leere Zelle im Block oben links.',
					done: 'Genau: Dem Block fehlte seine 3.'
				},
				{
					text: 'Und Spalten auch. Jetzt, wo die 3 drin ist, fehlt der linken Spalte nur noch eine Ziffer.',
					task: 'Fülle die nächste leere Zelle der linken Spalte.',
					done: 'Gut gemacht: Ob Zeile, Block oder Spalte, der Trick ist immer, die eine fehlende Ziffer zu finden.'
				},
				{
					text: 'Drei Zellen sind noch übrig. Prüfe bei jeder ihre Zeile, Spalte und ihren Block. Noch unsicher? Mit dem Werkzeug Notiz (✎) notierst du kleine Ziffern als Gedächtnisstütze. Doppelte Ziffern werden rot.',
					task: 'Fülle die letzten drei Zellen allein aus.'
				}
			]
		}
	}
};

export default de;

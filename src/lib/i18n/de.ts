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
			text: 'Das leert das Spielfeld und startet die Zeit neu.',
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
	home: {
		title: 'Logikrätsel, nur einen Klick entfernt',
		intro: 'Jedes Rätsel hat genau eine Lösung. Wähle ein Spiel und leg los.',
		continue: 'Weiterspielen',
		continueGame: '{game} · {variant}',
		dailyOpen: 'Tagesrätsel wartet',
		dailyDone: 'Tagesrätsel gelöst',
		streak: 'Serie {count}',
		newHere: 'Neu hier? Jedes Tutorial dauert nur eine Minute.',
		learn: '{game} lernen',
		play: 'Spielen'
	},
	game: {
		menu: '{game}-Menü',
		openMenu: 'Rätseltypen und Regeln',
		closeMenu: 'Menü schließen',
		expandPanel: 'Seitenleiste ausklappen',
		collapsePanel: 'Seitenleiste einklappen',
		rules: 'Regeln',
		controls: 'Steuerung',
		show: 'Einblenden',
		hide: 'Ausblenden',
		puzzleType: 'Rätseltyp',
		size: 'Größe',
		specials: 'Sonderrätsel',
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
		hintTitle:
			'Tipp (H): zeigt den nächsten Schritt. Danach zählt das Rätsel nicht für Bestzeit und Rangliste.',
		hintMistake: 'Die markierten Einträge passen nicht zur Lösung.',
		countsAsHint:
			'Zählt als Tipp: keine Bestzeit und keine Rangliste für ein Rätsel, bei dem es an war.',
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
		bragHint:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit 1 Tipp. Schaffst du es ohne?',
		bragHints:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit {count} Tipps. Schaffst du es ohne?',
		bragCopied: 'Ergebnis und Link kopiert. Füge sie ein, wo du sie teilen möchtest.',
		creating: 'Rätsel wird erstellt…',
		notCreated: 'Das Rätsel konnte nicht erstellt werden.',
		retry: 'Erneut versuchen',
		paused: 'Pausiert. Zum Fortsetzen klicken',
		dismiss: 'Schließen',
		board: 'Spielfeld'
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
		space: 'Leertaste',
		switchTools: 'Zwischen {a} und {b} wechseln',
		escape: 'Menü oder Zoom schließen',
		help: 'Diese Liste',
		tools: 'Werkzeuge',
		colours: 'Farben',
		board: 'Auf dem Spielfeld',
		or: 'oder'
	},
	daily: {
		next: 'Neues Tagesrätsel in {time}, um {at} Uhr'
	},
	session: {
		createFailed: 'Das Rätsel konnte nicht erstellt werden: {error}',
		serverFailed:
			'Der Server konnte kein Rätsel erstellen. Dieses wird offline gespielt und nicht gewertet.',
		continued: 'Spielstand von deinem anderen Gerät übernommen.',
		notSolved: 'Noch nicht gelöst. Bleib dran!',
		solved: 'In {time} gelöst!',
		uploadFailed: 'In {time} gelöst! (Zeit nicht hochgeladen: {error})',
		wrong: 'Das ist noch nicht die Lösung.',
		repeat: 'In {time} gelöst! (Du hast dieses Rätsel schon einmal gelöst.)',
		ranked: 'In {time} gelöst! Platz {rank} von {total} bei {variant}.',
		yourBest: 'Deine Bestzeit ist {time}.',
		unrankedPersonal: 'In {time} gelöst! Persönliche Zeit: nicht gewertet.',
		unrankedLocal: 'In {time} gelöst! Nicht gewertet: Nur Rätsel vom Server kommen in die Wertung.',
		unrankedHinted: 'Mit Tipp in {time} gelöst: nicht gewertet.',
		expired: 'In {time} gelöst! Nicht gewertet: Der Server speichert dieses alte Rätsel nicht mehr.'
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
		hideHint: 'Tipp-Button ausblenden',
		personalTimer: 'Persönliche Zeit (ohne Wertung)',
		highlightErrors: 'Fehler markieren',
		blueErrors: 'Fehler blau statt rot',
		highlightLastChange: 'Letzte Änderung hervorheben',
		solvedAnimation: 'Animation beim Lösen',
		highlightBlock: 'Aktuellen Bereich hervorheben',
		highlightGroup: 'Aktuelle Feldgruppe hervorheben [Shift]',
		thickBorders: 'Dickere Bereichsgrenzen',
		colorTetrominoes: 'Tetrominos einfärben',
		autoCrossCorners: 'Kreuze an Ecken automatisch setzen',
		autoCrossRegions: 'Fertige Bereiche automatisch mit Kreuzen füllen',
		showGrid: 'Gitter anzeigen',
		continuousLine: 'Durchgehende Linie zeichnen',
		symmetryHelper: 'Symmetriehilfe',
		blackHoles: 'Schwarzes Loch in fertigen Bereichen',
		autoColor: 'Fertige Bereiche automatisch einfärben',
		markMistakes: 'Falsche Ziffern rot färben',
		autoNotes: 'Notizen automatisch eintragen',
		autoRemoveNotes: 'Notizen entfernen, wenn eine neue Ziffer sie ausschließt',
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
		empty: 'Noch keine Zeiten. Mach den Anfang!',
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
			'Diese Seite läuft ohne Server. Spielstände bleiben in diesem Browser, und es gibt keine Online-Bestenlisten. Alles andere funktioniert wie gewohnt.',
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
			'Gib diesen Code auf einem anderen Gerät ein, um dort weiterzuspielen. Halte ihn geheim: Wer ihn kennt, kann als du spielen.',
		show: 'Einblenden',
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
		hint: 'Kommst du nicht weiter? Tipp zeigt dir den nächsten Schritt, wie in einem echten Rätsel.',
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
			tagline: 'Schwärze in jedem Bereich ein Tetromino.',
			rules: [
				'Schwärze in jedem Bereich genau ein Tetromino (4 zusammenhängende Felder).',
				'Zwei gleiche Tetrominos dürfen sich nicht an einer Kante berühren. Gedrehte oder gespiegelte zählen als gleich.',
				'Alle schwarzen Felder hängen zusammen.',
				'Kein 2×2-Block darf ganz schwarz sein.'
			],
			notes: ['Mögliche Formen sind also L, I, T und S. Das Quadrat O fällt durch Regel 4 weg.'],
			toolHint: {
				rotate:
					'Jeder Klick auf ein Feld schaltet weiter: leer, schwarz, Kreuz und wieder leer. Rechtsklick schaltet rückwärts.',
				black: 'Ein Klick schwärzt ein Feld, ein zweiter leert es. Rechtsklick setzt ein Kreuz.',
				cross:
					'Ein Klick markiert ein Feld mit einem Kreuz: Es bleibt weiß. Ein zweiter Klick entfernt das Kreuz.',
				blank: 'Leert jedes Feld, das du anklickst oder überstreichst.'
			},
			controlsMouse:
				'Klicke auf ein Feld, um es zu schwärzen, Rechtsklick setzt ein Kreuz. Ziehen markiert mehrere Felder. Die Tasten 1–4 wählen ein Werkzeug.',
			controlsTouch:
				'Tippe ein Feld an, um zwischen schwarz, Kreuz und leer zu wechseln. Kurz halten und ziehen markiert mehrere Felder.',
			hints: {
				region:
					'Schau, welche Tetrominos bei seiner Form und deinen Markierungen noch in diesen Bereich passen.',
				sameShape:
					'Streiche Tetrominos, die ein gleiches berühren würden: Alles, was im Nachbarbereich noch passt, hat diese Form.',
				square: 'Streiche Tetrominos, die einen schwarzen 2×2-Block vervollständigen würden.',
				neighbour:
					'Streiche Tetrominos, die sich mit jeder Möglichkeit im Nachbarbereich beißen: Jede davon würde eine gleiche Form berühren oder einen 2×2-Block vervollständigen.',
				lookAhead:
					'Streiche Tetrominos, die die schwarzen Felder trennen würden: Frag dich, ob noch alles zusammenhängen könnte, wenn das Tetromino dort läge.',
				shade:
					'Alle Tetrominos, die in diesem Bereich noch möglich sind, enthalten die markierten Felder: Schwärze sie.',
				cross:
					'Keins der Tetrominos, die in diesem Bereich noch möglich sind, enthält die markierten Felder: Sie bleiben leer.',
				stuck:
					'Hier legt keine Regel ein weiteres Feld fest. Schwere Rätsel brauchen eine Fallunterscheidung: Leg im Kopf ein Tetromino in den markierten Bereich und spiel es durch, bis eine Regel verletzt wird.'
			},
			tutorial: [
				{
					text: 'Jeder dick umrandete Bereich braucht genau ein Tetromino: vier schwarze Felder, die mit ihren Seiten aneinanderstoßen. Es gibt vier Formen, I, L, T und S, die auch gedreht oder gespiegelt sein dürfen. Der Bereich oben links ist schon fertig: Er enthält ein S, und Kreuze markieren seine leeren Felder. Schau dir das Spielfeld erst einmal nur an: Ab Schritt 2 schwärzt du selbst.'
				},
				{
					text: 'Der Bereich oben rechts hat genau vier Felder, sein Tetromino füllt ihn also ganz aus.',
					task: 'Schwärze alle vier Felder dieses Bereichs.',
					done: 'Geschafft: Dieses Tetromino ist ein L. Das klappt auch in größeren Bereichen: Ein Feld, das jedes dort noch mögliche Tetromino enthält, ist immer schwarz.'
				},
				{
					text: 'Kein 2×2-Block darf ganz schwarz sein. Die beiden markierten Felder würden jeweils einen 2×2-Block vollmachen, in dem schon drei Felder schwarz sind.',
					task: 'Markiere beide Felder mit einem Kreuz: Wähle das Werkzeug Kreuz (✕) und klicke oder tippe sie an. Ein Kreuz heißt, das Feld bleibt leer.',
					done: 'Richtig: Diese Felder bleiben leer, du hast sie endgültig ausgeschlossen.'
				},
				{
					text: 'Zwei weitere Regeln. Alle schwarzen Felder bilden zusammen eine verbundene Gruppe. Und zwei Tetrominos derselben Form dürfen sich über eine Bereichsgrenze nicht berühren; gedrehte oder gespiegelte zählen als dieselbe Form. Ein L auf dem markierten Feld scheidet also aus: Es würde das L darüber berühren.'
				},
				{
					text: 'Zwei Bereiche sind noch übrig: der unten und der große rechts. Nutze die Regeln aus den Schritten davor. Felder, die eine Regel verletzen, werden rot.',
					task: 'Schwärze in beiden Bereichen je ein Tetromino.'
				}
			]
		},
		pinwheel: {
			tagline: 'Teile das Gitter in Bereiche, die auf den Kopf gestellt gleich aussehen.',
			rules: [
				'Teile das Gitter entlang der Linien in Bereiche mit je genau einem Kreis.',
				'Jeder Bereich ist punktsymmetrisch zu seinem Kreis: Um 180° gedreht, deckt er sich genau mit sich selbst.',
				'Linien trennen nur verschiedene Bereiche, nie zwei Felder desselben Bereichs.'
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
				color: 'Färbt ein Feld in der gewählten Farbe. Ein Klick auf ein gefärbtes Feld leert es.'
			},
			controlsMouse:
				'Klicke zwischen zwei Punkte, um eine Linie zu ziehen. Rechtsklick setzt ein Kreuz, Shift+Klick färbt ein Feld. Rechtsklick auf einen Kreis sperrt einen fertigen Bereich.',
			controlsTouch:
				'Tippe zwischen zwei Punkte, um eine Linie zu ziehen. Mit dem Farbwerkzeug färbst du Felder. Einen Kreis halten sperrt einen fertigen Bereich.',
			hints: {
				centre:
					'Die Felder unter einem Kreis gehören zu seinem Bereich. Ein Feld, dessen Partnerfeld gegenüber einem Kreis außerhalb des Spielfelds läge, kann nicht zu dessen Bereich gehören.',
				marks:
					'Deine Linien trennen Felder in verschiedene Bereiche, deine Kreuze verbinden Felder zu einem.',
				symmetry:
					'Ein Feld kann nur dann zum Bereich eines Kreises gehören, wenn sein Partnerfeld gegenüber diesem Kreis es auch kann.',
				reach:
					'Ein Bereich hängt zusammen: Ein Feld gehört nur dazu, wenn vom Kreis aus ein Weg dorthin führt, der nur über Felder geht, die zum Bereich gehören können.',
				line: 'Also liegen die Felder beiderseits der markierten Kanten in verschiedenen Bereichen: Zieh dort Linien.',
				cross:
					'Also liegen die Felder beiderseits der markierten Kanten im selben Bereich: Dort kommt keine Linie hin.',
				stuck:
					'Hier legt keine Regel eine weitere Kante fest. Schwere Rätsel brauchen eine Fallunterscheidung: Probier im Kopf einen Bereich für das markierte Feld aus und spiel ihn durch, bis eine Regel verletzt wird.'
			},
			tutorial: [
				{
					text: 'Bei Pinwheel teilst du das Spielfeld in Bereiche. Jeder Kreis ist die Mitte von genau einem Bereich, und jeder Bereich enthält genau einen Kreis. Schau dir das Spielfeld erst einmal nur an: Ab Schritt 3 zeichnest du.'
				},
				{
					text: 'Die wichtigste Regel: Dreh einen Bereich um 180° um seinen Kreis, und er deckt wieder genau dieselben Felder ab. Jedes Feld eines Bereichs hat also ein Partnerfeld genau gegenüber auf der anderen Seite des Kreises, und das gehört auch dazu.'
				},
				{
					text: 'Ein Kreis kann mitten in einem Feld sitzen, so wie der in der Ecke oben links. Sein Bereich ist nur dieses eine Feld: Jedes weitere Feld bräuchte ein Partnerfeld gegenüber, und das läge außerhalb des Spielfelds.',
					task: 'Ziehe Linien zwischen den Punkten, um das Feld oben links abzutrennen. Der Rand des Spielfelds zählt schon als Linie, zwei Linien genügen also.',
					done: 'Geschafft: ein Kreis, ein Bereich.'
				},
				{
					text: 'Ein Kreis auf einer Kante sitzt zwischen zwei Feldern, und beide gehören zu seinem Bereich. Der nächste Kreis in der oberen Reihe kann nicht nach unten wachsen: Die Partnerfelder lägen über dem Spielfeld.',
					task: 'Trenne die beiden Felder des nächsten Kreises in der oberen Reihe ab.',
					done: 'Richtig. Durch einen Kreis kann keine Linie gehen: Sie würde seinen Bereich zerschneiden.'
				},
				{
					text: 'Ein Kreis auf einer Ecke berührt vier Felder, und alle vier gehören zu seinem Bereich. Oben rechts sind diese vier Felder schon der ganze Bereich.',
					task: 'Trenne die vier Felder um den Kreis oben rechts ab.',
					done: 'Drei Bereiche fertig. Der nächste ist etwas kniffliger.'
				},
				{
					text: 'Bereiche müssen keine Rechtecke sein. Die Symmetriehilfe findet Partnerfelder für dich: Drücke auf einen Kreis und ziehe auf ein Feld (auf einem Touchscreen den Kreis kurz halten, dann wischen). Das Feld und sein Partnerfeld leuchten auf.',
					task: 'Das markierte Feld gehört zum Kreis in der Mitte. Finde mit der Hilfe sein Partnerfeld und trenne dann den Bereich ab: vier Felder im Zickzack.',
					done: 'Genau: Um seinen Kreis gedreht, sieht der Zickzack gleich aus.'
				},
				{
					text: 'Vier Bereiche sind noch übrig, zwei davon sind auch Zickzacks. Wird ein abgetrennter Bereich rot, hat er keinen Kreis. Wird ein Kreis rot, ist sein Bereich noch nicht symmetrisch.',
					task: 'Teile den Rest selbst auf.'
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
				'Klicke ein Feld an und tippe eine Ziffer oder nutze den Ziffernblock. Umschalt+Ziffer setzt oder entfernt eine Notiz, die Leertaste wechselt zwischen Ziffern und Notizen. Rücktaste oder 0 löscht. Mit den Pfeiltasten wechselst du das Feld. Lieber erst die Ziffer wählen? Schalte „Erst die Ziffer wählen“ in den Einstellungen ein.',
			controlsTouch:
				'Tippe ein Feld an, dann eine Ziffer im Ziffernblock. Mit dem Notiz-Werkzeug setzt oder entfernst du stattdessen kleine Notizen. ⌫ löscht.',
			hints: {
				hidden: {
					box: 'In ihrem Block passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in Zeile oder Spalte, oder deine Notizen schließen sie aus.',
					row: 'In ihrer Zeile passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in Spalte oder Block, oder deine Notizen schließen sie aus.',
					column:
						'In ihrer Spalte passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in Zeile oder Block, oder deine Notizen schließen sie aus.'
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
						'Jeder dick umrandete Käfig zeigt ein Ergebnis und danach eine Rechenart. Seine Ziffern müssen dieses Ergebnis ergeben: „12+“ heißt Summe 12, „60×“ heißt Produkt 60.',
						'„1−“- und „5÷“-Käfige haben zwei Felder: Die größere Ziffer minus oder geteilt durch die kleinere ergibt das Ergebnis, z. B. 7 − 6 = 1 oder 5 ÷ 1 = 5.',
						'Ein Käfig mit nur einer Zahl enthält genau diese Ziffer. Innerhalb eines Käfigs dürfen sich Ziffern wiederholen, aber nie in einer Zeile oder Spalte.'
					],
					hints: {
						hidden: {
							row: 'In ihrer Zeile passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in der Spalte, oder deine Notizen schließen sie aus.',
							column:
								'In ihrer Spalte passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in der Zeile, oder deine Notizen schließen sie aus.'
						},
						naked:
							'Ins markierte Feld passt nur die {digit}: Zeile und Spalte enthalten alle anderen Ziffern, oder deine Notizen schließen sie aus.',
						cage: 'Rechne bei jedem Käfig aus, welche Ziffern mit seiner Rechenart sein Ergebnis liefern können; in einer Zeile oder Spalte müssen sie verschieden sein.',
						nakedPair:
							'Notiere zuerst die Kandidaten. Zwei Felder einer Zeile oder Spalte mit denselben zwei Kandidaten belegen diese Ziffern: In den anderen Feldern dort fallen sie weg.'
					},
					tutorial: [
						{
							text: 'Calcudoku ist ein Sudoku ohne Blöcke: Jede Zeile und jede Spalte enthält die Ziffern 1 bis 4 genau einmal. Statt vorgegebener Ziffern hat das Gitter Käfige, dick umrandete Gruppen von Feldern. Schau dir das Gitter erst einmal nur an: Ab Schritt 3 trägst du ein.'
						},
						{
							text: 'Die Beschriftung in der Ecke eines Käfigs ist ein Ergebnis und eine Rechenart. Die Ziffern im Käfig müssen dieses Ergebnis ergeben: „7+“ heißt, sie ergeben zusammen 7, „18×“ (markiert), dass ihr Produkt 18 ist. In einem „3−“- oder „2÷“-Käfig ergibt die größere seiner beiden Ziffern minus oder geteilt durch die kleinere das Ergebnis.'
						},
						{
							text: 'Ein Käfig mit nur einem Feld und nur einer Zahl enthält genau diese Ziffer. Damit hast du einen leichten Einstieg.',
							task: 'Trage die Ziffer des Felds oben rechts ein: Feld auswählen, dann die Ziffer im Ziffernblock antippen oder auf der Tastatur tippen.',
							done: 'Geschafft: ein Feld, eine Ziffer.'
						},
						{
							text: 'Der „3−“-Käfig darunter braucht zwei Ziffern mit der Differenz 3. Von 1 bis 4 passen nur 4 und 1. Welche kommt wohin? Die rechte Spalte hat ihre 4 schon.',
							task: 'Fülle den „3−“-Käfig aus.',
							done: 'Richtig: Die 1 kommt nach rechts, weil diese Spalte schon eine 4 hat.'
						},
						{
							text: 'Der „7+“-Käfig links in der dritten Zeile braucht 3 und 4, aber noch weißt du nicht, welche Ziffer wohin gehört. Dafür gibt es Notizen: kleine Ziffern, die beide Möglichkeiten offenhalten.',
							task: 'Wähle das Werkzeug Notiz (✎) und notiere 3 und 4 in beiden Feldern des „7+“-Käfigs.',
							done: 'Gut: Die Reihenfolge ergibt sich später.'
						},
						{
							text: 'Ziffern dürfen sich in einem Käfig wiederholen, solange sie in verschiedenen Zeilen und Spalten stehen: „18×“ ist 2 × 3 × 3. Doppelte Ziffern in einer Zeile oder Spalte werden rot, ebenso die Beschriftung eines vollen Käfigs, der sein Ergebnis verfehlt.',
							task: 'Fülle alle übrigen Felder selbst aus.'
						}
					]
				}
			},
			pad: 'Ziffernblock',
			erase: 'Löschen',
			left: 'noch {count}',
			tutorial: [
				{
					text: 'Dieses kleine Sudoku nutzt die Ziffern 1 bis 4. Jede Zeile, jede Spalte und jeder dick umrandete 2×2-Block (wie der markierte) enthält jede Ziffer genau einmal. Schau dir das Gitter erst einmal nur an: Ab Schritt 2 trägst du ein.'
				},
				{
					text: 'Fang dort an, wo wenig fehlt. Die oberste Zeile hat schon 1, 2 und 4, ihr leeres Feld kann also nur die fehlende Ziffer sein.',
					task: 'Fülle das leere Feld der obersten Zeile: Feld auswählen, dann die Ziffer im Ziffernblock antippen oder auf der Tastatur tippen.',
					done: 'Richtig: eine 3. Wenn du ein Feld auswählst, leuchten seine Zeile, Spalte und sein Block auf. So siehst du schneller, was schon dasteht.'
				},
				{
					text: 'Blöcke funktionieren genauso. Der Block oben links hat 1, 2 und 4, sein leeres Feld bekommt die fehlende Ziffer.',
					task: 'Fülle das leere Feld im Block oben links.',
					done: 'Genau: Dem Block fehlte seine 3.'
				},
				{
					text: 'Bei Spalten genauso. Jetzt, wo die 3 drin ist, fehlt der linken Spalte nur noch eine Ziffer.',
					task: 'Fülle das nächste leere Feld der linken Spalte.',
					done: 'Gut gemacht: Ob Zeile, Block oder Spalte, der Trick ist immer, die eine fehlende Ziffer zu finden.'
				},
				{
					text: 'Drei Felder sind noch übrig. Prüfe bei jedem seine Zeile, Spalte und seinen Block. Noch unsicher? Mit dem Werkzeug Notiz (✎) notierst du kleine Ziffern als Gedächtnisstütze. Doppelte Ziffern werden rot.',
					task: 'Fülle die letzten drei Felder selbst aus.'
				}
			]
		}
	}
};

export default de;

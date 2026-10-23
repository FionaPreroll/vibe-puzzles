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
		nightMode: 'Zum Nachtmodus wechseln',
		menu: 'Menü'
	},
	look: {
		label: 'Design',
		auto: '{look} (automatisch)',
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
		dailyOpen: 'Tagesrätsel wartet',
		dailyDone: 'Tagesrätsel gelöst',
		streak: 'Serie {count}',
		newHere: 'Neu hier? Jedes Tutorial dauert nur eine Minute.',
		learn: '{game} lernen',
		play: 'Spielen'
	},
	game: {
		menu: '{game}-Menü',
		earlyAccess: 'Early Access',
		comingSoon: 'Bald',
		comingSoonTitle: '{variant}: kommt bald',
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
		unknownId: 'Kein Rätsel hat diese ID.',
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
		undoShort: 'Zurück',
		redoShort: 'Vor',
		trial: 'Probe',
		trialTitle:
			'Etwas ausprobieren (T): Was du ab jetzt setzt, erscheint türkis, bis du es behältst oder zurückgehst.',
		trialKeep: 'Behalten',
		trialKeepTitle: 'Probe übernehmen (T): Ihre Züge bleiben.',
		trialDrop: 'Verwerfen',
		trialDropTitle: 'Probe verwerfen (Umschalt+T): zurück zum Stand vor der Probe.',
		trialRunning: 'Probe: neue Züge sind türkis',
		hint: 'Tipp',
		hintTitle:
			'Tipp (H): zeigt den nächsten Schritt. Danach zählt das Rätsel nicht für Bestzeit und Rangliste.',
		hintMistake:
			'Die markierten Einträge passen nicht zur Lösung. Sie bleiben markiert, bis du sie änderst.',
		hintShow: 'Zeig den Schritt',
		countsAsHint:
			'Zählt als Tipp: keine Bestzeit und keine Rangliste für ein Rätsel, bei dem es an war.',
		tools: 'Werkzeuge',
		colour: 'Farbe {name}',
		touch: 'Touch-Bedienung',
		touchAuto: 'Automatisch',
		touchDraw: 'Immer zeichnen',
		touchPan: 'Immer verschieben',
		touchAutoText:
			'Wischen scrollt die Seite. Lass den Finger kurz liegen und zieh dann, um zu zeichnen.',
		touchDrawText:
			'Ziehen auf dem Spielfeld zeichnet immer. Mit zwei Fingern scrollst du das Spielfeld und zoomst es.',
		touchPanText: 'Ziehen scrollt und zoomt immer die Seite. Antippen markiert trotzdem.',
		layout: 'Ansicht im Querformat',
		layoutAuto: 'Vorgabe des Spiels ({layout})',
		layoutStandard: 'Standard',
		layoutRight: 'Breitbild, Bedienung rechts',
		layoutLeft: 'Breitbild, Bedienung links',
		layoutAutoText:
			'Breitbild mit der Bedienung links auf Tablets, Handys und kleineren Desktop-Bildschirmen, die Standard-Ansicht auf großen Desktop-Bildschirmen. Ändert sich diese Vorgabe, folgt die Ansicht ihr.',
		layoutStandardText: 'Die Uhr über dem Spielfeld, Werkzeuge und Buttons darunter.',
		layoutRightText:
			'Das Spielfeld nutzt die ganze Bildschirmhöhe, alles andere steht in einer Spalte rechts, die sich zu einem schmalen Streifen einklappen lässt.',
		layoutLeftText:
			'Das Spielfeld nutzt die ganze Bildschirmhöhe, alles andere steht in einer Spalte links, die sich zu einem schmalen Streifen einklappen lässt.',
		expandControls: 'Bedienung ausklappen',
		collapseControls: 'Bedienung einklappen',
		checkpoints: 'Zwischenstände',
		save: 'Speichern',
		add: 'Neu',
		loadCheckpoint: 'Zwischenstand {n} laden (Rechtsklick löscht)',
		deleteCheckpoint: 'Zwischenstand {n} löschen',
		idHidden: 'wird nach dem Lösen angezeigt',
		idHiddenTitle: 'Gewertetes Server-Rätsel',
		fromBank: 'aus der Rätselsammlung',
		done: 'Fertig',
		startOver: 'Neu beginnen',
		print: 'Drucken…',
		howMade: 'Wie ist dieses Rätsel entstanden?',
		more: 'Weitere Aktionen',
		share: 'Spielstand teilen',
		newPuzzle: 'Neues Rätsel',
		currentPeriod: {
			daily: 'Heutiges Rätsel',
			weekly: 'Rätsel dieser Woche',
			monthly: 'Rätsel dieses Monats'
		},
		newPeriod: {
			daily: 'Das neue Tagesrätsel ist da. Dieses ist von gestern.',
			weekly: 'Das Rätsel der neuen Woche ist da. Dieses ist von letzter Woche.',
			monthly: 'Das Rätsel des neuen Monats ist da. Dieses ist vom letzten Monat.'
		},
		shareLink: 'Link zu deinem Spielstand:',
		screenshot: 'Bildschirmfoto (PNG)',
		closeShare: 'Teilen schließen',
		shareSolve: 'Erfolg teilen',
		brag: 'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst! Schaffst du es schneller?',
		bragHint:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit 1 Tipp. Schaffst du es ohne?',
		bragHints:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit {count} Tipps. Schaffst du es ohne?',
		bragAssist:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit Fehleranzeige. Schaffst du es ohne?',
		bragAssistHint:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit Fehleranzeige und 1 Tipp. Schaffst du es ohne?',
		bragAssistHints:
			'Ich habe {game} {variant} (Rätsel {id}) in {time} gelöst, mit Fehleranzeige und {count} Tipps. Schaffst du es ohne?',
		bragCopied: 'Ergebnis und Link kopiert. Füge sie ein, wo du sie teilen möchtest.',
		bragManual:
			'Kopieren hat hier nicht geklappt. Kopiere Ergebnis und Link unten und füge sie ein, wo du sie teilen möchtest.',
		bragText: 'Dein Ergebnis und der Link',
		copy: 'Kopieren',
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
		trial: 'Probe starten oder übernehmen',
		trialDrop: 'Probe verwerfen',
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
	speech: {
		cell: 'Zeile {row}, Spalte {col}',
		dot: 'Punkt in Zeile {row}, Spalte {col}',
		empty: 'leer',
		error: 'Fehler',
		complete: 'fertig',
		lines: 'Linien: {list}',
		crosses: 'Kreuze: {list}',
		upLeft: 'oben links',
		up: 'oben',
		upRight: 'oben rechts',
		left: 'links',
		here: 'hier',
		right: 'rechts',
		downLeft: 'unten links',
		down: 'unten',
		downRight: 'unten rechts'
	},
	daily: {
		next: 'Neues Tagesrätsel in {time}, um {at} Uhr'
	},
	session: {
		createFailed: 'Das Rätsel konnte nicht erstellt werden: {error}',
		serverFailed:
			'Der Server konnte kein Rätsel erstellen. Dieses wird offline gespielt und nicht gewertet.',
		continued: 'Spielstand von deinem anderen Gerät übernommen.',
		takenBack: 'Deine Züge wurden auf deinem anderen Gerät zurückgenommen.',
		otherTab: 'Spielstand aus einem anderen Tab übernommen.',
		notSolved: 'Noch nicht gelöst. Bleib dran!',
		solved: 'In {time} gelöst!',
		uploadFailed: 'In {time} gelöst! (Zeit nicht hochgeladen: {error})',
		queued: 'In {time} gelöst! Die Zeit geht an den Server, sobald er erreichbar ist.',
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
		black: 'Schattieren',
		cross: 'Kreuz',
		blank: 'Leeren',
		color: 'Farbe',
		digit: 'Ziffer',
		note: 'Notiz'
	},
	swatch: ['', 'Violett', 'Rot', 'Gelb', 'Grün', 'Blau'],
	setting: {
		hideControls: 'Spielsteuerung ausblenden',
		stickyToolbar: 'Obere Leiste beim Scrollen festhalten',
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
		dimSatisfiedClues: 'Zahlen mit allen Linien ausgrauen',
		markMistakes: 'Falsche Ziffern rot färben',
		autoNotes: 'Notizen automatisch eintragen',
		autoRemoveNotes: 'Notizen entfernen, wenn eine neue Ziffer sie ausschließt',
		highlightLines: 'Zeile, Spalte und Block hervorheben',
		highlightSame: 'Gleiche Ziffer hervorheben',
		showRemaining: 'Anzeigen, wie oft jede Ziffer noch fehlt',
		digitFirst: 'Erst die Ziffer wählen, dann die Felder (Linksklick: Ziffer, Rechtsklick: Notiz)'
	},
	/** Was jede Einstellung bewirkt, unter ihr angezeigt. Spiele und Modi können es eigens formulieren. */
	settingHelp: {
		hideControls:
			'Blendet die Werkzeug-Buttons aus, damit es aufgeräumter aussieht. Das zuletzt gewählte Werkzeug bleibt aktiv. Gilt nur auf diesem Gerät.',
		stickyToolbar:
			'Die Leiste mit Uhr, Zoom und Einstellungen bleibt beim Scrollen oben stehen. Praktisch bei großen Spielfeldern.',
		autoSubmit:
			'Das Rätsel gilt als gelöst, sobald dein letzter Zug stimmt. Schalte es aus, wenn du deine Lösung erst prüfen und dann selbst auf „Fertig“ drücken willst.',
		showCheckpoints:
			'Zeigt unter dem Spielfeld Buttons, mit denen du bis zu 10 Zwischenstände speicherst und später wieder lädst, etwa vor einem gewagten Versuch.',
		showCoordinates:
			'Zeigt Buchstaben über und unter dem Spielfeld und Zahlen an den Seiten, damit du Felder benennen kannst, etwa C4.',
		hideTimer:
			'Du spielst ohne laufende Uhr. Deine Zeit wird trotzdem gemessen und nach dem Lösen angezeigt.',
		hideHint:
			'Entfernt den Tipp-Button samt Taste H, damit er dich gar nicht erst in Versuchung führt.',
		personalTimer:
			'Die Uhr hält an, solange das Spiel im Hintergrund ist, und bekommt einen Pause-Button. So gemessene Zeiten kommen nicht in die Rangliste.',
		highlightErrors: 'Färbt rot, was schon gegen eine Regel verstößt.',
		blueErrors:
			'Zeigt Fehler blau statt rot. Das ist bei Rot-Grün-Sehschwäche leichter zu erkennen.',
		highlightLastChange:
			'Umrandet, was dein letzter Zug verändert hat, damit du schnell wieder hineinfindest.',
		solvedAnimation: 'Eine kleine Animation auf dem Spielfeld feiert jedes gelöste Rätsel.',
		highlightBlock:
			'Hinterlegt den Bereich des Felds, das du zuletzt angeklickt oder mit den Pfeiltasten erreicht hast.',
		highlightGroup:
			'Hebt alle schattierten Felder hervor, die mit dem zuletzt geänderten Feld verbunden sind. Mit gedrückter Umschalttaste siehst du die Gruppe unter der Maus, auch wenn das hier aus ist.',
		thickBorders:
			'Zeichnet die Bereichsgrenzen dicker, damit sich die Bereiche deutlicher abheben.',
		colorTetrominoes:
			'Färbt jedes fertige Tetromino nach seiner Form (L, I, T, S) ein. So fallen gleiche Formen, die sich berühren, sofort auf.',
		autoCrossCorners:
			'Sind drei Felder eines 2×2-Blocks schattiert, bekommt das vierte von selbst ein Kreuz.',
		autoCrossRegions:
			'Sobald ein Bereich sein Tetromino hat, bekommen seine übrigen Felder von selbst ein Kreuz.',
		showGrid:
			'Zeichnet feine gepunktete Linien zwischen alle Felder. Das hilft beim Abzählen und beim Finden von Partnerfeldern.',
		continuousLine:
			'Beim Ziehen entsteht eine zusammenhängende Linie von Punkt zu Punkt, auch um Ecken; zurückziehen verkürzt sie. Aus: Jede überstrichene Kante wird einzeln gesetzt.',
		symmetryHelper:
			'Drück auf einen Kreis und zieh auf ein Feld (auf dem Touchscreen den Kreis erst kurz halten): Das Feld und sein Partnerfeld leuchten auf. Rot heißt, das Partnerfeld läge außerhalb des Spielfelds.',
		blackHoles:
			'Ein Kreis wird schwarz, sobald sein Bereich fertig ist. So siehst du auf einen Blick, was schon erledigt ist.',
		autoColor:
			'Gibt jedem fertigen Bereich eine eigene Farbe, die sich von seinen Nachbarn abhebt.',
		dimSatisfiedClues:
			'Graut eine Zahl aus, sobald sie so viele Linien hat, wie sie zeigt. So fallen die offenen Zahlen mehr auf.',
		markMistakes:
			'Vergleicht deine Ziffern mit der Lösung und färbt falsche rot, auch wenn sie noch mit nichts kollidieren.',
		autoNotes:
			'Jedes leere Feld ohne Notizen bekommt die Ziffern, die Zeile, Spalte und Block dort noch zulassen.',
		autoRemoveNotes:
			'Eine neue Ziffer verschwindet aus den Notizen in ihrer Zeile, Spalte und ihrem Block.',
		highlightLines: 'Hinterlegt Zeile, Spalte und Block des gewählten Felds.',
		highlightSame:
			'Hebt alle Felder hervor, in denen dieselbe Ziffer steht wie im gewählten Feld. Wählst du erst die Ziffer, gilt diese.',
		showRemaining:
			'Der Ziffernblock zeigt, wie oft jede Ziffer noch fehlt, und graut vollständige Ziffern aus.',
		digitFirst:
			'Wähl zuerst eine Ziffer im Ziffernblock und klick dann alle Felder an, die sie bekommen. Praktisch, um eine Ziffer überall auf dem Spielfeld einzutragen.'
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
	net: {
		menu: 'Verbindung',
		label: 'Verbindung: {status}',
		checking: 'Prüfe…',
		online: 'Online',
		latency: '{ms} ms',
		unreachable: 'Keine Verbindung',
		offline: 'Offline-Modus',
		none: 'Kein Server',
		noneText: 'Diese Version hat keinen Server: Spiele und Zeiten bleiben auf diesem Gerät.',
		offlineMode: 'Offline-Modus',
		offlineModeText: 'Sendet nichts und lädt Seiten von diesem Gerät, z. B. im Zug.',
		offlineModeSync: '„Jetzt synchronisieren“ geht trotzdem, wenn du es antippst.',
		syncNow: 'Jetzt synchronisieren',
		syncing: 'Synchronisiere…',
		syncFailed: 'Der Server hat nicht geantwortet.',
		pending: '{count} Änderungen warten auf den Server',
		pendingOne: '1 Änderung wartet auf den Server',
		lastSync: 'Zuletzt synchronisiert um {time} Uhr',
		lastContact: 'Letzte Antwort um {time} Uhr',
		noPlayer: 'Wähle einen Spielernamen, um zwischen Geräten zu synchronisieren.',
		updateCheck: 'Nach Updates suchen',
		updateCheckText: 'Sucht ab und zu nach einer neuen Version, aber nicht im Offline-Modus.',
		checkNow: 'Jetzt suchen',
		upToDate: 'Das ist die neueste Version.',
		checkFailed: 'Konnte nicht nach einer neuen Version suchen.',
		offlineError: 'Der Offline-Modus ist an.',
		noConnection: 'keine Verbindung zum Server, die gewertete Rätsel beim Lösen brauchen',
		offlineHint:
			'Der Offline-Modus ist an. Schalte ihn oben im Verbindungsmenü aus, um den Server zu nutzen.',
		unreachableHint: 'Der Server ist gerade nicht erreichbar. Die App fragt von selbst wieder nach.'
	},
	update: {
		available: 'Eine neue Version ist da.',
		reload: 'Neu laden',
		dismiss: 'Später'
	},
	inside: {
		link: 'Hinter den Kulissen'
	},
	about: {
		link: 'Über',
		title: 'Über Vibe Puzzles',
		intro: 'Logikrätsel im Browser. Jedes Rätsel hat genau eine Lösung.',
		contact: 'Fragen, Ideen oder einen Fehler gefunden? Schreib an',
		inside: 'Wie entstehen die Rätsel, und wie schwer sind sie?',
		insideLink: 'Schau Schritt für Schritt zu',
		build: 'Build',
		version: 'Version',
		commit: 'Commit',
		built: 'Erstellt',
		source: 'Quellcode',
		changes: 'Änderungen',
		changesNote:
			'Was sich mit jeder Version geändert hat, die neueste zuerst. Die Liste gibt es nur auf Englisch.',
		release: 'Version {version} vom {date}',
		unreleased: 'Noch in keiner Version',
		earlier: 'Frühere Versionen',
		changeKind: { added: 'Neu', changed: 'Geändert', fixed: 'Behoben', removed: 'Entfernt' },
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
			tagline: 'Schattiere in jedem Bereich ein Tetromino.',
			rules: [
				'Schattiere in jedem Bereich genau ein Tetromino (4 zusammenhängende Felder).',
				'Zwei gleiche Tetrominos dürfen sich nicht an einer Kante berühren. Gedrehte oder gespiegelte zählen als gleich.',
				'Alle schattierten Felder hängen zusammen.',
				'Kein 2×2-Block darf ganz schattiert sein.'
			],
			notes: ['Oft entscheidend: Hängt noch alles zusammen, wenn das Tetromino hier liegt?'],
			toolHint: {
				rotate:
					'Jeder Klick auf ein Feld schaltet weiter: leer, schattiert, Kreuz und wieder leer. Rechtsklick schaltet rückwärts.',
				black: 'Ein Klick schattiert ein Feld, ein zweiter leert es. Rechtsklick setzt ein Kreuz.',
				cross:
					'Ein Klick markiert ein Feld mit einem Kreuz: Es bleibt weiß. Ein zweiter Klick entfernt das Kreuz.',
				blank: 'Leert jedes Feld, das du anklickst oder überstreichst.'
			},
			controlsMouse:
				'Klicke auf ein Feld, um es zu schattieren, Rechtsklick setzt ein Kreuz. Ziehen markiert mehrere Felder. Die Tasten 1–4 wählen ein Werkzeug.',
			controlsTouch:
				'Tippe ein Feld an, um zwischen schattiert, Kreuz und leer zu wechseln. Kurz halten und ziehen markiert mehrere Felder.',
			controlsKeys:
				'Pfeiltasten oder W, A, S, D bewegen einen Cursor über die Felder, die Leertaste wirkt auf das Feld darunter wie ein Klick. Halte {mod} und drücke die Pfeile, um jedes Feld auf dem Weg zu markieren, oder halte Shift für die Markierung der rechten Maustaste; beim Loslassen wird sie gesetzt. Esc blendet den Cursor aus.',
			speech: {
				place: '{place}, Bereich {region}',
				shaded: 'schattiert',
				cross: 'Kreuz',
				shape: '{shape}-Tetromino'
			},
			settingHelp: {
				highlightErrors:
					'Schattierte Felder werden rot, wenn sie gegen eine Regel verstoßen: ein voller 2×2-Block, gleiche Tetrominos nebeneinander, mehr als vier Felder in einem Bereich oder eine Gruppe, die nicht mehr zum Rest finden kann.'
			},
			hints: {
				region:
					'Schau, welche Tetrominos bei seiner Form und deinen Markierungen noch in den hinterlegten Bereich passen.',
				sameShape:
					'Streiche Tetrominos, die ein gleiches berühren würden: Alles, was in einem hinterlegten Nachbarbereich noch passt, hat diese Form.',
				square: 'Streiche Tetrominos, die einen schattierten 2×2-Block vervollständigen würden.',
				neighbour:
					'Streiche Tetrominos, die sich mit jeder Möglichkeit in einem hinterlegten Nachbarbereich beißen: Jede davon würde eine gleiche Form berühren oder einen 2×2-Block vervollständigen.',
				lookAhead:
					'Streiche Tetrominos, die die schattierten Felder trennen würden: Frag dich, ob noch alles zusammenhängen könnte, wenn das Tetromino dort läge.',
				assumption:
					'Hier hilft keine einfache Regel weiter, also probier es aus: Angenommen, das Tetromino dieses Bereichs läge auf den hinterlegten Feldern. Spiel das durch, dann wird eine Regel verletzt. Also liegt es woanders.',
				shade:
					'Alle Tetrominos, die in diesem Bereich noch möglich sind, enthalten die markierten Felder: Schattiere sie.',
				cross:
					'Keins der Tetrominos, die in diesem Bereich noch möglich sind, enthält die markierten Felder: Sie bleiben leer.',
				stuck:
					'Hier legt keine Regel ein weiteres Feld fest. Schwere Rätsel brauchen eine Fallunterscheidung: Leg im Kopf ein Tetromino in den markierten Bereich und spiel es durch, bis eine Regel verletzt wird.'
			},
			tutorial: [
				{
					text: 'Jeder dick umrandete Bereich braucht genau ein Tetromino: vier schattierte Felder, die mit ihren Seiten aneinanderstoßen. Es gibt vier Formen, I, L, T und S, die auch gedreht oder gespiegelt sein dürfen. Der Bereich oben links ist schon fertig: Er enthält ein S, und Kreuze markieren seine leeren Felder. Schau dir das Spielfeld erst einmal nur an: Ab Schritt 2 schattierst du selbst.'
				},
				{
					text: 'Der Bereich oben rechts hat genau vier Felder, sein Tetromino füllt ihn also ganz aus.',
					task: 'Schattiere alle vier Felder dieses Bereichs.',
					done: 'Geschafft: Dieses Tetromino ist ein L. Das klappt auch in größeren Bereichen: Ein Feld, das jedes dort noch mögliche Tetromino enthält, ist immer schattiert.'
				},
				{
					text: 'Kein 2×2-Block darf ganz schattiert sein. Die drei markierten Felder würden jeweils einen 2×2-Block vollmachen, in dem schon drei Felder schattiert sind.',
					task: 'Markiere alle drei Felder mit einem Kreuz: Wähle das Werkzeug Kreuz (✕) und klicke oder tippe sie an. Ein Kreuz heißt, das Feld bleibt leer.',
					done: 'Richtig: Diese Felder bleiben leer, du hast sie endgültig ausgeschlossen.'
				},
				{
					text: 'Nächste Regel: Alle schattierten Felder bilden zusammen eine verbundene Gruppe. Die Gruppe oben links hat nur noch einen freien Nachbarn, das markierte Feld. Alle anderen sind angekreuzt. Auch unten und rechts kommen aber schattierte Felder hin.',
					task: 'Schattiere das markierte Feld: Nur darüber kann die Gruppe den Rest erreichen.',
					done: 'Genau: Ohne dieses Feld wäre die Gruppe oben links eingesperrt.'
				},
				{
					text: 'Unten passen nur noch zwei Tetrominos: ein I in der unteren Reihe oder ein L, das links ein Feld nach oben geht. Frag dich bei jedem: Könnte dann noch alles zusammenhängen? Mit dem L käme die Gruppe unten nur über das Feld über ihrem rechten Ende hinaus. Das Tetromino im großen Bereich enthält aber schon das Feld oben rechts und reicht nicht bis dorthin.',
					task: 'Schattiere das Tetromino, das unten übrig bleibt.',
					done: 'Richtig: Mit dem L wäre die Gruppe unten abgeschnitten. Das ist kein Raten: Du prüfst eine Lage und siehst sofort, dass sie scheitert. Dieser Schluss hilft oft, wenn keine andere Regel mehr greift.'
				},
				{
					text: 'Die letzte Regel: Zwei Tetrominos derselben Form dürfen sich über eine Bereichsgrenze nicht berühren. Gedrehte oder gespiegelte zählen als dieselbe Form. Das Tetromino rechts berührt schon das L oben, ist also kein L. Felder, die eine Regel verletzen, werden rot.',
					task: 'Schattiere das Tetromino im großen Bereich rechts.'
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
			controlsKeys:
				'Pfeiltasten oder W, A, S, D bewegen einen Cursor über die Punkte. Halte {mod} und drücke die Pfeile, um Linien entlang des Wegs zu ziehen, wie mit der Maus; beim Loslassen werden sie gesetzt. Esc blendet den Cursor aus.',
			speech: {
				border: 'Rand: {list}',
				circles: 'Kreise: {list}',
				locked: 'gesperrt'
			},
			settingHelp: {
				autoSubmit:
					'Das Rätsel gilt als gelöst, sobald alle Bereiche stimmen, ob mit Linien gezogen oder mit Farben ausgemalt. Aus: Du drückst selbst auf „Fertig“, und nur die Linien zählen.',
				highlightErrors:
					'Ein abgetrennter Bereich ohne Kreis wird rot, ebenso der Kreis eines abgeschlossenen Bereichs, der nicht symmetrisch ist.'
			},
			hints: {
				look: 'Schau dir die hinterlegten Felder an.',
				centre:
					'Die Felder unter einem Kreis gehören zu seinem Bereich. Ein Feld, dessen Partnerfeld gegenüber einem Kreis außerhalb des Spielfelds läge, kann nicht zu dessen Bereich gehören.',
				marks:
					'Deine Linien trennen Felder in verschiedene Bereiche, deine Kreuze verbinden Felder zu einem.',
				symmetry:
					'Ein Feld kann nur dann zum Bereich eines Kreises gehören, wenn sein Partnerfeld gegenüber diesem Kreis es auch kann.',
				reach:
					'Ein Bereich hängt zusammen: Ein Feld gehört nur dazu, wenn vom Kreis aus ein Weg dorthin führt, der nur über Felder geht, die zum Bereich gehören können.',
				assumption:
					'Hier hilft keine einfache Regel weiter, also probier es aus: Angenommen, die zwei hinterlegten Felder gehörten zum Bereich des Kreises genau zwischen ihnen. Spiel das durch, dann wird eine Regel verletzt. Also gehört keins der beiden zu diesem Bereich.',
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
			speech: {
				given: 'vorgegeben',
				notes: 'Notizen {list}',
				cage: 'Käfig {label}, {count} Felder',
				cageOne: 'Käfig {label}, ein Feld'
			},
			settingHelp: {
				hideControls:
					'Blendet die Buttons „Ziffer“ und „Notiz“ aus, der Ziffernblock bleibt. Das zuletzt gewählte Werkzeug bleibt aktiv. Gilt nur auf diesem Gerät.',
				highlightErrors:
					'Eine Ziffer, die doppelt in einer Zeile, Spalte oder einem Block steht, wird rot. Mit der Lösung wird dabei nicht verglichen, das macht „Falsche Ziffern rot färben“.'
			},
			hints: {
				where: {
					box: 'Im hinterlegten Block passt eine der fehlenden Ziffern nur in ein Feld. Welche, und wohin?',
					row: 'In der hinterlegten Zeile passt eine der fehlenden Ziffern nur in ein Feld. Welche, und wohin?',
					column:
						'In der hinterlegten Spalte passt eine der fehlenden Ziffern nur in ein Feld. Welche, und wohin?'
				},
				whereNaked:
					'Für das Feld, in dem sich die hinterlegte Zeile und Spalte kreuzen, lassen Zeile, Spalte und Block nur eine Ziffer übrig. Welche?',
				hidden: {
					box: 'In ihrem Block passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in Zeile oder Spalte, oder deine Notizen schließen sie aus.',
					row: 'In ihrer Zeile passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in Spalte oder Block, oder deine Notizen schließen sie aus.',
					column:
						'In ihrer Spalte passt die {digit} nur ins markierte Feld: Bei den anderen freien Feldern dort steht schon eine {digit} in Zeile oder Block, oder deine Notizen schließen sie aus.'
				},
				naked:
					'Ins markierte Feld passt nur die {digit}: Zeile, Spalte und Block enthalten alle anderen Ziffern, oder deine Notizen schließen sie aus.',
				lockedCandidates:
					'Notiere zuerst die Kandidaten. Passt eine Ziffer in einem Block nur in Felder einer Zeile (oder Spalte), wie die hinterlegten, fällt sie im Rest dieser Zeile weg; und umgekehrt.',
				nakedSubset:
					'Notiere zuerst die Kandidaten. Zwei Felder einer Zeile, Spalte oder eines Blocks mit denselben zwei Kandidaten (oder drei Felder mit drei), wie die hinterlegten, belegen diese Ziffern: In den anderen Feldern dort fallen sie weg.',
				hiddenSubset:
					'Notiere zuerst die Kandidaten. Zwei Ziffern, die in einer Zeile, Spalte oder einem Block nur in dieselben zwei Felder passen (oder drei in drei), wie die hinterlegten, füllen diese Felder: Deren andere Kandidaten fallen weg.',
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
					setting: {
						highlightLines: 'Zeile und Spalte hervorheben'
					},
					settingHelp: {
						highlightErrors:
							'Eine Ziffer, die doppelt in einer Zeile oder Spalte steht, wird rot, ebenso die Angabe eines vollen Käfigs, dessen Rechnung nicht aufgeht. Mit der Lösung wird dabei nicht verglichen.',
						autoNotes:
							'Jedes leere Feld ohne Notizen bekommt die Ziffern, die Zeile und Spalte dort noch zulassen. Die Käfige bleiben dir überlassen.',
						autoRemoveNotes:
							'Eine neue Ziffer verschwindet aus den Notizen in ihrer Zeile und Spalte.',
						highlightLines: 'Hinterlegt Zeile und Spalte des gewählten Felds.'
					},
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
						whereNaked:
							'Die hinterlegte Zeile und Spalte lassen für das Feld, in dem sie sich kreuzen, nur eine Ziffer übrig. Welche?',
						naked:
							'Ins markierte Feld passt nur die {digit}: Zeile und Spalte enthalten alle anderen Ziffern, oder deine Notizen schließen sie aus.',
						cage: 'Rechne bei jedem hinterlegten Käfig aus, welche Ziffern mit seiner Rechenart sein Ergebnis liefern können; in einer Zeile oder Spalte müssen sie verschieden sein.',
						cageGiven:
							'Ein Käfig mit nur einer Zahl, wie der hinterlegte „{cage}“, enthält genau diese Ziffer.',
						cageOne:
							'Rechne aus, welche Ziffern im hinterlegten Käfig „{cage}“ stehen können: Sie müssen mit seiner Rechenart sein Ergebnis liefern und in einer Zeile oder Spalte verschieden sein.',
						nakedPair:
							'Notiere zuerst die Kandidaten. Zwei Felder einer Zeile oder Spalte mit denselben zwei Kandidaten, wie die hinterlegten, belegen diese Ziffern: In den anderen Feldern dort fallen sie weg.'
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
					text: 'Blöcke und Spalten funktionieren genauso. Der Block oben links hat 1, 2 und 3, sein leeres Feld bekommt die fehlende Ziffer.',
					task: 'Fülle das leere Feld im Block oben links.',
					done: 'Genau: Dem Block fehlte seine 4.'
				},
				{
					text: 'Oft fehlt nirgends nur noch eine einzige Ziffer. Dann dreh die Frage um: Wo kann eine Ziffer hin? Der markierte Block unten rechts braucht noch eine 1. Die 1 in der dritten Zeile und die 1 in der dritten Spalte schließen drei seiner Felder aus.',
					task: 'Setz die 1 in das einzige Feld dieses Blocks, in das sie passt.',
					done: 'Richtig: der einzige Platz, der übrig blieb. Die meisten Schritte in echten Rätseln gehen so, und der Tipp stellt dieselbe Frage.'
				},
				{
					text: 'Fünf Felder sind noch übrig. Prüfe bei jedem seine Zeile, Spalte und seinen Block, oder frag, wo eine Ziffer hinkann. Noch unsicher? Mit dem Werkzeug Notiz (✎) notierst du kleine Ziffern als Gedächtnisstütze. Doppelte Ziffern werden rot.',
					task: 'Fülle die letzten fünf Felder selbst aus.'
				}
			]
		},
		loop: {
			tagline: 'Zeichne eine geschlossene Schleife um die Zahlen.',
			rules: [
				'Verbinde benachbarte Punkte mit Linien zu einer einzigen geschlossenen Schleife.',
				'Die Schleife kreuzt und berührt sich nie und hat keine losen Enden.',
				'Eine Zahl sagt, an wie vielen der vier Seiten ihres Felds die Schleife entlangläuft. Felder ohne Zahl können beliebig viele haben.'
			],
			notes: [
				'Oft entscheidend: Die beiden Felder an einer Linie liegen auf verschiedenen Seiten der Schleife, die an einem Kreuz auf derselben.'
			],
			tool: { black: 'Linie' },
			toolHint: {
				rotate:
					'Jeder Klick auf eine Kante schaltet weiter: leer, Linie, Kreuz und wieder leer. Rechtsklick schaltet rückwärts.',
				black:
					'Klick auf eine Kante zieht eine Linie, ein zweiter Klick entfernt sie. Rechtsklick setzt ein Kreuz.',
				cross:
					'Klick markiert eine Kante mit einem Kreuz: Dort verläuft die Schleife nicht. Ein zweiter Klick entfernt es.',
				blank: 'Leert jede Kante, die du anklickst oder überstreichst.'
			},
			controlsMouse:
				'Klicke zwischen zwei Punkte, um eine Linie zu ziehen, oder zieh über die Punkte, um mehrere zu zeichnen. Rechtsklick setzt ein Kreuz.',
			controlsTouch:
				'Tippe zwischen zwei Punkte, um eine Linie zu ziehen, oder halte und zieh über die Punkte, um mehrere zu zeichnen. Mit dem Kreuz-Werkzeug markierst du Kanten, die die Schleife meidet.',
			controlsKeys:
				'Pfeiltasten oder W, A, S, D bewegen einen Cursor über die Punkte. Halte {mod} und drücke die Pfeile, um Linien entlang des Wegs zu ziehen, wie mit der Maus; beim Loslassen werden sie gesetzt. Esc blendet den Cursor aus.',
			speech: {
				numbers: 'Zahlen: {list}'
			},
			settingHelp: {
				highlightErrors:
					'Ein Punkt wird rot, wo sich die Linie verzweigt oder nicht weiterkommt, eine Zahl, wenn sie zu viele Linien oder Kreuze hat. Ist die Schleife geschlossen, werden auch Zahlen rot, denen noch Linien fehlen.'
			},
			/** Was der Tipp sagt: wo man hinschaut und welche Regel gilt, dann was folgt. */
			hints: {
				clueLook: 'Zähl die Linien und Kreuze um die hinterlegte {clue}.',
				clueZero: 'Eine 0 hat an keiner Seite eine Linie: Setz Kreuze auf die markierten Kanten.',
				clueFull: 'Sie hat schon so viele Linien wie ihre Zahl: Ihre übrigen Seiten bleiben leer.',
				clueFill:
					'Ihre freien Seiten reichen gerade für ihre Zahl: Die Schleife läuft an allen entlang. Zieh die Linien.',
				dotLook:
					'Schau dir den hinterlegten Punkt an: Die Schleife geht mit zwei Linien oder gar nicht durch einen Punkt.',
				dotFull:
					'Dort treffen sich schon zwei Linien, also berührt ihn keine weitere: Setz Kreuze auf den Rest.',
				dotOn:
					'Eine Linie kommt dort an, und es bleibt ihr nur ein Weg weiter: Zieh dort die Linie.',
				dotEnd:
					'Keine Linie kommt dort an, und nur eine Kante ist noch frei: Eine Linie dort würde am Punkt enden. Setz ein Kreuz.',
				loopLook:
					'Folge der hinterlegten Linie: Ihre beiden Enden liegen nur eine Kante auseinander.',
				loop: 'Sie zu verbinden würde eine Schleife schließen. Es gibt aber nur eine Schleife, und sie muss noch an den anderen Linien und Zahlen vorbei. Setz ein Kreuz auf die markierte Kante.',
				cornerLook:
					'Schau dir die hinterlegte {clue} und die Punkte an ihren Ecken an: Jeder Punkt bekommt zwei Linien oder keine, nie eine oder drei.',
				cornerLine:
					'Probier die Möglichkeiten für die Seiten der {clue} durch: In jeder, die zu ihrer Zahl und ihren Ecken passt, haben die markierten Kanten eine Linie. Zieh sie.',
				cornerCross:
					'Probier die Möglichkeiten für die Seiten der {clue} durch: In jeder, die zu ihrer Zahl und ihren Ecken passt, bleiben die markierten Kanten leer. Setz Kreuze.',
				pairLook:
					'Schau dir die beiden hinterlegten Zahlen zusammen an und den Punkt, den sie teilen: Jeder Punkt bekommt zwei Linien oder keine.',
				pairLine:
					'Probier die Möglichkeiten für die Seiten beider Zahlen durch: In jeder, die zu beiden Zahlen passt und jedem Punkt zwei Linien oder keine lässt, haben die markierten Kanten eine Linie. Zieh sie.',
				pairCross:
					'Probier die Möglichkeiten für die Seiten beider Zahlen durch: In jeder, die zu beiden Zahlen passt und jedem Punkt zwei Linien oder keine lässt, bleiben die markierten Kanten leer. Setz Kreuze.',
				sidesLook:
					'Denk an innen und außen: Jedes Feld liegt innerhalb oder außerhalb der Schleife, und jenseits des Spielfelds ist außen. Über eine Linie wechselst du die Seite, über ein Kreuz nicht.',
				sidesSame:
					'Geh über deine Linien und Kreuze an den hinterlegten Feldern entlang: Du wechselst die Seite eine gerade Zahl von Malen, also liegen die beiden Felder an der markierten Kante auf derselben Seite. Zwischen ihnen verläuft keine Linie.',
				sidesOther:
					'Geh über deine Linien und Kreuze an den hinterlegten Feldern entlang: Du wechselst die Seite eine ungerade Zahl von Malen, also liegen die beiden Felder an der markierten Kante auf verschiedenen Seiten. Zwischen ihnen verläuft eine Linie.',
				blockLook:
					'Schau dir den hinterlegten 2×2-Block an: Seine Zahlen behalten ihre Anzahl, und jeder Punkt bekommt zwei Linien oder keine.',
				blockLine:
					'Probier die Möglichkeiten für die Kanten des Blocks durch: In jeder, die passt, haben die markierten Kanten eine Linie. Zieh sie.',
				blockCross:
					'Probier die Möglichkeiten für die Kanten des Blocks durch: In jeder, die passt, bleiben die markierten Kanten leer. Setz Kreuze.',
				splitLook:
					'Denk an innen und außen rund um die hinterlegte {clue}: Eine Zahl zählt ihre Nachbarfelder auf der anderen Seite der Schleife, und jenseits des Spielfelds ist außen.',
				splitTwoLook:
					'Denk an innen und außen rund um die hinterlegte 2: Sie zählt ihre Nachbarfelder auf der anderen Seite der Schleife, also liegen zwei davon innen und zwei außen. Jenseits des Spielfelds ist außen.',
				splitLine:
					'Geh über deine Linien und Kreuze an den hinterlegten Feldern entlang: Über eine Linie wechselst du die Seite, über ein Kreuz nicht. Probier dann die Möglichkeiten durch, die {clue} und ihre Nachbarn nach innen oder außen zu legen: In jeder, die zu ihrer Zahl und diesen Wegen passt, liegen die beiden Felder an der markierten Kante auf verschiedenen Seiten. Zwischen ihnen verläuft eine Linie.',
				splitCross:
					'Geh über deine Linien und Kreuze an den hinterlegten Feldern entlang: Über eine Linie wechselst du die Seite, über ein Kreuz nicht. Probier dann die Möglichkeiten durch, die {clue} und ihre Nachbarn nach innen oder außen zu legen: In jeder, die zu ihrer Zahl und diesen Wegen passt, liegen die beiden Felder an der markierten Kante auf derselben Seite. Zwischen ihnen verläuft keine Linie.',
				splitPairLook:
					'Denk an innen und außen rund um die beiden hinterlegten Zahlen: Eine Zahl zählt ihre Nachbarfelder auf der anderen Seite der Schleife (eine 2 hat also zwei Nachbarn innen und zwei außen), und jenseits des Spielfelds ist außen.',
				splitPairLine:
					'Geh über deine Linien und Kreuze an den hinterlegten Feldern entlang: Über eine Linie wechselst du die Seite, über ein Kreuz nicht. Probier dann die Möglichkeiten durch, beide Zahlen und ihre Nachbarn nach innen oder außen zu legen: In jeder, die zu beiden Zahlen und diesen Wegen passt, liegen die beiden Felder an der markierten Kante auf verschiedenen Seiten. Zwischen ihnen verläuft eine Linie.',
				splitPairCross:
					'Geh über deine Linien und Kreuze an den hinterlegten Feldern entlang: Über eine Linie wechselst du die Seite, über ein Kreuz nicht. Probier dann die Möglichkeiten durch, beide Zahlen und ihre Nachbarn nach innen oder außen zu legen: In jeder, die zu beiden Zahlen und diesen Wegen passt, liegen die beiden Felder an der markierten Kante auf derselben Seite. Zwischen ihnen verläuft keine Linie.',
				assumeLook:
					'Hier hilft keine einfache Regel weiter: Probier im Kopf eine Kante an den hinterlegten Feldern aus.',
				assumeLine:
					'Hier hilft keine einfache Regel weiter, also probier es aus: Angenommen, die markierte Kante hätte eine Linie. Wende von dort aus die Regeln an.',
				assumeCross:
					'Hier hilft keine einfache Regel weiter, also probier es aus: Angenommen, die markierte Kante bliebe leer. Wende von dort aus die Regeln an.',
				breaksClue: 'Die hinterlegte Zahl bekommt die falsche Anzahl Linien.',
				breaksDot: 'Ein Punkt an der hinterlegten Stelle bekommt eine Linie oder drei.',
				breaksLoop: 'Die Linien schließen zu früh eine Schleife oder können keine mehr bilden.',
				breaksSides: 'Manche Felder müssten zugleich innerhalb und außerhalb der Schleife liegen.',
				emptyZero: 'Die hinterlegten Seiten der 0 bleiben leer.',
				emptyFull:
					'Die hinterlegte Zahl hat alle ihre Linien: Ihre hinterlegten Seiten bleiben leer.',
				emptyDotFull:
					'Am hinterlegten Punkt treffen sich zwei Linien: Seine hinterlegten Kanten bleiben leer.',
				emptyDotEnd:
					'Eine Linie auf der hinterlegten Kante würde an einem Punkt ohne anderen Ausweg enden: Sie bleibt leer.',
				emptyLoop:
					'Eine Linie auf der hinterlegten Kante würde zu früh eine Schleife schließen: Sie bleibt leer.',
				emptyWindow:
					'Keine Möglichkeit für die Seiten der hinterlegten Zahlen, die zu ihren Zahlen und Punkten passt, legt eine Linie auf die hinterlegten Kanten daneben.',
				emptySides:
					'Die Felder an der hinterlegten Kante liegen auf derselben Seite der Schleife: Sie bleibt leer.',
				emptySplit:
					'Innen und außen rund um die hinterlegten Zahlen legen die Felder an der hinterlegten Kante auf dieselbe Seite: Sie bleibt leer.',
				thenLine: 'Also muss die Schleife dort entlang: Zieh die Linie.',
				thenCross: 'Also verläuft dort keine Linie: Setz ein Kreuz.',
				stuck:
					'Hier legt keine Regel eine weitere Kante fest. Probier im Kopf eine Linie auf der markierten Kante aus und spiel sie durch, bis eine Regel verletzt wird.'
			},
			tutorial: [
				{
					text: 'Bei Loop geht es um eine einzige geschlossene Schleife. Du zeichnest sie zwischen benachbarten Punkten, ohne Abzweigungen und ohne lose Enden. Eine Zahl sagt, an wie vielen der vier Seiten ihres Felds die Schleife entlangläuft; Felder ohne Zahl können beliebig viele haben. Schau dir das Spielfeld erst einmal nur an: Ab Schritt 2 zeichnest du.'
				},
				{
					text: 'Fang mit der 0 an: An keiner ihrer Seiten läuft die Schleife entlang. Ein Kreuz markiert eine Kante, auf der keine Linie verläuft.',
					task: 'Wähle das Kreuz-Werkzeug (✕) und setz Kreuze auf alle vier Seiten der 0. Mit der Maus setzt auch ein Rechtsklick ein Kreuz.',
					done: 'Geschafft. Kreuze gehören nicht zur Schleife, aber sie zeigen auf einen Blick, wo sie nicht hinkann.'
				},
				{
					text: 'Eine 3 hat die Schleife an drei ihrer vier Seiten. Jede 3 hier grenzt mit einer Seite an die 0, und dort steht ein Kreuz. Also läuft die Schleife an ihren drei anderen Seiten entlang.',
					task: 'Wähle wieder das Linien-Werkzeug (╱) und zieh Linien an den freien Seiten jeder 3. Zieh über die Punkte, um mehrere Linien auf einmal zu zeichnen.',
					done: 'Richtig. Eine Zahl wird grau, sobald sie alle ihre Linien hat. Unter der 0 sind die Linien schon verbunden.'
				},
				{
					text: 'Die Schleife geht durch einen Punkt hindurch oder an ihm vorbei: Jeder Punkt bekommt zwei Linien oder keine, nie eine oder drei. An jedem markierten Punkt endet eine Linie, und Kreuze versperren ihr jeden Weg bis auf einen.',
					task: 'Führe die Linie an beiden markierten Punkten weiter.',
					done: 'Genau: Wo eine Linie nur einen Weg weiter hat, geht sie dort entlang.'
				},
				{
					text: 'Jetzt liegen die beiden Enden der Linie nebeneinander. Eine Linie zwischen ihnen würde die Schleife nur um diese paar Felder schließen, aber die Zahlen weiter unten brauchen noch ihre Linien. Es gibt nur eine Schleife, also darf sie sich nicht zu früh schließen.',
					task: 'Setz ein Kreuz auf die Kante zwischen den beiden Enden.',
					done: 'Richtig. Jetzt hat jedes Ende wieder nur einen Weg weiter, am Rand entlang.'
				},
				{
					text: 'Der Rest gehört dir, mit denselben drei Ideen: Zähl die Linien an jeder Zahl, gib jedem Punkt zwei Linien oder keine, und schließ die Schleife erst ganz am Ende. Ein Punkt wird rot, wo sich die Linie verzweigt oder nicht weiterkommt.',
					task: 'Vervollständige die Schleife selbst.'
				}
			]
		}
	}
};

export default de;

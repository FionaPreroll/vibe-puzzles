import type { InsideDictionary } from './en';

/** German texts of the Inside page. */
const de: InsideDictionary = {
	title: 'Hinter den Kulissen',
	intro:
		'Wie baut ein Computer ein Rätsel mit genau einer Lösung, und woher weiß er, wie schwer es ist? Schau ihm an einem echten Rätsel zu, Schritt für Schritt.',
	films: {
		label: 'Filme',
		sudoku: 'So entsteht ein Sudoku',
		pinwheel: 'So entsteht ein Pinwheel'
	},
	player: {
		play: 'Abspielen',
		pause: 'Pause',
		back: 'Zurück zum Anfang des Kapitels',
		next: 'Nächstes Kapitel',
		stepBack: 'Einen Schritt zurück',
		stepForward: 'Einen Schritt vor',
		speed: 'Tempo',
		detail: 'Genauer',
		another: 'Anderes Beispiel',
		position: 'Stelle im Film',
		chapters: 'Kapitel',
		step: 'Schritt {n} von {count}',
		keys: 'Die Leertaste spielt und pausiert, ← und → gehen einen Schritt, Bild ↑ und Bild ↓ springen zwischen den Kapiteln.'
	},
	sudoku: {
		chapters: {
			fill: 'Ein volles Gitter',
			dig: 'Ausdünnen',
			solve: 'Lösen wie ein Mensch'
		},
		fill: {
			start:
				'Jedes Sudoku beginnt leer. Zuerst füllt der Computer das ganze Gitter: Das wird die Lösung.',
			place:
				'Er nimmt das Feld, in das die wenigsten Ziffern noch passen, und davon eine zufällige Ziffer.',
			stuck: 'Sackgasse: In das markierte Feld passt keine Ziffer mehr.',
			back: 'Also kommt die letzte Ziffer wieder heraus, und dort wird die nächste probiert.',
			done: 'Voll: Jede Zeile, jede Spalte und jeder Block enthält jede Ziffer einmal.',
			detail:
				'Backtracking-Suche: Verzweigt wird immer am leeren Feld mit den wenigsten Kandidaten. Zeilen, Spalten und Blöcke sind Bitmasken, ein Test, ob eine Ziffer passt, ist ein einziges UND. Ein Zufallsgenerator mit der Rätsel-ID als Startwert mischt die Ziffern, darum ergibt dieselbe ID immer dasselbe Gitter.'
		},
		dig: {
			start:
				'Jetzt kommen Ziffern wieder heraus, immer zwei: ein Feld und sein Spiegelbild durch die Mitte.',
			try: 'Kann ein Mensch es noch ohne Raten lösen?',
			keep: 'Ja, also bleiben sie draußen. Noch {givens} Ziffern.',
			restore: 'Nein, man käme nicht weiter. Sie kommen zurück.',
			done: 'Alle Paare sind probiert. {givens} Ziffern bleiben: Das ist das Rätsel.',
			detail:
				'Nach jedem Herausnehmen läuft der Bewertungs-Solver, nur mit nackten und versteckten Singles. Füllt er das Gitter, war jede Ziffer erzwungen. Das beweist auch, dass die Lösung eindeutig ist: Eine Suche nach einer zweiten Lösung braucht es nicht. Weil immer Paare herausgehen, bleiben die Vorgaben punktsymmetrisch.'
		},
		solve: {
			start:
				'Um es zu bewerten, löst der Computer das Rätsel wie ein Mensch. Zuerst notiert er in jedem Feld alle Ziffern, die noch passen.',
			startDetail:
				'Kandidaten sind Bitmasken: Eine gesetzte Ziffer wird aus den Masken ihrer 20 Nachbarn in Zeile, Spalte und Block gelöscht.',
			naked: 'In diesem Feld ist nur noch die {digit} übrig.',
			nakedDetail:
				'Ein nackter Single: Jede andere Ziffer steht schon in der Zeile, der Spalte oder im Block des Felds.',
			hidden: {
				row: 'In dieser Zeile passt die {digit} nur in ein Feld.',
				column: 'In dieser Spalte passt die {digit} nur in ein Feld.',
				box: 'In diesem Block passt die {digit} nur in ein Feld.'
			},
			hiddenDetail:
				'Ein versteckter Single: Kein anderes Feld der Zeile, der Spalte oder des Blocks kann die Ziffer nehmen.',
			done: 'Gelöst mit {singles} Singles und ohne Raten: ein normales Sudoku.',
			doneDetail:
				'Die Schwierigkeit ist die schwächste Gruppe von Techniken, die das Rätsel löst. Normal braucht nur Singles. Schwer braucht dazu gesperrte Kandidaten oder nackte und versteckte Paare und Dreier.'
		}
	},
	pinwheel: {
		chapters: {
			grow: 'Galaxien wachsen',
			unique: 'Nur eine Lösung',
			grade: 'Normal oder schwer?'
		},
		grow: {
			start:
				'Ein Pinwheel-Spielfeld ist in Galaxien aufgeteilt. Jede sieht nach einer halben Drehung um ihr Zentrum gleich aus. Der Computer beginnt mit einem leeren 7×7-Feld.',
			centre:
				'Eine neue Galaxie beginnt an einem freien Feld mit wenigen freien Nachbarn. Ihr Zentrum liegt auf einem Feld, einer Kante oder einer Ecke.',
			grow: 'Sie wächst um ein Feld und sein Spiegelbild durch das Zentrum, so bleibt sie symmetrisch.',
			absorb:
				'Eine Galaxie schluckt zwei Ein-Feld-Galaxien, die Spiegelbilder voneinander sind: weniger winzige Stücke.',
			done: 'Jedes Feld gehört zu einer Galaxie. Aber ist das die einzige Art, das Feld um diese Zentren aufzuteilen?',
			detail:
				'Zentren haben halbe Feldkoordinaten: Eines auf einer Kante deckt zwei Felder, eines auf einer Ecke vier. Jede Galaxie wächst bis zu einer zufälligen Größe und nimmt ein freies Feld nur zusammen mit seinem freien Spiegelfeld.'
		},
		unique: {
			start:
				'Der Spieler sieht nur die Zentren. Der Solver prüft, ob sie eine zweite Aufteilung erlauben.',
			second:
				'Er findet eine: Die markierten Felder könnten zu anderen Galaxien gehören. Die türkisen Linien zeigen diese andere Lösung.',
			cut: 'Also wird eines dieser Felder mit seinem Spiegelbild herausgeschnitten, und jedes wird eine eigene Galaxie.',
			done: 'Jetzt findet der Solver keine andere Aufteilung mehr: Die Lösung ist eindeutig.',
			already: 'Der Solver findet keine andere Aufteilung: Die Lösung ist so schon eindeutig.',
			detail:
				'Der Solver merkt sich für jedes Feld die Zentren, zu denen es noch gehören kann (eine Bitmap). Die Propagation streicht die, die Symmetrie oder Zusammenhang verletzen. Kommt sie nicht weiter, probiert der Solver die Möglichkeiten des Felds mit den wenigsten übrigen. Er hört bei der zweiten Lösung auf oder nach 3.000 Suchknoten.'
		},
		grade: {
			start:
				'Zur Bewertung schließt der Solver jetzt nur noch, ohne etwas auszuprobieren. Zu Beginn stehen {settled} Felder fest: die unter den Zentren.',
			round: 'Runde {round}: Spiegelbilder und Zusammenhang legen {count} weitere Felder fest.',
			stuck:
				'Festgefahren: {open} Felder könnten noch zu mehr als einer Galaxie gehören. Weiter geht es nur mit Ausprobieren, also ist das ein schweres Rätsel.',
			solved: 'Jedes Feld steht allein durch Schließen fest: ein normales Rätsel.',
			levels:
				'Die Propagation wiederholt zwei Regeln, bis sich nichts mehr ändert: Ein Feld kann nur zu einem Zentrum gehören, solange sein Spiegelbild das auch kann, und nur, wenn Felder, die ebenfalls dazugehören können, es mit dem Zentrum verbinden. Normale Rätsel lösen sich so; schwere brauchen Fallunterscheidungen.',
			attempts:
				'Das war Versuch {attempt}. Davor: {easy} zu leicht für Schwer, {dropped} aufgegeben.',
			attemptsDetail:
				'Schwere Aufteilungen sind auf kleinen Feldern selten, aber ein Versuch dauert nur Bruchteile einer Millisekunde. Also probiert der Generator mit demselben Zufallsgenerator einfach weiter, bis zu 10.000 Mal.',
			solution: 'Die Lösung, die der Spieler allein aus den Zentren finden muss.'
		}
	}
};

export default de;

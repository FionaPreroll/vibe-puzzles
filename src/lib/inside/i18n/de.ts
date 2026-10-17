import type { InsideDictionary } from './en';

/** German texts of the Inside page. */
const de: InsideDictionary = {
	title: 'Hinter den Kulissen',
	intro:
		'Wie baut ein Computer ein Rätsel mit genau einer Lösung, und woher weiß er, wie schwer es ist? Schau ihm an einem echten Rätsel zu, Schritt für Schritt.',
	films: {
		sudoku: 'So entsteht ein Sudoku'
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
	}
};

export default de;

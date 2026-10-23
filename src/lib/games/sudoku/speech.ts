import { cellPlace, sentences, withStates } from '../../client/speech';
import { t } from '../../i18n/index.svelte';
import { cageLabel, type Cage } from './calc/rules';
import { digitsOf, type SudokuPuzzle, type SudokuState } from './rules';

/** What the board shows in red at a cell: its digit, and in Calcudoku its cage's result. */
export interface SudokuErrors {
	digit: boolean;
	cage: boolean;
}

/**
 * What a screen reader says about cell `i`: its digit or notes, and in Calcudoku its cage, e.g.
 * "Row 3, column 4: 5 (given)" or "Row 1, column 2: notes 1, 4. Cage 12+, 3 cells".
 */
export function sayCell(p: SudokuPuzzle, s: SudokuState, i: number, errors: SudokuErrors): string {
	const digit = p.givens[i] || s.values[i];
	const content = digit
		? withStates(String(digit), [
				!!p.givens[i] && t('games.sudoku.speech.given'),
				errors.digit && t('speech.error')
			])
		: s.notes[i]
			? t('games.sudoku.speech.notes', { list: digitsOf(s.notes[i]).join(', ') })
			: t('speech.empty');
	const cage = p.cages?.find((c) => c.cells.includes(i));
	return sentences([
		`${cellPlace(Math.floor(i / p.width), i % p.width)}: ${content}`,
		cage ? withStates(cageText(cage), [errors.cage && t('speech.error')]) : null
	]);
}

/** "Cage 12+, 3 cells". */
function cageText(cage: Cage): string {
	const count = cage.cells.length;
	const key = count === 1 ? 'cageOne' : 'cage';
	return t(`games.sudoku.speech.${key}`, { label: cageLabel(cage), count });
}

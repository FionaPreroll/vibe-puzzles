import type { GameModule } from '../../core/types';
import { SUDOKU_SETTINGS, type SudokuSettingKey } from './settings';
import Board from './Board.svelte';
import { calcHint } from './calc/hint';
import { cageLabel } from './calc/rules';
import { sudokuHint, unitCells, type Unit } from './hint';
import { sudokuLogic } from './logic';
import { emptySudokuState, type SudokuPuzzle, type SudokuState } from './rules';
import { CALC_TUTORIAL, CALC_TUTORIAL_STEPS } from './calcTutorial';
import { SUDOKU_TUTORIAL, SUDOKU_TUTORIAL_STEPS } from './tutorial';

export const sudoku: GameModule<SudokuPuzzle, SudokuState, SudokuSettingKey> = {
	...sudokuLogic,
	name: 'Sudoku',
	icon: '⑨',
	tools: [
		{ id: 'digit', label: 'Digit', icon: '9', key: 'v' },
		{ id: 'note', label: 'Note', icon: '✎', key: 'n' }
	],
	spaceSwitches: ['digit', 'note'],
	defaultTool: () => 'digit',
	settings: SUDOKU_SETTINGS,
	tutorial: { puzzle: SUDOKU_TUTORIAL, start: emptySudokuState, steps: SUDOKU_TUTORIAL_STEPS },
	modeTutorials: {
		calc: { puzzle: CALC_TUTORIAL, start: emptySudokuState, steps: CALC_TUTORIAL_STEPS }
	},
	board: Board,
	padRows: 1.2,
	hint(puzzle, state) {
		const { width: size, height, cages } = puzzle;
		const hint = cages
			? calcHint({ width: size, height, cages }, state)
			: sudokuHint(puzzle, state);
		if (!hint) return null;
		const key = (k: string) => `games.sudoku.hints.${k}`;
		// Calcudoku explains with rows, columns and cages; the conclusions are the same.
		const own = (k: string) => (cages ? `games.sudoku.modes.calc.hints.${k}` : key(k));
		if (hint.kind === 'mistake')
			return { kind: 'mistake', spotlight: hint.cells.map(String), text: ['game.hintMistake'] };
		const spotlight = [String(hint.cell)];
		if (hint.kind === 'stuck') return { kind: 'stuck', spotlight, text: [key('stuck')] };
		const { cell, digit, unit, elimination, pattern } = hint;
		const cage = 'cage' in hint && hint.cage !== null ? cages![hint.cage] : null;
		// Where to look: the cells of the elimination, else the unit with the only place for the
		// digit, else every unit of the cell.
		const units: Unit[] = unit ? [unit] : cages ? ['row', 'column'] : ['row', 'column', 'box'];
		const area = elimination ? pattern : units.flatMap((u) => unitCells(size, cell, u));
		// A cage that decides the digit by itself is named, after a harder elimination before it.
		const why = !elimination
			? [unit ? key(`where.${unit}`) : own('whereNaked')]
			: cage
				? [
						...(elimination === 'cage' ? [] : [own(elimination)]),
						own(cage.op === '=' ? 'cageGiven' : 'cageOne')
					]
				: [own(elimination)];
		const text = elimination
			? [...why, key(unit ? `then.${unit}` : 'thenNaked')]
			: [own(unit ? `hidden.${unit}` : 'naked')];
		const params: Record<string, string | number> = { digit };
		if (cage) params.cage = cageLabel(cage);
		return {
			kind: 'step',
			spotlight,
			area: [...new Set(area)].map(String),
			teaser: why,
			text,
			params
		};
	}
};

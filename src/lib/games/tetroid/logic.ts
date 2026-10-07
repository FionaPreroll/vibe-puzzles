import { neighbours, packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic, Settings } from '../../core/types';
import type { Variant } from '../../core/variants';
import { solveTetroid } from './solver';
import { generateTetroid } from './generator';
import {
	applyAutoCrosses,
	cellsByRegion,
	CROSS,
	EMPTY,
	isSolvedMarks,
	SHADED,
	type TetroidPuzzle,
	type TetroidState
} from './rules';

const regular = (size: number): Variant[] => [
	{
		key: `${size}n`,
		label: `${size}x${size} Normal`,
		width: size,
		height: size,
		difficulty: 'normal'
	},
	{ key: `${size}h`, label: `${size}x${size} Hard`, width: size, height: size, difficulty: 'hard' }
];

export const TETROID_VARIANTS: Variant[] = [
	...[6, 8, 10, 15, 20].flatMap(regular),
	{
		key: 'daily',
		label: 'Special Daily',
		width: 10,
		height: 10,
		difficulty: 'normal',
		special: 'daily'
	},
	{
		key: 'weekly',
		label: 'Special Weekly',
		width: 15,
		height: 15,
		difficulty: 'hard',
		special: 'weekly'
	},
	{
		key: 'monthly',
		label: 'Special Monthly',
		width: 20,
		height: 20,
		difficulty: 'hard',
		special: 'monthly'
	}
];

function regionsConnected(p: TetroidPuzzle): boolean {
	const w = p.width;
	return cellsByRegion(p).every((cells) => {
		if (cells.length < 4) return false;
		const set = new Set(cells);
		const seen = new Set([cells[0]]);
		const stack = [cells[0]];
		while (stack.length) {
			for (const j of neighbours(stack.pop()!, w, p.height)) {
				if (set.has(j) && !seen.has(j)) {
					seen.add(j);
					stack.push(j);
				}
			}
		}
		return seen.size === cells.length;
	});
}

const isMarkArray = (a: unknown, n: number, max: number): a is number[] =>
	Array.isArray(a) && a.length === n && a.every((x) => Number.isInteger(x) && x >= 0 && x <= max);

export const tetroidLogic: GameLogic<TetroidPuzzle, TetroidState> = {
	id: 'tetroid',
	variants: TETROID_VARIANTS,
	generate: (v, seed) => generateTetroid(v.width, v.height, v.difficulty, seed).puzzle,
	countSolutions(p, limit) {
		const res = solveTetroid(p, { limit, maxNodes: 2_000_000 });
		return { count: res.solutions.length, finished: res.finished };
	},
	isValidPuzzle(p: unknown, v): p is TetroidPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as TetroidPuzzle;
		if (q.width !== v.width || q.height !== v.height) return false;
		if (!Array.isArray(q.regions) || q.regions.length !== v.width * v.height) return false;
		const count = Math.max(...q.regions) + 1;
		if (!q.regions.every((r) => Number.isInteger(r) && r >= 0 && r < count)) return false;
		return regionsConnected(q);
	},
	emptyState: (p) => ({
		marks: new Array(p.width * p.height).fill(EMPTY),
		auto: new Array(p.width * p.height).fill(0)
	}),
	afterMove: (p, s, settings: Settings) =>
		applyAutoCrosses(p, s, !!settings.autoCrossCorners, !!settings.autoCrossRegions),
	isSolved: (p, s) => isSolvedMarks(p, (i) => s.marks[i] === SHADED),
	answer: (_p, s) => s.marks.map((m) => (m === SHADED ? '1' : '0')).join(''),
	verifyAnswer(p, answer) {
		if (answer.length !== p.width * p.height || !/^[01]+$/.test(answer)) return false;
		return isSolvedMarks(p, (i) => answer[i] === '1');
	},
	encodeState: (s) => packDigits(s.marks),
	decodeState(p, text) {
		try {
			const marks = unpackDigits(text, p.width * p.height);
			if (marks.some((m) => m > CROSS)) return null;
			return { marks, auto: marks.map(() => 0) };
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is TetroidState {
		if (!s || typeof s !== 'object') return false;
		const n = p.width * p.height;
		const t = s as TetroidState;
		return isMarkArray(t.marks, n, CROSS) && isMarkArray(t.auto, n, 1);
	}
};

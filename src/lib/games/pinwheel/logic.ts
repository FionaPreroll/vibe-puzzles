import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic } from '../../core/types';
import type { Variant } from '../../core/variants';
import { generatePinwheel } from './generator';
import {
	acceptByColours,
	coveredCells,
	CROSS,
	emptyPinwheelState,
	hIndex,
	interiorEdges,
	isSolvedState,
	LINE,
	vIndex,
	type PinwheelPuzzle,
	type PinwheelState
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

export const PINWHEEL_VARIANTS: Variant[] = [
	...[5, 7, 10, 15].flatMap(regular),
	{
		key: 'daily',
		label: 'Special Daily',
		width: 10,
		height: 10,
		difficulty: 'hard',
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

const isArray = (a: unknown, n: number, max: number): a is number[] =>
	Array.isArray(a) && a.length === n && a.every((x) => Number.isInteger(x) && x >= 0 && x <= max);

/** Answer: one character per interior edge (h edges first, then v edges), 1 = line. */
function answerOf(p: PinwheelPuzzle, s: PinwheelState): string {
	return interiorEdges(p)
		.map((e) =>
			(e.kind === 'h' ? s.h[hIndex(p, e.i, e.j)] : s.v[vIndex(p, e.i, e.j)]) === LINE ? '1' : '0'
		)
		.join('');
}

export const pinwheelLogic: GameLogic<PinwheelPuzzle, PinwheelState> = {
	id: 'pinwheel',
	variants: PINWHEEL_VARIANTS,
	generate: (v, seed) => generatePinwheel(v.width, v.height, v.difficulty, seed).puzzle,
	isValidPuzzle(p: unknown, v): p is PinwheelPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as PinwheelPuzzle;
		if (q.width !== v.width || q.height !== v.height || !Array.isArray(q.centres)) return false;
		const covered = new Set<number>();
		for (const c of q.centres) {
			if (!Array.isArray(c) || c.length !== 2) return false;
			const [hr, hc] = c;
			if (!Number.isInteger(hr) || !Number.isInteger(hc)) return false;
			if (hr < 0 || hc < 0 || hr > 2 * q.height - 2 || hc > 2 * q.width - 2) return false;
			for (const i of coveredCells(q, c)) {
				if (covered.has(i)) return false;
				covered.add(i);
			}
		}
		return q.centres.length > 0;
	},
	emptyState: emptyPinwheelState,
	isSolved: isSolvedState,
	acceptAlternative: (p, s, settings) => (settings.autoSubmit ? acceptByColours(p, s) : null),
	answer: answerOf,
	verifyAnswer(p, answer) {
		const edges = interiorEdges(p);
		if (answer.length !== edges.length || !/^[01]+$/.test(answer)) return false;
		const s = emptyPinwheelState(p);
		edges.forEach((e, k) => {
			if (answer[k] !== '1') return;
			if (e.kind === 'h') s.h[hIndex(p, e.i, e.j)] = LINE;
			else s.v[vIndex(p, e.i, e.j)] = LINE;
		});
		return isSolvedState(p, s);
	},
	encodeState: (s) => [s.h, s.v, s.colors, s.locks].map(packDigits).join('.'),
	decodeState(p, text) {
		try {
			const parts = text.split('.');
			if (parts.length !== 4) return null;
			const e = emptyPinwheelState(p);
			const s: PinwheelState = {
				h: unpackDigits(parts[0], e.h.length),
				v: unpackDigits(parts[1], e.v.length),
				colors: unpackDigits(parts[2], e.colors.length),
				locks: unpackDigits(parts[3], e.locks.length)
			};
			return this.isValidState(p, s) ? s : null;
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is PinwheelState {
		if (!s || typeof s !== 'object') return false;
		const t = s as PinwheelState;
		const e = emptyPinwheelState(p);
		return (
			isArray(t.h, e.h.length, CROSS) &&
			isArray(t.v, e.v.length, CROSS) &&
			isArray(t.colors, e.colors.length, 9) &&
			isArray(t.locks, e.locks.length, 1)
		);
	}
};

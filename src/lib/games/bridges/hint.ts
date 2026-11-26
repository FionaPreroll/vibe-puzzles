import {
	across,
	bridgesOf,
	CROSS,
	isSolvedState,
	MAX_BRIDGES,
	type BridgesPuzzle,
	type BridgesState
} from './rules';
import { BridgesLevel, BridgesSolver, type Contradiction, type Known } from './solver';

/**
 * What decides the bridges a hint points at, given the player's bridges and crosses: what an
 * island still needs against what its neighbours can take (`need`), a part of the board with only
 * one way left to the rest (`connect`), the ways to give one island its bridges without closing
 * a group off (`combo`), or a link tried out in the head (`assumption`).
 */
export type BridgesTechnique = 'need' | 'connect' | 'combo' | 'assumption';

/**
 * Why a link the player has not crossed takes fewer bridges than two: a bridge crosses it
 * (`blocked`), the island across has all its bridges (`full`) or needs only one more
 * (`capacity`), or more bridges would close a group off (`isolation`).
 */
export type SupportReason = 'blocked' | 'full' | 'capacity' | 'isolation';

/** A link that takes fewer bridges than the player can see, and why. */
export interface Support {
	reason: SupportReason;
	link: number;
	/** The most bridges it takes. */
	most: number;
	/** The islands the reason rests on. */
	islands: number[];
}

export type BridgesHint =
	/** Links with more bridges than the solution, and crosses where it has bridges. */
	| { kind: 'mistake'; links: number[] }
	| {
			kind: 'step';
			technique: BridgesTechnique;
			/** The links that take more bridges than they have, each at least `bridges`. */
			links: number[];
			bridges: number;
			/** The island the reasoning starts from, if one. */
			island?: number;
			/** The islands and links the reasoning rests on. */
			islands: number[];
			area: number[];
			/** Links that take fewer bridges than they show, which the step rests on. */
			support: Support[];
			/** What a tried link breaks (`assumption`). */
			breaks?: Contradiction;
			/** `need`: the island takes every bridge its links can still hold. */
			all?: boolean;
	  }
	| { kind: 'stuck'; links: number[] };

type StepHint = Extract<BridgesHint, { kind: 'step' }>;

const solvers = new WeakMap<BridgesPuzzle, { solver: BridgesSolver; solution: number[] | null }>();

/** The puzzle's solver and its solution, kept per puzzle. */
function solverOf(p: BridgesPuzzle) {
	let entry = solvers.get(p);
	if (!entry) {
		const solver = new BridgesSolver(p);
		const rating = solver.rate();
		const solution = rating ? solver.values(rating.known) : (solver.solve(1).solutions[0] ?? null);
		solvers.set(p, (entry = { solver, solution }));
	}
	return entry;
}

/** The solution of a puzzle, or null if it has none (or the search gave up). */
export const bridgesSolution = (p: BridgesPuzzle) => solverOf(p).solution;

/**
 * What the player's position says: a link holds at least its bridges, none where it is crossed
 * or a bridge crosses it, else up to two.
 */
export function knownFrom(solver: BridgesSolver, s: BridgesState): Known {
	const k = solver.start();
	s.links.forEach((value, l) => {
		k[2 * l] = bridgesOf(value);
		if (value === CROSS) k[2 * l + 1] = 0;
	});
	s.links.forEach((value, l) => {
		if (!bridgesOf(value)) return;
		for (const m of solver.g.crossing[l]) if (!k[2 * m]) k[2 * m + 1] = 0;
	});
	return k;
}

/**
 * The next step from the player's position. Bridges and crosses the solution breaks come first.
 * Otherwise the hint finds links that must take more bridges than they have, by the simplest
 * reasoning that decides some: first from what the player has built alone, then with what the
 * islands' numbers and closed groups rule out on the way, then by trying a link out. Null when
 * the puzzle is solved.
 */
export function bridgesHint(p: BridgesPuzzle, s: BridgesState): BridgesHint | null {
	if (isSolvedState(p, s)) return null;
	const { solver, solution } = solverOf(p);
	if (solution) {
		const links = s.links.flatMap((value, l) =>
			bridgesOf(value) > solution[l] || (value === CROSS && solution[l] > 0) ? [l] : []
		);
		if (links.length) return { kind: 'mistake', links };
	}
	const g = solver.g;
	const seen = knownFrom(solver, s);
	const support = new Map<number, Support>();
	s.links.forEach((value, l) => {
		if (value !== CROSS && !bridgesOf(value) && !seen[2 * l + 1]) {
			support.set(l, { reason: 'blocked', link: l, most: 0, islands: [] });
		}
	});
	const k = seen.slice();

	/** Lower `link` to at most `most` bridges, for `reason`. */
	const exclude = (link: number, most: number, reason: SupportReason, islands: number[]) => {
		if (most >= k[2 * link + 1]) return false;
		k[2 * link + 1] = most;
		support.set(link, { reason, link, most, islands });
		return true;
	};

	/**
	 * The support a step needs, out of the links `links`: why they take fewer bridges than two.
	 * Each one goes back to two in turn, and stays out of the step where `holds` still finds it.
	 * A link the player crossed needs no reason.
	 */
	const supportOf = (links: number[], holds?: (copy: Known) => boolean) => {
		const copy = k.slice();
		const out: Support[] = [];
		for (const l of links) {
			const why = support.get(l);
			if (!why || s.links[l] === CROSS) continue;
			copy[2 * l + 1] = MAX_BRIDGES;
			if (holds?.(copy)) continue;
			copy[2 * l + 1] = k[2 * l + 1];
			out.push(why);
		}
		return out;
	};

	/** The links that gain the most of `raised`, and how many bridges they get at least. */
	const gain = (raised: [number, number][]) => {
		const bridges = Math.max(...raised.map(([, lo]) => lo));
		return { bridges, links: raised.filter(([, lo]) => lo === bridges).map(([l]) => l) };
	};

	/** Whether `bounds` give every link of `links` at least `bridges`, as those of island `i`. */
	const gives = (i: number, bounds: [number, number][] | null, links: number[], bridges: number) =>
		!!bounds && links.every((l) => bounds[solver.islandLinks[i].indexOf(l)][0] >= bridges);

	const step = (
		technique: BridgesTechnique,
		{ links, bridges }: { links: number[]; bridges: number },
		island: number | undefined,
		islands: number[],
		area: number[],
		support: Support[],
		breaks?: Contradiction
	): StepHint => ({
		kind: 'step',
		technique,
		links,
		bridges,
		...(island !== undefined && { island }),
		islands: [...new Set(islands)],
		area: [...new Set([...area, ...links])],
		support,
		...(breaks && { breaks })
	});

	/** The links of island `i` that `bounds` raise, with their new fewest bridges. */
	const raisedAt = (i: number, bounds: [number, number][]) =>
		solver.islandLinks[i].flatMap((l, n): [number, number][] =>
			bounds[n][0] > k[2 * l] ? [[l, bounds[n][0]]] : []
		);
	const neighbours = (i: number) => solver.islandLinks[i].map((l) => across(g, l, i));

	/** `Count` at one island: what it still needs against what its neighbours can take. */
	const need = (): BridgesHint | null => {
		let best: BridgesHint | null = null;
		for (let i = 0; i < solver.islands; i++) {
			const bounds = solver.countAt(k, i);
			if (!bounds) continue;
			const raised = raisedAt(i, bounds);
			if (!raised.length) continue;
			const ls = solver.islandLinks[i];
			const won = gain(raised);
			const rests = supportOf(ls, (copy) =>
				gives(i, solver.countAt(copy, i), won.links, won.bridges)
			);
			// Every link to the most it can take is the plainest case: it comes first.
			if (bounds.every(([lo], n) => lo === k[2 * ls[n] + 1])) {
				return { ...step('need', won, i, [i, ...neighbours(i)], ls, rests), all: true };
			}
			const hint = step('need', won, i, [i, ...neighbours(i)], ls, rests);
			best ??= hint;
		}
		return best;
	};

	/** `Connect`: a part of the board whose only way left to the rest is one link. */
	const connect = (): BridgesHint | null => {
		for (const { link, side } of solver.cuts(k) ?? []) {
			if (k[2 * link]) continue;
			// The smaller part, which the link joins to the rest.
			const far = new Set(side);
			const part =
				far.size * 2 <= solver.islands ? side : g.cells.flatMap((_, i) => (far.has(i) ? [] : [i]));
			const mine = new Set(part);
			// The other links that leave the part take no bridge.
			const leaving = part.flatMap((i) =>
				solver.islandLinks[i].filter((l) => l !== link && !mine.has(across(g, l, i)))
			);
			const inner = part.flatMap((i) => solver.islandLinks[i].filter((l) => k[2 * l] > 0));
			return step(
				'connect',
				{ links: [link], bridges: 1 },
				undefined,
				part,
				inner,
				supportOf(leaving)
			);
		}
		return null;
	};

	/** The ways to give one island its bridges without closing a group off. */
	const combo = (): BridgesHint | null => {
		const groups = solver.groups(k);
		for (let i = 0; i < solver.islands; i++) {
			const bounds = solver.combosAt(k, groups, i);
			const raised = bounds ? raisedAt(i, bounds) : [];
			if (!raised.length) continue;
			// The groups next to the island: those it may close off.
			const near = new Set([i, ...neighbours(i)].map((x) => groups.root[x]));
			const islands = g.cells.flatMap((_, x) => (near.has(groups.root[x]) ? [x] : []));
			const inner = islands.flatMap((x) => solver.islandLinks[x].filter((l) => k[2 * l] > 0));
			const ls = solver.islandLinks[i];
			const won = gain(raised);
			const rests = supportOf(ls, (copy) =>
				gives(i, solver.combosAt(copy, groups, i), won.links, won.bridges)
			);
			return step('combo', won, i, islands, [...ls, ...inner], rests);
		}
		return null;
	};

	// From what the player has built, then with what the numbers rule out on the way.
	let hint = need();
	if (hint) return hint;

	// What the islands still take: a link to one with all its bridges takes no more, to one that
	// needs only one more no second.
	for (let i = 0; i < solver.islands; i++) {
		const rest = g.clue[i] - solver.islandLinks[i].reduce((sum, l) => sum + k[2 * l], 0);
		for (const l of solver.islandLinks[i]) {
			exclude(l, k[2 * l] + rest, rest ? 'capacity' : 'full', [i]);
		}
	}
	hint = need();
	if (hint) return hint;

	const groups = solver.groups(seen);
	for (let l = 0; l < solver.links; l++) {
		const most = k[2 * l + 1];
		if (k[2 * l] < most && solver.closes(k, groups, l, most)) {
			const ends = [g.ends[2 * l], g.ends[2 * l + 1]].map((x) => groups.root[x]);
			const islands = g.cells.flatMap((_, x) => (ends.includes(groups.root[x]) ? [x] : []));
			exclude(l, most - 1, 'isolation', islands);
		}
	}
	hint = need() ?? connect() ?? combo();
	if (hint) return hint;

	// Try a link out: the fewest bridges it can have, followed by the rules, break one.
	for (let l = 0; l < solver.links; l++) {
		const lo = seen[2 * l];
		if (lo >= seen[2 * l + 1] || solver.tryValue(seen, l, lo, lo)) continue;
		const ends = [g.ends[2 * l], g.ends[2 * l + 1]];
		const won = { links: [l], bridges: lo + 1 };
		return step('assumption', won, undefined, ends, [], [], solver.broken!);
	}

	// Nothing decides a link: point at one that lacks bridges and has the most ways left.
	const open = s.links.flatMap((value, l) =>
		seen[2 * l] < seen[2 * l + 1] && (!solution || bridgesOf(value) < solution[l]) ? [l] : []
	);
	const [widest] = open.sort(
		(a, b) => seen[2 * b + 1] - seen[2 * b] - (seen[2 * a + 1] - seen[2 * a])
	);
	return { kind: 'stuck', links: widest === undefined ? [] : [widest] };
}

/** For tests: the techniques up to `level` decide the puzzle from the player's position. */
export function solvesFrom(p: BridgesPuzzle, s: BridgesState, level: BridgesLevel): boolean {
	const { solver } = solverOf(p);
	const k = knownFrom(solver, s);
	return solver.propagate(k, level) && solver.done(k);
}

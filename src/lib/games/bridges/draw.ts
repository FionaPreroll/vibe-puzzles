import {
	across,
	bridgesOf,
	graphOf,
	linksOf,
	type BridgesAnalysis,
	type BridgesPuzzle,
	type BridgesState
} from './rules';

/**
 * The islands in the groups of the links in `keys` (the board's `l:<link>` keys of the last
 * change): those joined by bridges to either end of them.
 */
export function joinedTo(
	p: BridgesPuzzle,
	a: BridgesAnalysis,
	keys: Iterable<string>
): Set<number> {
	const g = graphOf(p);
	const groups = new Set<number>();
	for (const key of keys) {
		if (!key.startsWith('l:')) continue;
		const link = Number(key.slice(2));
		for (const end of [g.ends[2 * link], g.ends[2 * link + 1]]) groups.add(a.group[end]);
	}
	const out = new Set<number>();
	a.group.forEach((root, i) => {
		// An island on its own is no group: nothing joins it.
		if (groups.has(root) && a.count[i] > 0) out.add(i);
	});
	return out;
}

/**
 * For the win animation: how many bridges each island lies from the first island, as rings that
 * the animation colours in turn, like a wave over the bridges.
 */
export function groupRings(p: BridgesPuzzle, s: BridgesState): number[] {
	const g = graphOf(p);
	const depth = g.cells.map(() => -1);
	depth[0] = 0;
	const queue = [0];
	for (let q = 0; q < queue.length; q++) {
		const i = queue[q];
		for (const l of linksOf(g, i)) {
			const j = across(g, l, i);
			if (!bridgesOf(s.links[l]) || depth[j] >= 0) continue;
			depth[j] = depth[i] + 1;
			queue.push(j);
		}
	}
	return depth.map((d) => Math.max(0, d));
}

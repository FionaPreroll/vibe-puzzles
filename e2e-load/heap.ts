import { writeFileSync } from 'node:fs';
import type { CDPSession } from '@playwright/test';

/**
 * What keeps detached DOM nodes alive, for a soak run that failed on them: a heap snapshot (to
 * open in Chrome's DevTools) and a short report of the detached nodes and the shortest paths
 * from the garbage collector's roots to them. Nodes without a JavaScript wrapper do not show up
 * in the snapshot; the subtree they hang in usually does, through its root element.
 */
export async function detachedReport(cdp: CDPSession, file: string): Promise<string> {
	const chunks: string[] = [];
	const onChunk = (e: { chunk: string }) => chunks.push(e.chunk);
	cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
	await cdp.send('HeapProfiler.collectGarbage');
	await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
	cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
	const raw = chunks.join('');
	writeFileSync(`${file}.heapsnapshot`, raw);
	const report = retainers(JSON.parse(raw));
	writeFileSync(`${file}.txt`, report);
	return report;
}

interface Snapshot {
	snapshot: {
		meta: {
			node_fields: string[];
			node_types: [string[], ...unknown[]];
			edge_fields: string[];
			edge_types: [string[], ...unknown[]];
		};
	};
	nodes: number[];
	edges: number[];
	strings: string[];
}

/** The report for a parsed heap snapshot: detached nodes by name, and who holds them. */
export function retainers(snap: Snapshot, paths = Infinity): string {
	const { meta } = snap.snapshot;
	const nf = meta.node_fields;
	const ef = meta.edge_fields;
	const [N, E] = [nf.length, ef.length];
	const [nName, nCount, nDetached] = ['name', 'edge_count', 'detachedness'].map((f) =>
		nf.indexOf(f)
	);
	const [eType, eName, eTo] = ['type', 'name_or_index', 'to_node'].map((f) => ef.indexOf(f));
	const edgeTypes = meta.edge_types[0];
	const { nodes, edges, strings } = snap;
	const count = nodes.length / N;
	const name = (n: number) => strings[nodes[n * N + nName]];
	const detached = (n: number) => nDetached >= 0 && nodes[n * N + nDetached] === 2;

	// Breadth first from the root along strong edges: the shortest path to every live object.
	const parent = new Int32Array(count).fill(-1);
	const via = new Array<string>(count);
	const firstEdge = new Int32Array(count);
	for (let n = 1; n < count; n++) firstEdge[n] = firstEdge[n - 1] + nodes[(n - 1) * N + nCount];
	parent[0] = 0;
	const queue = [0];
	for (let q = 0; q < queue.length; q++) {
		const n = queue[q];
		for (let k = 0; k < nodes[n * N + nCount]; k++) {
			const e = (firstEdge[n] + k) * E;
			const type = edgeTypes[edges[e + eType]];
			if (type === 'weak') continue;
			const to = edges[e + eTo] / N;
			if (parent[to] >= 0) continue;
			parent[to] = n;
			const label = edges[e + eName];
			via[to] = ['element', 'hidden'].includes(type) ? `[${label}]` : String(strings[label]);
			queue.push(to);
		}
	}

	const all = [...Array(count).keys()].filter(detached);
	const byName = new Map<string, number>();
	for (const n of all) byName.set(name(n), (byName.get(name(n)) ?? 0) + 1);
	const lines = [
		`${all.length} detached nodes with a JavaScript wrapper`,
		...[...byName]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 20)
			.map(([nm, c]) => `  ${c} × ${nm.slice(0, 100)}`),
		'',
		'Shortest paths to the detached subtrees, the largest first (Svelte keeps its templates',
		'detached):'
	];
	// A subtree: the detached nodes reached through one detached node whose parent on the path
	// is not a detached node. Only nodes with a wrapper count, so a large subtree held from
	// outside can still show as one node: the report lists every path.
	const size = new Map<number, number>();
	for (const n of all) {
		if (parent[n] < 0) continue;
		let root = n;
		while (detached(parent[root])) root = parent[root];
		size.set(root, (size.get(root) ?? 0) + 1);
	}
	const roots = [...size].sort((a, b) => b[1] - a[1]);
	for (const [n, nodesBelow] of roots.slice(0, paths)) {
		const steps: string[] = [];
		for (let m = n; m !== 0 && steps.length < 30; m = parent[m]) {
			steps.push(`${name(m).slice(0, 60)} ←${via[m]}`);
		}
		lines.push('', `  ${nodesBelow} nodes:`, `    ${steps.reverse().join('\n    ')}`);
	}
	if (roots.length > paths) lines.push('', `  … and ${roots.length - paths} smaller subtrees`);
	return lines.join('\n') + '\n';
}

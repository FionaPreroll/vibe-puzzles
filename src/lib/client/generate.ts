import { GAME_LOGIC } from '../games/logic';
import { encodePuzzleId } from '../core/variants';
import GeneratorWorker from './generator.worker?worker';

/**
 * Puzzle generation in a Web Worker, with a small cache so that a prefetched puzzle (the next
 * "New Puzzle") is ready instantly. Puzzles are deterministic per (game, puzzle ID).
 */

let worker: Worker | null = null;
let nextJob = 1;
const pending = new Map<number, { resolve: (p: unknown) => void; reject: (e: Error) => void }>();
const cache = new Map<string, Promise<unknown>>();

function getWorker(): Worker | null {
	if (worker) return worker;
	if (typeof Worker === 'undefined') return null;
	worker = new GeneratorWorker();
	worker.onmessage = (e: MessageEvent<{ job: number; puzzle?: unknown; error?: string }>) => {
		const p = pending.get(e.data.job);
		if (!p) return;
		pending.delete(e.data.job);
		if (e.data.error) p.reject(new Error(e.data.error));
		else p.resolve(e.data.puzzle);
	};
	return worker;
}

export function generate<P>(game: string, variantIndex: number, seed: number): Promise<P> {
	const key = `${game}:${encodePuzzleId(variantIndex, seed)}`;
	let job = cache.get(key);
	if (!job) {
		const w = getWorker();
		job = w
			? new Promise((resolve, reject) => {
					const id = nextJob++;
					pending.set(id, { resolve, reject });
					w.postMessage({ job: id, game, variant: variantIndex, seed });
				})
			: Promise.resolve().then(() => {
					const logic = GAME_LOGIC[game];
					return logic.generate(logic.variants[variantIndex], seed);
				});
		job.catch(() => cache.delete(key));
		cache.set(key, job);
		if (cache.size > 8) cache.delete(cache.keys().next().value!);
	}
	return job as Promise<P>;
}

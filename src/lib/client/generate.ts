import { GAME_LOGIC } from '../games/logic';
import { encodePuzzleId } from '../core/variants';
import GeneratorWorker from './generator.worker?worker';

/**
 * Puzzle generation in a Web Worker, with a small cache so that a prefetched puzzle (the next
 * "New Puzzle") is ready instantly. Puzzles are deterministic per (game, puzzle ID).
 */

/**
 * A job that takes longer than this is given up and the worker restarted. Far above what the
 * biggest puzzles need, even on slow phones: it only catches a generator that never finishes.
 */
export const GENERATE_TIMEOUT_MS = 180_000;

interface GenerateRequest {
	job: number;
	game: string;
	variant: number;
	seed: number;
}

interface Job {
	request: GenerateRequest;
	resolve: (p: unknown) => void;
	reject: (e: Error) => void;
	timer?: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let nextJob = 1;
const pending = new Map<number, Job>();
const cache = new Map<string, Promise<unknown>>();

function getWorker(): Worker | null {
	if (worker) return worker;
	if (typeof Worker === 'undefined') return null;
	try {
		worker = new GeneratorWorker();
	} catch {
		// Workers can be blocked (e.g. by a content security policy): generate on the main thread.
		return null;
	}
	worker.onmessage = (e: MessageEvent<{ job: number; puzzle?: unknown; error?: string }>) => {
		const p = pending.get(e.data.job);
		if (!p) return;
		finish(e.data.job);
		if (e.data.error) p.reject(new Error(e.data.error));
		else p.resolve(e.data.puzzle);
	};
	// The worker failed to load or crashed: nothing it was given will be answered.
	worker.onerror = (e) => {
		e.preventDefault();
		failAll(new Error(e.message || 'The puzzle generator stopped'));
	};
	worker.onmessageerror = () =>
		failAll(new Error('The puzzle generator sent an unreadable answer'));
	return worker;
}

function stopWorker() {
	worker?.terminate();
	worker = null;
}

function finish(job: number) {
	clearTimeout(pending.get(job)?.timer);
	pending.delete(job);
}

function failAll(error: Error) {
	stopWorker();
	for (const [job, p] of [...pending]) {
		finish(job);
		p.reject(error);
	}
}

/** Hand a job to the worker and give up on it after the timeout. */
function post(w: Worker, p: Job) {
	p.timer = setTimeout(() => timedOut(p.request.job), GENERATE_TIMEOUT_MS);
	w.postMessage(p.request);
}

/** A job that hangs blocks the worker: restart it and hand the other jobs to the new one. */
function timedOut(job: number) {
	const p = pending.get(job);
	if (!p) return;
	finish(job);
	stopWorker();
	p.reject(new Error('Creating the puzzle took too long'));
	const others = [...pending.values()];
	const w = others.length ? getWorker() : null;
	for (const other of others) {
		clearTimeout(other.timer);
		if (w) post(w, other);
		else {
			pending.delete(other.request.job);
			other.reject(new Error('The puzzle generator is not available'));
		}
	}
}

export function generate<P>(game: string, variantIndex: number, seed: number): Promise<P> {
	const key = `${game}:${encodePuzzleId(variantIndex, seed)}`;
	let job = cache.get(key);
	if (!job) {
		const w = getWorker();
		job = w
			? new Promise((resolve, reject) => {
					const request = { job: nextJob++, game, variant: variantIndex, seed };
					const p: Job = { request, resolve, reject };
					pending.set(request.job, p);
					post(w, p);
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

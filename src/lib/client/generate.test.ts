import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_LOGIC } from '../games/logic';

/** Messages the fake workers received, and how many workers were stopped. */
const posted: { job: number; game: string; variant: number; seed: number }[] = [];
let terminated = 0;
/** Starting another worker fails, as when the browser refuses it. */
let refuseWorkers = false;

vi.mock('./generator.worker?worker', () => ({
	default: class {
		onmessage: ((e: MessageEvent) => void) | null = null;
		onerror: ((e: ErrorEvent) => void) | null = null;
		onmessageerror: ((e: MessageEvent) => void) | null = null;
		constructor() {
			if (refuseWorkers) throw new Error('Blocked');
		}
		/** Busy with a job that never ends, like a real worker running one job at a time. */
		stuck = false;
		terminate() {
			terminated++;
		}
		postMessage(msg: { job: number; game: string; variant: number; seed: number }) {
			posted.push(msg);
			// "hang" never answers (nor do later jobs); "crash" takes the worker down; "garbled"
			// answers with something that cannot be read.
			if (msg.game === 'hang') this.stuck = true;
			if (this.stuck) return;
			if (msg.game === 'crash') {
				const error = { message: 'Boom', preventDefault() {} } as unknown as ErrorEvent;
				setTimeout(() => this.onerror?.(error));
				return;
			}
			if (msg.game === 'garbled') {
				this.stuck = true;
				setTimeout(() => this.onmessageerror?.({} as MessageEvent));
				return;
			}
			const logic = GAME_LOGIC[msg.game];
			// Answer asynchronously like a real worker; an unknown game fails.
			setTimeout(() => {
				const data = logic
					? { job: msg.job, puzzle: logic.generate(logic.variants[msg.variant], msg.seed) }
					: { job: msg.job, error: 'Unknown game' };
				this.onmessage?.({ data } as MessageEvent);
				// Stray answers are ignored.
				this.onmessage?.({ data: { job: -1 } } as MessageEvent);
			});
		}
	}
}));

const expected = (seed: number) =>
	GAME_LOGIC.pinwheel.generate(GAME_LOGIC.pinwheel.variants[0], seed);

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	posted.length = 0;
	terminated = 0;
	refuseWorkers = false;
});

describe('generate', () => {
	it('generates on the main thread where there are no workers', async () => {
		vi.resetModules();
		vi.stubGlobal('Worker', undefined);
		const { generate } = await import('./generate');
		expect(await generate('pinwheel', 0, 11)).toEqual(expected(11));
		expect(posted).toEqual([]);
	});

	it('generates in a worker and caches the puzzle', async () => {
		vi.resetModules();
		vi.stubGlobal('Worker', class {});
		const { generate } = await import('./generate');
		const first = generate('pinwheel', 0, 12);
		expect(generate('pinwheel', 0, 12)).toBe(first);
		expect(await first).toEqual(expected(12));
		expect(posted).toHaveLength(1);
	});

	it('forgets failed jobs and keeps the cache small', async () => {
		vi.resetModules();
		vi.stubGlobal('Worker', class {});
		const { generate } = await import('./generate');
		await expect(generate('nope', 0, 1)).rejects.toThrow('Unknown game');
		await expect(generate('nope', 0, 1)).rejects.toThrow('Unknown game');
		expect(posted).toHaveLength(2);
		for (let seed = 1; seed <= 9; seed++) await generate('pinwheel', 0, seed);
		// The oldest entry fell out of the cache of eight.
		await generate('pinwheel', 0, 1);
		expect(posted).toHaveLength(12);
	});

	it('fails every waiting job when the worker crashes, and starts a new worker next time', async () => {
		vi.resetModules();
		vi.stubGlobal('Worker', class {});
		const { generate } = await import('./generate');
		const crash = generate('crash', 0, 1);
		const waiting = generate('pinwheel', 0, 13);
		await expect(crash).rejects.toThrow('Boom');
		await expect(waiting).rejects.toThrow('Boom');
		expect(terminated).toBe(1);
		expect(await generate('pinwheel', 0, 13)).toEqual(expected(13));
	});

	it('fails every waiting job when an answer cannot be read', async () => {
		vi.resetModules();
		vi.stubGlobal('Worker', class {});
		const { generate } = await import('./generate');
		const garbled = generate('garbled', 0, 1);
		const waiting = generate('pinwheel', 0, 16);
		await expect(garbled).rejects.toThrow('unreadable answer');
		await expect(waiting).rejects.toThrow('unreadable answer');
		expect(terminated).toBe(1);
		expect(await generate('pinwheel', 0, 16)).toEqual(expected(16));
	});

	it('gives up on a job that hangs and moves the other jobs to a new worker', async () => {
		vi.resetModules();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		vi.stubGlobal('Worker', class {});
		const { generate, GENERATE_TIMEOUT_MS } = await import('./generate');
		const hang = generate('hang', 0, 1);
		hang.catch(() => undefined);
		// Queued behind the hanging job, so the first worker never answers it.
		posted.length = 0;
		const queued = generate('pinwheel', 0, 14);
		const sent = posted.splice(0);
		expect(sent).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(GENERATE_TIMEOUT_MS);
		await expect(hang).rejects.toThrow('too long');
		expect(terminated).toBe(1);
		// The new worker got the queued job again and answers it.
		expect(posted).toEqual(sent);
		await vi.runAllTimersAsync();
		expect(await queued).toEqual(expected(14));
	});

	it('fails the other jobs when a job hangs and no new worker can be started', async () => {
		vi.resetModules();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		vi.stubGlobal('Worker', class {});
		const { generate, GENERATE_TIMEOUT_MS } = await import('./generate');
		const hang = generate('hang', 0, 1);
		hang.catch(() => undefined);
		const queued = [generate('pinwheel', 0, 17), generate('pinwheel', 0, 18)];
		for (const q of queued) q.catch(() => undefined);
		refuseWorkers = true;
		await vi.advanceTimersByTimeAsync(GENERATE_TIMEOUT_MS);
		await expect(hang).rejects.toThrow('too long');
		for (const q of queued) await expect(q).rejects.toThrow('not available');
		// Their timers are gone too: nothing fails a second time later.
		expect(vi.getTimerCount()).toBe(0);
	});

	it('generates on the main thread when a worker cannot be started', async () => {
		vi.resetModules();
		vi.doMock('./generator.worker?worker', () => ({
			default: class {
				constructor() {
					throw new Error('Blocked');
				}
			}
		}));
		vi.stubGlobal('Worker', class {});
		const { generate } = await import('./generate');
		expect(await generate('pinwheel', 0, 15)).toEqual(expected(15));
		vi.doUnmock('./generator.worker?worker');
	});
});

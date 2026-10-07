import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_LOGIC } from '../games/logic';

/** Messages the fake worker received. */
const posted: unknown[] = [];

vi.mock('./generator.worker?worker', () => ({
	default: class {
		onmessage: ((e: MessageEvent) => void) | null = null;
		postMessage(msg: { job: number; game: string; variant: number; seed: number }) {
			posted.push(msg);
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
	vi.unstubAllGlobals();
	posted.length = 0;
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
});

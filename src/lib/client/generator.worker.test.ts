import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_LOGIC } from '../games/logic';

afterEach(() => vi.unstubAllGlobals());

describe('generator worker', () => {
	it('answers each job with its puzzle or the error', async () => {
		const scope = { onmessage: null as ((e: MessageEvent) => void) | null, postMessage: vi.fn() };
		vi.stubGlobal('self', scope);
		await import('./generator.worker');
		scope.onmessage!({ data: { job: 1, game: 'pinwheel', variant: 0, seed: 5 } } as MessageEvent);
		scope.onmessage!({ data: { job: 2, game: 'nope', variant: 0, seed: 5 } } as MessageEvent);
		const logic = GAME_LOGIC.pinwheel;
		expect(scope.postMessage).toHaveBeenNthCalledWith(1, {
			job: 1,
			puzzle: logic.generate(logic.variants[0], 5)
		});
		expect(scope.postMessage).toHaveBeenNthCalledWith(2, {
			job: 2,
			error: expect.stringContaining('TypeError')
		});
	});
});

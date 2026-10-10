import { describe, expect, it } from 'vitest';
import { entries, load } from './+page';

type LoadEvent = Parameters<typeof load>[0];
const loadFor = (game: string) => load({ params: { game } } as LoadEvent);

describe('game page', () => {
	it('is prerendered for every game', async () => {
		expect(await entries()).toEqual([
			{ game: 'tetroid' },
			{ game: 'pinwheel' },
			{ game: 'sudoku' }
		]);
	});

	it('loads a game and gives a 404 for an unknown one', () => {
		expect(loadFor('sudoku')).toEqual({ gameId: 'sudoku' });
		expect(() => loadFor('nope')).toThrow(expect.objectContaining({ status: 404 }));
	});
});

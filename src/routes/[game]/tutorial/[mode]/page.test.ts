import { describe, expect, it } from 'vitest';
import { entries, load } from './+page';

type LoadEvent = Parameters<typeof load>[0];
const loadFor = (game: string, mode: string) => load({ params: { game, mode } } as LoadEvent);

describe('mode tutorial page', () => {
	it('is prerendered for every mode tutorial', async () => {
		expect(await entries()).toEqual([{ game: 'sudoku', mode: 'calc' }]);
	});

	it('loads a mode tutorial and refuses anything else', () => {
		expect(loadFor('sudoku', 'calc')).toEqual({ gameId: 'sudoku', mode: 'calc' });
		expect(() => loadFor('sudoku', 'nope')).toThrow();
		expect(() => loadFor('nope', 'calc')).toThrow();
	});
});

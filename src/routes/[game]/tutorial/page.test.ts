import { describe, expect, it } from 'vitest';
import { gameById } from '#lib/games/index.ts';
import { entries, load } from './+page';

type LoadEvent = Parameters<typeof load>[0];
const loadFor = (game: string) => load({ params: { game } } as LoadEvent);

describe('tutorial page', () => {
	it('is prerendered for every game with a tutorial', async () => {
		expect(await entries()).toEqual([
			{ game: 'tetroid' },
			{ game: 'pinwheel' },
			{ game: 'sudoku' }
		]);
	});

	it('loads a tutorial and gives a 404 for an unknown game', () => {
		expect(loadFor('tetroid')).toEqual({ gameId: 'tetroid' });
		expect(() => loadFor('nope')).toThrow(expect.objectContaining({ status: 404 }));
	});

	it('leaves out a game without a tutorial', async () => {
		// Every game has one today: take Pinwheel's away for the test.
		const pinwheel = gameById('pinwheel')!;
		const { tutorial } = pinwheel;
		pinwheel.tutorial = undefined;
		try {
			expect(await entries()).toEqual([{ game: 'tetroid' }, { game: 'sudoku' }]);
			expect(() => loadFor('pinwheel')).toThrow(expect.objectContaining({ status: 404 }));
		} finally {
			pinwheel.tutorial = tutorial;
		}
	});
});

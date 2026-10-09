import { error } from '@sveltejs/kit';
import { GAMES, gameById } from '#lib/games/index.ts';
import { findTutorial, tutorialsOf } from '#lib/games/tutorials.ts';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () =>
	GAMES.flatMap(tutorialsOf)
		.filter((r) => r.mode)
		.map((r) => ({ game: r.game.id, mode: r.mode! }));

export const load: PageLoad = ({ params }) => {
	const game = gameById(params.game);
	if (!game || !findTutorial(game, params.mode)) error(404, 'No tutorial');
	return { gameId: params.game, mode: params.mode };
};

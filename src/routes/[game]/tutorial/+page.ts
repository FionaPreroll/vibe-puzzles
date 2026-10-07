import { error } from '@sveltejs/kit';
import { GAMES, gameById } from '#lib/games/index.ts';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () =>
	GAMES.filter((g) => g.tutorial).map((g) => ({ game: g.id }));

export const load: PageLoad = ({ params }) => {
	if (!gameById(params.game)?.tutorial) error(404, 'No tutorial');
	return { gameId: params.game };
};

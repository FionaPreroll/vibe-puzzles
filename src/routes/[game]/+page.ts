import { error } from '@sveltejs/kit';
import { GAMES, gameById } from '#lib/games/index.ts';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => GAMES.map((g) => ({ game: g.id }));

export const load: PageLoad = ({ params }) => {
	if (!gameById(params.game)) error(404, 'Unknown game');
	return { gameId: params.game };
};

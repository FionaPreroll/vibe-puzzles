import { GAME_LOGIC } from '../games/logic';

/** Generates puzzles off the main thread. */
self.onmessage = (
	e: MessageEvent<{ job: number; game: string; variant: number; seed: number }>
) => {
	const { job, game, variant, seed } = e.data;
	try {
		const logic = GAME_LOGIC[game];
		const puzzle = logic.generate(logic.variants[variant], seed);
		self.postMessage({ job, puzzle });
	} catch (err) {
		self.postMessage({ job, error: String(err) });
	}
};

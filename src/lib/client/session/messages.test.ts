import { describe, expect, it } from 'vitest';
import { GAME_LOGIC } from '../../games/logic';
import { i18n } from '../../i18n/index.svelte';
import { message, scoreMessage } from './messages';

const variant = GAME_LOGIC.tetroid.variants[0];

describe('messages', () => {
	it('make their text on each read, in the language chosen then', () => {
		let n = 0;
		const m = message('info', () => `text ${++n}`);
		expect(m.kind).toBe('info');
		expect(m.text).toBe('text 1');
		expect(m.text).toBe('text 2');
	});

	it.each([
		[{ ok: false, code: 'wrong' }, 'error', 'That is not the solution yet.'],
		[{ ok: true, code: 'repeat', timeMs: 61000 }, 'success', '01:01'],
		[{ ok: false, code: 'expired' }, 'info', 'no longer keeps this old puzzle'],
		[{ ok: true, code: 'ranked', rank: 2, total: 9 }, 'success', 'Rank 2 of 9'],
		[{ ok: true, code: 'ranked' }, 'success', 'Rank – of –'],
		[{ ok: true, code: 'ranked', bestMs: 4000 }, 'success', 'Your best'],
		[{ ok: false, message: 'From the server' }, 'error', 'From the server']
	] as const)('say what the server answered %o', (res, kind, text) => {
		const m = scoreMessage({ message: '', ...res }, 5000, variant);
		expect(m.kind).toBe(kind);
		expect(m.text).toContain(text);
	});

	it('name a better best time, in the language chosen later', () => {
		const m = scoreMessage(
			{ ok: true, code: 'ranked', message: '', rank: 1, total: 1, timeMs: 9000, bestMs: 4000 },
			9000,
			variant
		);
		expect(m.text).toMatch(/Rank 1 of 1.*00:04\.000/);
		i18n.locale = 'de';
		try {
			expect(m.text).toMatch(/Platz 1 von 1/);
		} finally {
			i18n.locale = 'en';
		}
	});
});

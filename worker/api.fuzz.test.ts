import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	Collection,
	layoutType,
	sizesOf,
	type BankFile,
	type BankIndex
} from '../src/lib/core/bank';
import { encodePuzzleId } from '../src/lib/core/variants';
import { generateTetroid } from '../src/lib/games/tetroid/generator';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import { handleApi, type ApiOptions } from './api';
import { MemoryStore } from './store';

/**
 * Random requests against the API. Whatever arrives, the API answers with a JSON object and a
 * status it means (never a 500), and writes nothing the database could not store.
 */

const RUNS = {
	numRuns: Number(process.env.FUZZ_RUNS ?? 300),
	seed: Number(process.env.FUZZ_SEED ?? 77)
};

const seed = 4242;
const { puzzle, solution } = generateTetroid(6, 6, 'normal', seed);
const puzzleId = encodePuzzleId(0, seed);
const answer = solution.join('');
const files: Record<string, BankFile | BankIndex> = layoutType('tetroid', '6n', [
	{ id: puzzleId, puzzle }
]);
const collection = new Collection(
	async (path) => files[path] ?? null,
	sizesOf(Object.values(files))
);

/**
 * The in-memory store, checking what D1 would get: every number goes into an INTEGER column, where
 * Infinity or NaN would turn into NULL (and `INSERT OR IGNORE` would then drop the row).
 */
function checkedStore() {
	const store = new MemoryStore();
	const bad: unknown[] = [];
	const check = (v: unknown): void => {
		if (typeof v === 'number' && !Number.isSafeInteger(v)) bad.push(v);
		else if (v && typeof v === 'object') Object.values(v).forEach(check);
	};
	const proxy = new Proxy(store, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value !== 'function') return value;
			return (...args: unknown[]) => {
				args.forEach(check);
				return value.apply(target, args);
			};
		}
	});
	return { store: proxy, bad };
}

async function setup(options: ApiOptions = { serverPuzzles: true, collection }) {
	const { store, bad } = checkedStore();
	const call = async (
		method: string,
		path: string,
		body?: string,
		token?: string
	): Promise<{ status: number; body: Record<string, unknown> }> => {
		const headers: Record<string, string> = {};
		if (token !== undefined) headers.authorization = `Bearer ${token}`;
		const res = await handleApi(
			new Request(`https://example.test/api${path}`, { method, headers, body }),
			store,
			options
		);
		const text = await res.text();
		let parsed: unknown;
		expect(() => (parsed = JSON.parse(text)), text).not.toThrow();
		expect(parsed).toBeTypeOf('object');
		return { status: res.status, body: parsed as Record<string, unknown> };
	};
	const created = await call('POST', '/player', JSON.stringify({ name: 'Fuzz' }));
	return { call, bad, token: created.body.token as string };
}

/** Names that pass for game IDs or puzzle types, and some that only look like them. */
const name = fc.oneof(
	fc.constantFrom(
		'tetroid',
		'pinwheel',
		'sudoku',
		'6n',
		'daily',
		'__proto__',
		'constructor',
		'toString',
		'hasOwnProperty',
		''
	),
	fc.string()
);
/** Numbers as JSON can carry them; 1e400 parses to Infinity. */
const number = fc.oneof(
	fc.constantFrom(0, -1, 1, 0.5, 2 ** 53, -(2 ** 53), puzzleId, 1e300),
	fc.double(),
	fc.integer()
);
const leaf = fc.oneof(name, number, fc.boolean(), fc.constant(null));
const json = fc.letrec((tie) => ({
	value: fc.oneof({ depthSize: 'small' }, leaf, tie('array'), tie('object')),
	array: fc.array(tie('value'), { maxLength: 4 }),
	object: fc.dictionary(
		fc.constantFrom(
			'game',
			'variant',
			'name',
			'puzzle',
			'answer',
			'ticket',
			'timeMs',
			'playMs',
			'puzzleId',
			'competitive',
			'hinted',
			'data',
			'updatedAt'
		),
		tie('value'),
		{ maxKeys: 6 }
	)
})).value;
/** A body as sent: JSON, JSON with numbers too large for a double, or anything. */
const body = fc.oneof(
	json.map((v) => JSON.stringify(v)),
	json.map((v) => JSON.stringify(v).replace(/\d+(\.\d+)?(e[+-]?\d+)?/gi, '1e400')),
	fc.string(),
	fc.constant(undefined)
);
const path = fc.oneof(
	fc.constantFrom('/health', '/player', '/puzzles', '/scores', '/nope', '/saves/'),
	fc.string().map((s) => `/saves/${s.replace(/[?#]/g, '')}`),
	fc.constantFrom('/saves/%', '/saves/%E0%A4%A', '/saves/save%3Atetroid%3A6n'),
	fc
		.record({ game: name, variant: name, puzzleId: fc.option(fc.string(), { nil: undefined }) })
		.map(({ game, variant, puzzleId }) => {
			const q = new URLSearchParams({ game, variant });
			if (puzzleId !== undefined) q.set('puzzleId', puzzleId);
			return `/scores?${q}`;
		})
);
const method = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

describe('api fuzzing', () => {
	it('answers any request with JSON and a meaningful status', async () => {
		const { call, bad, token } = await setup();
		await fc.assert(
			fc.asyncProperty(
				method,
				path,
				body,
				fc.option(fc.oneof(fc.constant(token), fc.string()), { nil: undefined }),
				async (m, p, b, t) => {
					const res = await call(m, p, m === 'GET' ? undefined : b, t);
					expect([200, 201, 400, 401, 404, 413, 503]).toContain(res.status);
					if (res.status >= 400) expect(res.body.error).toEqual(expect.any(String));
					expect(bad).toEqual([]);
				}
			),
			RUNS
		);
	});

	it('records a correct ticket solve once, whatever else the client sends', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.dictionary(fc.constantFrom('timeMs', 'playMs', 'competitive', 'hinted', 'game'), json),
				fc.constantFrom('', '1e400', '-1e400', '1e300'),
				async (extra, playMs) => {
					const { call, bad, token } = await setup();
					const issued = await call('POST', '/puzzles', '{"game":"tetroid","variant":"6n"}', token);
					const ticket = issued.body as { ticket: string; puzzle: TetroidPuzzle };
					const solved = solveTetroid(ticket.puzzle, { limit: 1 }).solutions[0].join('');
					let text = JSON.stringify({ ...extra, ticket: ticket.ticket, answer: solved });
					if (playMs) text = text.replace(/}$/, `,"playMs":${playMs}}`);
					const res = await call('POST', '/scores', text, token);
					expect(res.status).toBe(200);
					expect(res.body).toMatchObject({ ok: true, puzzleId });
					expect(['ranked', 'personal', 'hinted']).toContain(res.body.code);
					expect(Number.isSafeInteger(res.body.timeMs)).toBe(true);
					expect(bad).toEqual([]);
				}
			),
			{ ...RUNS, numRuns: 100 }
		);
	});

	it('records a correct solve of a local puzzle, or refuses its times', async () => {
		/** A time as JSON text: any value, or a number out of a double's range. */
		const time = fc.oneof(
			json.map((v) => JSON.stringify(v)),
			fc.constantFrom('1e400', '-1e400', '1e300', '0.4', '"12"')
		);
		await fc.assert(
			fc.asyncProperty(time, time, async (timeMs, playMs) => {
				const { call, bad, token } = await setup({});
				const solve = JSON.stringify({ game: 'tetroid', variant: '6n', puzzleId, puzzle, answer });
				const text = solve.replace(/}$/, `,"timeMs":${timeMs},"playMs":${playMs}}`);
				const res = await call('POST', '/scores', text, token);
				if (res.status === 400) {
					expect(res.body).toEqual({ error: 'Invalid time' });
				} else {
					expect(res.body).toMatchObject({ ok: true, code: 'ranked', rank: 1 });
					expect(Number.isSafeInteger(res.body.timeMs)).toBe(true);
				}
				expect(bad).toEqual([]);
			}),
			{ ...RUNS, numRuns: 100 }
		);
	});

	it('keeps names visible', async () => {
		const { call, token } = await setup();
		const invisible = /[\p{Cc}\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u;
		await fc.assert(
			fc.asyncProperty(
				fc.oneof(
					fc.string({ unit: 'binary', maxLength: 30 }),
					fc.constantFrom(
						'\u200b',
						'\u202eevil',
						'\u0000\u0007',
						' \u2066 ',
						'A\u200dB',
						'🏳️\u200d🌈'
					)
				),
				async (n) => {
					const res = await call('PATCH', '/player', JSON.stringify({ name: n }), token);
					if (res.status === 400) return;
					expect(res.status).toBe(200);
					const kept = res.body.name as string;
					expect(kept).toMatch(/[\p{L}\p{N}\p{P}\p{S}]/u);
					expect(kept).not.toMatch(invisible);
					expect(kept.length).toBeLessThanOrEqual(24);
				}
			),
			RUNS
		);
	});

	it('keeps any save key apart', async () => {
		const { call, token } = await setup();
		await fc.assert(
			fc.asyncProperty(
				fc
					.string({ unit: 'grapheme', minLength: 1, maxLength: 40 })
					// A URL path takes `.` and `..` as directories.
					.filter((k) => k !== '.' && k !== '..'),
				json,
				async (key, data) => {
					const at = `/saves/${encodeURIComponent(key)}`;
					const put = await call('PUT', at, JSON.stringify({ data, updatedAt: Date.now() }), token);
					expect(put.status).toBe(200);
					const got = await call('GET', at, undefined, token);
					expect(got.body).toMatchObject({ key, data: JSON.parse(JSON.stringify(data)) ?? null });
				}
			),
			RUNS
		);
	});

	it('refuses an oversized body without reading all of it', async () => {
		let pulled = 0;
		const chunk = new Uint8Array(64 * 1024).fill(32);
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulled++;
				controller.enqueue(chunk);
			}
		});
		const res = await handleApi(
			new Request('https://example.test/api/player', {
				method: 'POST',
				body: stream,
				// @ts-expect-error Node needs it for a streamed body.
				duplex: 'half'
			}),
			new MemoryStore()
		);
		expect(res.status).toBe(413);
		expect(pulled).toBeLessThan(20);
	});
});

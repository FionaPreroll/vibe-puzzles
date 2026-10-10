import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { D1Store, MemoryStore, type ScoreRow, type Store } from './store';

/** Just enough of the D1 API for D1Store, backed by SQLite with the real migrations. */
function sqliteD1(): ConstructorParameters<typeof D1Store>[0] {
	const db = new DatabaseSync(':memory:');
	const dir = new URL('../migrations/', import.meta.url);
	for (const file of readdirSync(dir).sort()) db.exec(readFileSync(new URL(file, dir), 'utf8'));
	const prepare = (sql: string) => {
		let args: (string | number | null)[] = [];
		const stmt = {
			bind(...values: (string | number | null)[]) {
				args = values;
				return stmt;
			},
			async run() {
				const { changes } = db.prepare(sql).run(...args);
				return { meta: { changes: Number(changes) } };
			},
			async first() {
				return db.prepare(sql).get(...args) ?? null;
			},
			async all() {
				return { results: db.prepare(sql).all(...args) };
			}
		};
		return stmt;
	};
	return { prepare } as unknown as ConstructorParameters<typeof D1Store>[0];
}

const score = (playerId: string, timeMs: number, extra: Partial<ScoreRow> = {}): ScoreRow => ({
	playerId,
	game: 'tetroid',
	variant: '6n',
	puzzleId: 1,
	timeMs,
	playMs: timeMs,
	competitive: true,
	createdAt: 1000,
	...extra
});

describe.each([
	['MemoryStore', () => new MemoryStore()],
	['D1Store', () => new D1Store(sqliteD1())]
])('%s', (_, make: () => Store) => {
	async function withPlayers(...names: string[]) {
		const store = make();
		for (const name of names) await store.createPlayer(name, name.toUpperCase(), `hash-${name}`);
		return store;
	}

	it('finds players by token hash and renames them', async () => {
		const store = await withPlayers('ann');
		expect(await store.playerByToken('hash-ann')).toEqual({ id: 'ann', name: 'ANN' });
		expect(await store.playerByToken('hash-bob')).toBeNull();
		await store.renamePlayer('ann', 'Annie');
		expect(await store.playerByToken('hash-ann')).toEqual({ id: 'ann', name: 'Annie' });
	});

	it('keeps the newest save per player and key', async () => {
		const store = await withPlayers('ann', 'bob');
		expect(await store.getSave('ann', 'k')).toBeNull();
		expect(await store.putSave('ann', 'k', 'v1', 10, 1)).toBe(true);
		expect(await store.putSave('ann', 'k', 'v2', 20, 2)).toBe(true);
		expect(await store.putSave('ann', 'k', 'old', 15, 3)).toBe(false);
		expect(await store.putSave('ann', 'k', 'same', 20, 4)).toBe(false);
		expect(await store.getSave('ann', 'k')).toEqual({ data: 'v2', updatedAt: 20 });
		expect(await store.getSave('bob', 'k')).toBeNull();
		expect(await store.putSave('bob', 'k', 'b', 1, 5)).toBe(true);
		expect(await store.getSave('ann', 'k')).toEqual({ data: 'v2', updatedAt: 20 });
	});

	it('keeps the most recently stored saves of a player within a number and size', async () => {
		const store = await withPlayers('ann', 'bob');
		// Stored in this order; the client's own timestamps do not count.
		await store.putSave('ann', 'a', '1234', 900, 100);
		await store.putSave('ann', 'b', '12', 800, 200);
		await store.putSave('ann', 'c', '1', 700, 300);
		await store.putSave('bob', 'x', '123456', 1, 50);
		expect(await store.trimSaves('ann', 3, 7)).toBe(0);
		expect(await store.trimSaves('ann', 2, 7)).toBe(1);
		expect(await store.getSave('ann', 'a')).toBeNull();
		expect(await store.getSave('ann', 'b')).not.toBeNull();
		// Storing a save again makes it the newest.
		await store.putSave('ann', 'b', '123', 801, 400);
		expect(await store.trimSaves('ann', 2, 3)).toBe(1);
		expect(await store.getSave('ann', 'b')).toEqual({ data: '123', updatedAt: 801 });
		expect(await store.getSave('ann', 'c')).toBeNull();
		expect(await store.getSave('bob', 'x')).not.toBeNull();
		// Saves stored at the same moment are kept in key order.
		for (const key of ['z', 'y', 'w']) await store.putSave('ann', key, '1', 1, 500);
		expect(await store.trimSaves('ann', 2, 100)).toBe(2);
		expect(await store.getSave('ann', 'w')).not.toBeNull();
		expect(await store.getSave('ann', 'y')).not.toBeNull();
		expect(await store.getSave('ann', 'z')).toBeNull();
	});

	it('deletes saves nobody stored for a while', async () => {
		const store = await withPlayers('ann', 'bob');
		await store.putSave('ann', 'old', 'o', 9999, 100);
		await store.putSave('ann', 'new', 'n', 1, 300);
		await store.putSave('bob', 'old', 'o', 1, 150);
		expect(await store.deleteSaves(200)).toBe(2);
		expect(await store.getSave('ann', 'old')).toBeNull();
		expect(await store.getSave('bob', 'old')).toBeNull();
		expect(await store.getSave('ann', 'new')).not.toBeNull();
		expect(await store.deleteSaves(200)).toBe(0);
	});

	it('keeps the first fingerprint of a puzzle', async () => {
		const store = make();
		expect(await store.fingerprint('tetroid', 1, 'a')).toBe('a');
		expect(await store.fingerprint('tetroid', 1, 'b')).toBe('a');
		expect(await store.fingerprint('pinwheel', 1, 'b')).toBe('b');
	});

	it('accepts one score per player and puzzle', async () => {
		const store = await withPlayers('ann');
		expect(await store.addScore(score('ann', 500))).toBe(true);
		expect(await store.addScore(score('ann', 400))).toBe(false);
		expect(await store.addScore(score('ann', 400, { puzzleId: 2 }))).toBe(true);
		expect(await store.addScore(score('ann', 400, { game: 'pinwheel' }))).toBe(true);
	});

	it('ranks each player by their best competitive time', async () => {
		const store = await withPlayers('ann', 'bob', 'cat', 'dan');
		await store.addScore(score('ann', 900, { puzzleId: 1 }));
		await store.addScore(score('ann', 300, { puzzleId: 2 }));
		await store.addScore(score('bob', 500, { puzzleId: 1 }));
		// A tie is broken by who was first.
		await store.addScore(score('cat', 500, { puzzleId: 3, createdAt: 2000 }));
		// Not competitive, other variant: not on the board.
		await store.addScore(score('dan', 100, { competitive: false }));
		await store.addScore(score('dan', 100, { puzzleId: 4, variant: '8n' }));

		const scope = { game: 'tetroid', variant: '6n', puzzleId: null };
		const board = await store.board(scope, 10);
		expect(board.map((r) => [r.playerId, r.name, r.timeMs, r.puzzleId])).toEqual([
			['ann', 'ANN', 300, 2],
			['bob', 'BOB', 500, 1],
			['cat', 'CAT', 500, 3]
		]);
		expect(await store.board(scope, 2)).toHaveLength(2);
		expect(await store.players(scope)).toBe(3);
		expect(await store.rank(scope, 'cat')).toEqual({ rank: 3, row: board[2] });
		expect(await store.rank(scope, 'dan')).toBeNull();

		const puzzleScope = { ...scope, puzzleId: 1 };
		expect((await store.board(puzzleScope, 10)).map((r) => [r.playerId, r.timeMs])).toEqual([
			['bob', 500],
			['ann', 900]
		]);
		expect((await store.rank(puzzleScope, 'ann'))?.rank).toBe(2);
		expect(await store.players(puzzleScope)).toBe(2);
	});

	it('solves a ticket only once', async () => {
		const store = await withPlayers('ann');
		const ticket = {
			id: 't1',
			playerId: 'ann',
			game: 'tetroid',
			variant: '6n',
			puzzleId: 7,
			puzzle: '{}',
			issuedAt: 100,
			solvedAt: null
		};
		await store.createTicket(ticket);
		expect(await store.getTicket('t1')).toEqual(ticket);
		expect(await store.getTicket('t2')).toBeNull();
		expect(await store.solveTicket('t1', 200)).toBe(true);
		expect(await store.solveTicket('t1', 300)).toBe(false);
		expect(await store.solveTicket('t2', 300)).toBe(false);
		expect((await store.getTicket('t1'))?.solvedAt).toBe(200);
	});

	it('lists the puzzles a player was issued or solved', async () => {
		const store = await withPlayers('ann', 'bob');
		const ticket = {
			playerId: 'ann',
			game: 'tetroid',
			variant: '6n',
			puzzle: '{}',
			solvedAt: null
		};
		await store.createTicket({ ...ticket, id: 't1', puzzleId: 7, issuedAt: 1 });
		await store.createTicket({ ...ticket, id: 't2', puzzleId: 8, issuedAt: 2, variant: '8n' });
		await store.addScore(score('ann', 100, { puzzleId: 9 }));
		await store.addScore(score('ann', 100, { puzzleId: 7 }));
		await store.addScore(score('bob', 100, { puzzleId: 10 }));
		expect(await store.playedPuzzles('ann', 'tetroid', '6n')).toEqual(new Set([7, 9]));
		expect(await store.playedPuzzles('ann', 'tetroid', '8n')).toEqual(new Set([8]));
		expect(await store.playedPuzzles('ann', 'pinwheel', '6n')).toEqual(new Set());
	});

	it('deletes old tickets', async () => {
		const store = await withPlayers('ann');
		const ticket = { playerId: 'ann', game: 'tetroid', variant: '6n', puzzleId: 7, puzzle: '{}' };
		await store.createTicket({ ...ticket, id: 'old-open', issuedAt: 100, solvedAt: null });
		await store.createTicket({ ...ticket, id: 'new-open', issuedAt: 500, solvedAt: null });
		await store.createTicket({ ...ticket, id: 'old-solved', issuedAt: 300, solvedAt: null });
		await store.solveTicket('old-solved', 350);
		await store.createTicket({ ...ticket, id: 'new-solved', issuedAt: 300, solvedAt: null });
		await store.solveTicket('new-solved', 450);
		expect(await store.deleteTickets(200, 400)).toBe(2);
		expect(await store.getTicket('old-open')).toBeNull();
		expect(await store.getTicket('old-solved')).toBeNull();
		expect(await store.getTicket('new-open')).not.toBeNull();
		expect(await store.getTicket('new-solved')).not.toBeNull();
		expect(await store.deleteTickets(200, 400)).toBe(0);
	});
});
